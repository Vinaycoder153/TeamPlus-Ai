import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/errors"

/**
 * GET /api/slack/insights
 *
 * Returns aggregated Slack-based productivity insights for the user's team.
 * Used to power the "Slack Insights" dashboard panel.
 *
 * Query params:
 *   ?days=7  (default: 7, max: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const days = Math.min(Number(searchParams.get("days") ?? "7"), 30)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // Get the user's team
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single()

    if (!profile?.team_id) {
      return NextResponse.json({ insights: null, reason: "no_team" })
    }

    // Fetch activity logs for the whole team in the date range
    const { data: logs, error } = await supabase
      .from("activity_logs")
      .select("user_id, message_count, productivity_signal, activity_date, channel_name")
      .eq("team_id", profile.team_id)
      .gte("activity_date", since)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({ insights: null, reason: "no_activity_data" })
    }

    // Aggregate by user
    const userMap = new Map<
      string,
      { messageCount: number; signals: string[]; days: Set<string> }
    >()

    for (const log of logs) {
      const entry = userMap.get(log.user_id) ?? {
        messageCount: 0,
        signals: [],
        days: new Set(),
      }
      entry.messageCount += log.message_count
      entry.signals.push(log.productivity_signal)
      entry.days.add(log.activity_date)
      userMap.set(log.user_id, entry)
    }

    // Fetch names for all user IDs
    const userIds = [...userMap.keys()]
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds)

    const nameMap = new Map(
      (profiles ?? []).map((p) => [p.id, p.full_name || p.email])
    )

    // Build per-user summaries
    type SignalSummary = {
      userId: string
      name: string
      totalMessages: number
      activeDays: number
      dominantSignal: string
    }

    const summaries: SignalSummary[] = []
    for (const [uid, data] of userMap.entries()) {
      // Find the most common signal
      const signalCounts = data.signals.reduce<Record<string, number>>((acc, s) => {
        acc[s] = (acc[s] ?? 0) + 1
        return acc
      }, {})
      const dominantSignal = Object.entries(signalCounts).sort((a, b) => b[1] - a[1])[0][0]

      summaries.push({
        userId: uid,
        name: nameMap.get(uid) ?? uid,
        totalMessages: data.messageCount,
        activeDays: data.days.size,
        dominantSignal,
      })
    }

    summaries.sort((a, b) => b.totalMessages - a.totalMessages)

    return NextResponse.json({
      insights: {
        mostActiveCommunicator: summaries[0] ?? null,
        silentButProductive:
          summaries.find((s) => s.dominantSignal === "deep_work") ?? null,
        highDistractionRisk:
          summaries.find((s) => s.dominantSignal === "distraction_risk") ?? null,
        memberSummaries: summaries,
        periodDays: days,
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}

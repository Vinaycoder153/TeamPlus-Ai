import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  fetchChannelMessages,
  computeUserActivityMetrics,
  mapProductivitySignal,
} from "@/lib/slack"
import { calculatePerformanceScore } from "@/lib/scoring"
import { checkRateLimit } from "@/lib/rateLimit"
import { handleApiError } from "@/lib/errors"

const syncSchema = z.object({
  channelId: z.string().min(1, "channelId is required"),
  channelName: z.string().optional(),
  lookbackHours: z.number().int().min(1).max(168).optional().default(24),
})

/**
 * POST /api/slack/activity
 *
 * Syncs Slack channel message activity for the authenticated user and stores
 * the aggregated metrics in the activity_logs table.
 *
 * Body: { channelId: string; channelName?: string; lookbackHours?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate-limit: 20 syncs per hour per user
    const rl = checkRateLimit(`slack_activity:${user.id}`, { limit: 20, windowSeconds: 3600 })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await request.json()
    const parsed = syncSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { channelId, channelName, lookbackHours } = parsed.data

    // Fetch Slack integration
    const { data: integration } = await supabase
      .from("slack_integrations")
      .select("access_token, slack_team_id")
      .eq("user_id", user.id)
      .single()

    if (!integration?.access_token) {
      return NextResponse.json(
        { error: "No Slack integration found. Please connect Slack first." },
        { status: 404 }
      )
    }

    // Fetch messages from the channel
    const msgResult = await fetchChannelMessages(integration.access_token, channelId, {
      lookbackHours,
    })

    if (!msgResult.ok) {
      return NextResponse.json(
        { error: msgResult.error ?? "Failed to fetch Slack messages" },
        { status: 502 }
      )
    }

    const messages = msgResult.messages ?? []

    // Fetch Slack integration to get the authed user's Slack ID
    const [{ data: profile }, { data: slackIntegration }] = await Promise.all([
      supabase.from("profiles").select("team_id").eq("id", user.id).single(),
      supabase
        .from("slack_integrations")
        .select("authed_user_slack_id")
        .eq("user_id", user.id)
        .single(),
    ])

    // Use the authenticated user's Slack ID to filter their messages
    const slackUserId = slackIntegration?.authed_user_slack_id ?? ""
    const activityMetrics = computeUserActivityMetrics(messages, slackUserId)

    // Fetch recent task metrics to enrich the productivity signal
    const { data: recentTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", user.id)
      .order("updated_at", { ascending: false })
      .limit(20)

    const taskMetrics = calculatePerformanceScore(recentTasks ?? [], user.id)

    const productivitySignal = mapProductivitySignal(
      activityMetrics.messageCount,
      taskMetrics.completionRate
    )

    const activityDate = new Date().toISOString().slice(0, 10)

    // Upsert the activity log entry
    const { data: log, error: upsertError } = await supabase
      .from("activity_logs")
      .upsert(
        {
          user_id: user.id,
          team_id: profile?.team_id ?? null,
          slack_user_id: slackUserId || null,
          channel_id: channelId,
          channel_name: channelName ?? channelId,
          activity_date: activityDate,
          message_count: activityMetrics.messageCount,
          peak_hour: activityMetrics.peakHour,
          avg_response_time_minutes: activityMetrics.avgResponseTimeMinutes,
          productivity_signal: productivitySignal,
          raw_metadata: {
            total_messages_in_channel: messages.length,
            lookback_hours: lookbackHours,
          },
        },
        { onConflict: "user_id,channel_id,activity_date" }
      )
      .select()
      .single()

    if (upsertError) {
      console.error("Failed to upsert activity log:", upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({
      log,
      metrics: {
        messageCount: activityMetrics.messageCount,
        peakHour: activityMetrics.peakHour,
        avgResponseTimeMinutes: activityMetrics.avgResponseTimeMinutes,
        productivitySignal,
        taskCompletionRate: taskMetrics.completionRate,
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}

/**
 * GET /api/slack/activity
 *
 * Returns activity logs for the authenticated user, optionally filtered by date range.
 * Query params: ?days=7 (default: 7, max: 30)
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

    const { data: logs, error } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("activity_date", since)
      .order("activity_date", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ logs: logs ?? [] })
  } catch (err) {
    return handleApiError(err)
  }
}

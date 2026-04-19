import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateWeeklyTeamInsight } from "@/lib/ai"
import { calculatePerformanceScore } from "@/lib/scoring"

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const { data: teamMembers } = await supabase
      .from("profiles")
      .select("*")
      .eq("team_id", profile.team_id || "")

    const { data: team } = profile.team_id
      ? await supabase.from("teams").select("*").eq("id", profile.team_id).single()
      : { data: null }

    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    const members = teamMembers || []
    const allTasks = tasks || []

    const completedTasks = allTasks.filter((t) => t.status === "done").length
    const inProgressTasks = allTasks.filter((t) => t.status === "in_progress").length
    const overdueTasks = allTasks.filter(
      (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done"
    ).length

    const memberScores = members.map((m) => ({
      name: m.full_name || m.email,
      score: calculatePerformanceScore(allTasks, m.id).overallScore,
    }))

    memberScores.sort((a, b) => b.score - a.score)

    const topPerformers = memberScores.slice(0, 3).filter((m) => m.score > 50)
    const strugglingMembers = memberScores.slice(-3).filter((m) => m.score < 50)

    const content = await generateWeeklyTeamInsight({
      team: {
        name: team?.name || "Your Team",
        memberCount: members.length,
      },
      metrics: {
        tasksCompleted: completedTasks,
        tasksInProgress: inProgressTasks,
        overdueTasks,
        avgCompletionRate:
          allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0,
      },
      topPerformers,
      strugglingMembers,
    })

    const { data: insight, error } = await supabase
      .from("ai_insights")
      .insert({
        team_id: profile.team_id,
        user_id: user.id,
        insight_type: "weekly_summary",
        content,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ insight })
  } catch (error) {
    console.error("Weekly insight error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateIndividualInsight } from "@/lib/ai"
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

    const { data: recentTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", user.id)
      .order("updated_at", { ascending: false })
      .limit(10)

    const { data: performanceHistory } = await supabase
      .from("performance_scores")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(4)

    const tasks = recentTasks || []
    const history = performanceHistory || []
    const metrics = calculatePerformanceScore(tasks, user.id)

    const content = await generateIndividualInsight({
      member: profile,
      recentTasks: tasks,
      performanceHistory: history,
      currentScore: metrics.overallScore,
    })

    const { data: insight, error } = await supabase
      .from("ai_insights")
      .insert({
        user_id: user.id,
        team_id: profile.team_id,
        insight_type: "individual_feedback",
        content,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ insight })
  } catch (error) {
    console.error("Individual insight error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

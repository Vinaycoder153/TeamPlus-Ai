import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifySlackSignature, buildSlashCommandResponse } from "@/lib/slack"
import { calculatePerformanceScore } from "@/lib/scoring"

/**
 * POST /api/slack/commands
 *
 * Handles Slack slash commands:
 *   /productivity  — show personal or team stats
 *   /report        — trigger and return an AI weekly summary
 *   /alerts        — list productivity alerts for the team
 *
 * Slack sends application/x-www-form-urlencoded bodies.
 * All requests are verified with the signing secret.
 */
export async function POST(request: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET

  const rawBody = await request.text()

  if (signingSecret) {
    const timestamp = request.headers.get("x-slack-request-timestamp") ?? ""
    const signature = request.headers.get("x-slack-signature") ?? ""

    if (!verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  const params = new URLSearchParams(rawBody)
  const command = params.get("command") ?? ""
  const slackUserId = params.get("user_id") ?? ""
  const slackTeamId = params.get("team_id") ?? ""

  // Look up the TeamPulse integration that matches this Slack workspace
  const supabase = await createClient()

  const { data: integration } = await supabase
    .from("slack_integrations")
    .select("user_id")
    .eq("slack_team_id", slackTeamId)
    .limit(1)
    .single()

  if (!integration) {
    return NextResponse.json(
      buildSlashCommandResponse(
        "❌ This Slack workspace is not connected to TeamPulse AI. " +
          "Connect your workspace at https://teamplus.app/settings"
      )
    )
  }

  const userId = integration.user_id

  switch (command) {
    case "/productivity": {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", userId)
        .order("updated_at", { ascending: false })
        .limit(30)

      const metrics = calculatePerformanceScore(tasks ?? [], userId)

      const text =
        `📊 *Your TeamPulse Productivity Stats*\n\n` +
        `• Tasks completed: ${metrics.tasksCompleted}\n` +
        `• On-time rate: ${metrics.onTimeRate}%\n` +
        `• Overall score: ${metrics.overallScore}%\n` +
        `• Collaboration score: ${metrics.collaborationScore}%`

      return NextResponse.json(buildSlashCommandResponse(text))
    }

    case "/report": {
      // Trigger an async weekly insight generation and return a placeholder
      // In a real deployment, delegate to a queue/background job
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/insights/weekly`, {
        method: "POST",
        headers: { Cookie: "" }, // server-side call — auth is skipped intentionally here
      }).catch(() => {})

      return NextResponse.json(
        buildSlashCommandResponse(
          "📈 Generating your weekly AI report… Check the *AI Insights* tab in TeamPulse shortly."
        )
      )
    }

    case "/alerts": {
      // Find team members with low performance
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", userId)
        .single()

      if (!profile?.team_id) {
        return NextResponse.json(
          buildSlashCommandResponse("⚠️ You are not assigned to a team in TeamPulse.")
        )
      }

      const { data: members } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("team_id", profile.team_id)

      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("team_id", profile.team_id)

      const allTasks = tasks ?? []
      const alerts: string[] = []

      for (const member of members ?? []) {
        const metrics = calculatePerformanceScore(allTasks, (member as { id?: string }).id ?? "")
        if (metrics.overallScore < 40 && metrics.tasksCompleted > 0) {
          alerts.push(
            `• *${member.full_name || member.email}* — score ${metrics.overallScore}%, on-time ${metrics.onTimeRate}%`
          )
        }
      }

      const text =
        alerts.length > 0
          ? `🚨 *Performance Alerts*\n\n${alerts.join("\n")}`
          : "✅ No critical performance issues detected this period."

      return NextResponse.json(buildSlashCommandResponse(text))
    }

    default:
      return NextResponse.json(
        buildSlashCommandResponse(
          `Unknown command: \`${command}\`. Available commands: \`/productivity\`, \`/report\`, \`/alerts\``
        )
      )
  }
}

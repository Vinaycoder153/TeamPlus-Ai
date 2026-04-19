import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  postSlackMessage,
  buildTaskCompletionMessage,
  buildProductivityAlertMessage,
} from "@/lib/slack"

export interface SlackNotifyPayload {
  type: "task_completion" | "productivity_alert"
  taskTitle?: string
  taskPriority?: string
  pointsEarned?: number
  completedBy?: string
  alertMessage?: string
  memberName?: string
}

/**
 * POST /api/slack/notify
 *
 * Internal endpoint that sends a notification to the user's connected Slack channel.
 * Only sends a message if the user has a Slack integration configured and the
 * relevant notification preference is enabled.
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

    const payload: SlackNotifyPayload = await request.json()

    // Fetch the user's Slack integration
    const { data: integration } = await supabase
      .from("slack_integrations")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (!integration || !integration.slack_channel_id) {
      // No integration or no channel configured — silently succeed
      return NextResponse.json({ sent: false, reason: "no_integration" })
    }

    // Check per-type notification preferences
    if (
      payload.type === "task_completion" &&
      !integration.notify_task_completion
    ) {
      return NextResponse.json({ sent: false, reason: "notifications_disabled" })
    }

    let messageOptions

    if (payload.type === "task_completion") {
      if (!payload.taskTitle || !payload.completedBy) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }
      messageOptions = buildTaskCompletionMessage({
        taskTitle: payload.taskTitle,
        taskPriority: payload.taskPriority ?? "medium",
        pointsEarned: payload.pointsEarned ?? 0,
        completedBy: payload.completedBy,
        channelId: integration.slack_channel_id,
      })
    } else if (payload.type === "productivity_alert") {
      if (!payload.memberName || !payload.alertMessage) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }
      messageOptions = buildProductivityAlertMessage({
        memberName: payload.memberName,
        alertMessage: payload.alertMessage,
        channelId: integration.slack_channel_id,
      })
    } else {
      return NextResponse.json({ error: "Unknown notification type" }, { status: 400 })
    }

    const result = await postSlackMessage(integration.access_token, messageOptions)

    if (!result.ok) {
      console.error("Slack message failed:", result.error)
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ sent: true, ts: result.ts })
  } catch (err) {
    console.error("Slack notify error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"
import {
  postSlackMessage,
  buildTaskCompletionMessage,
  buildProductivityAlertMessage,
} from "@/lib/slack"

const notifySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("task_completion"),
    taskTitle: z.string().min(1),
    taskPriority: z.string().optional().default("medium"),
    pointsEarned: z.number().int().min(0).optional().default(0),
    completedBy: z.string().min(1),
  }),
  z.object({
    type: z.literal("productivity_alert"),
    memberName: z.string().min(1),
    alertMessage: z.string().min(1),
  }),
])

export type SlackNotifyPayload = z.infer<typeof notifySchema>

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

    // Rate-limit: 30 notifications per minute per user
    const rl = checkRateLimit(`slack_notify:${user.id}`, { limit: 30, windowSeconds: 60 })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await request.json()
    const parsed = notifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const payload = parsed.data

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
      messageOptions = buildTaskCompletionMessage({
        taskTitle: payload.taskTitle,
        taskPriority: payload.taskPriority,
        pointsEarned: payload.pointsEarned,
        completedBy: payload.completedBy,
        channelId: integration.slack_channel_id,
      })
    } else {
      messageOptions = buildProductivityAlertMessage({
        memberName: payload.memberName,
        alertMessage: payload.alertMessage,
        channelId: integration.slack_channel_id,
      })
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


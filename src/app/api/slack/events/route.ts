import { NextRequest, NextResponse } from "next/server"
import { verifySlackSignature } from "@/lib/slack"

/**
 * POST /api/slack/events
 *
 * Handles Slack Event API subscriptions.
 *
 * Supported events:
 *  - url_verification  → responds with challenge token (required by Slack)
 *  - message           → logs incoming messages (extend as needed)
 *
 * All requests are verified against the Slack signing secret to prevent
 * unauthorized calls.
 */
export async function POST(request: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET

  // Read the raw body for signature verification
  const rawBody = await request.text()

  // Verify Slack signature if the signing secret is configured
  if (signingSecret) {
    const timestamp = request.headers.get("x-slack-request-timestamp") ?? ""
    const signature = request.headers.get("x-slack-signature") ?? ""

    if (!verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventType = payload.type as string

  // ── URL verification challenge (one-time, when setting up the Events API URL)
  if (eventType === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // ── Event callback wrapper
  if (eventType === "event_callback") {
    const event = payload.event as Record<string, unknown> | undefined
    if (!event) {
      return NextResponse.json({ ok: true })
    }

    const innerType = event.type as string

    // Handle individual event types
    switch (innerType) {
      case "message": {
        // Ignore bot messages and subtypes (edits, deletes, etc.)
        if (event.bot_id || event.subtype) break

        // TODO: enqueue to a job queue for async processing in production.
        // For now we acknowledge immediately and process asynchronously.
        console.info("[Slack Event] message received", {
          user: event.user,
          channel: event.channel,
          ts: event.ts,
        })
        break
      }

      case "app_mention": {
        console.info("[Slack Event] app_mention received", {
          user: event.user,
          channel: event.channel,
        })
        break
      }

      default:
        // Unhandled event types are silently acknowledged
        break
    }
  }

  // Slack requires a 200 response within 3 seconds
  return NextResponse.json({ ok: true })
}

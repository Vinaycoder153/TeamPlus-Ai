import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listSlackChannels } from "@/lib/slack"
import { checkRateLimit } from "@/lib/rateLimit"

/**
 * GET /api/slack/channels
 *
 * Returns the list of Slack channels accessible by the bot in the user's
 * connected workspace. Used to populate the channel picker in Settings.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate-limit: 10 calls per minute per user
    const rl = checkRateLimit(`slack_channels:${user.id}`, { limit: 10, windowSeconds: 60 })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const { data: integration } = await supabase
      .from("slack_integrations")
      .select("access_token")
      .eq("user_id", user.id)
      .single()

    if (!integration?.access_token) {
      return NextResponse.json(
        { error: "No Slack integration found. Please connect Slack first." },
        { status: 404 }
      )
    }

    const result = await listSlackChannels(integration.access_token)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to fetch channels" },
        { status: 502 }
      )
    }

    const channels = (result.channels ?? [])
      .filter((c) => !c.is_archived)
      .map((c) => ({
        id: c.id,
        name: c.name,
        is_private: c.is_private,
        num_members: c.num_members ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ channels })
  } catch (err) {
    console.error("Slack channels error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

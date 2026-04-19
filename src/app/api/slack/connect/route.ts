import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomBytes } from "crypto"

/**
 * GET /api/slack/connect
 *
 * Initiates the Slack OAuth 2.0 flow. Generates a CSRF state token,
 * stores it in an HttpOnly cookie, and redirects the user to Slack's
 * authorization page.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "Slack integration is not configured on this server." },
      { status: 503 }
    )
  }

  // Generate a random CSRF state token
  const state = randomBytes(32).toString("hex")

  const redirectUri =
    process.env.SLACK_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/callback`

  const scopes = [
    "chat:write",
    "channels:read",
    "groups:read",
    "im:write",
    "mpim:write",
  ].join(",")

  const slackAuthUrl = new URL("https://slack.com/oauth/v2/authorize")
  slackAuthUrl.searchParams.set("client_id", clientId)
  slackAuthUrl.searchParams.set("scope", scopes)
  slackAuthUrl.searchParams.set("redirect_uri", redirectUri)
  slackAuthUrl.searchParams.set("state", state)

  const response = NextResponse.redirect(slackAuthUrl.toString())

  // Store state in an HttpOnly cookie for CSRF validation in the callback
  response.cookies.set("slack_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  })

  return response
}

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { exchangeSlackOAuthCode } from "@/lib/slack"

/**
 * GET /api/slack/callback
 *
 * Handles the Slack OAuth 2.0 callback after the user authorizes the app.
 * Validates the CSRF state token, exchanges the authorization code for an
 * access token, and persists the integration in Supabase.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  const settingsUrl = `${appUrl}/settings`

  try {
    const { searchParams } = request.nextUrl
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // User denied the authorization
    if (error) {
      const url = new URL(settingsUrl)
      url.searchParams.set("slack_error", error)
      return NextResponse.redirect(url.toString())
    }

    if (!code || !state) {
      const url = new URL(settingsUrl)
      url.searchParams.set("slack_error", "missing_params")
      return NextResponse.redirect(url.toString())
    }

    // Validate CSRF state token
    const cookieStore = await cookies()
    const savedState = cookieStore.get("slack_oauth_state")?.value

    if (!savedState || savedState !== state) {
      const url = new URL(settingsUrl)
      url.searchParams.set("slack_error", "invalid_state")
      return NextResponse.redirect(url.toString())
    }

    // Verify the authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${appUrl}/auth/login`)
    }

    // Exchange the authorization code for an access token
    const tokenData = await exchangeSlackOAuthCode(code)

    if (!tokenData.ok || !tokenData.access_token || !tokenData.team) {
      const url = new URL(settingsUrl)
      url.searchParams.set("slack_error", tokenData.error || "token_exchange_failed")
      return NextResponse.redirect(url.toString())
    }

    // Fetch the user's profile to get team_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single()

    // Upsert the Slack integration record
    const { error: upsertError } = await supabase
      .from("slack_integrations")
      .upsert(
        {
          user_id: user.id,
          team_id: profile?.team_id ?? null,
          slack_team_id: tokenData.team.id,
          slack_team_name: tokenData.team.name,
          access_token: tokenData.access_token,
          bot_user_id: tokenData.bot_user_id ?? null,
          authed_user_slack_id: tokenData.authed_user?.id ?? null,
          scope: tokenData.scope ?? null,
          notify_task_completion: true,
          notify_weekly_report: true,
        },
        { onConflict: "user_id" }
      )

    if (upsertError) {
      console.error("Failed to save Slack integration:", upsertError)
      const url = new URL(settingsUrl)
      url.searchParams.set("slack_error", "db_error")
      const response = NextResponse.redirect(url.toString())
      response.cookies.delete("slack_oauth_state")
      return response
    }

    // Clear the CSRF cookie and redirect to settings with success
    const url = new URL(settingsUrl)
    url.searchParams.set("slack_connected", "true")
    const response = NextResponse.redirect(url.toString())
    response.cookies.delete("slack_oauth_state")
    return response
  } catch (err) {
    console.error("Slack callback error:", err)
    const url = new URL(settingsUrl)
    url.searchParams.set("slack_error", "server_error")
    return NextResponse.redirect(url.toString())
  }
}

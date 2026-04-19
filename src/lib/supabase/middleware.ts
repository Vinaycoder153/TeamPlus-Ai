import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const isAuthPage = url.pathname.startsWith("/auth")
  const isDashboard =
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/team") ||
    url.pathname.startsWith("/tasks") ||
    url.pathname.startsWith("/insights") ||
    url.pathname.startsWith("/leaderboard") ||
    url.pathname.startsWith("/settings")

  // /api/slack/callback is the OAuth redirect — allow it without auth guard
  // so the session cookie exchange can complete before we check the user
  const isSlackCallback = url.pathname.startsWith("/api/slack/callback")

  if (!user && isDashboard) {
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Allow the Slack OAuth callback through without redirect
  if (isSlackCallback) {
    return supabaseResponse
  }

  return supabaseResponse
}

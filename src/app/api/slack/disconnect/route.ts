import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * DELETE /api/slack/disconnect
 *
 * Removes the Slack integration for the currently authenticated user.
 */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase
      .from("slack_integrations")
      .delete()
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Slack disconnect error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

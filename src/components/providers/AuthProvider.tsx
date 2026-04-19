"use client"

import React, { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAppStore } from "@/store/useAppStore"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setTeam, setTeamMembers } = useAppStore()

  useEffect(() => {
    const supabase = createClient()

    const loadUserData = async (userId: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      if (profile) {
        setUser(profile)

        if (profile.team_id) {
          const { data: team } = await supabase
            .from("teams")
            .select("*")
            .eq("id", profile.team_id)
            .single()

          if (team) setTeam(team)

          const { data: members } = await supabase
            .from("profiles")
            .select("*")
            .eq("team_id", profile.team_id)

          if (members) setTeamMembers(members)
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserData(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          loadUserData(session.user.id)
        } else {
          setUser(null)
          setTeam(null)
          setTeamMembers([])
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, setTeam, setTeamMembers])

  return <>{children}</>
}

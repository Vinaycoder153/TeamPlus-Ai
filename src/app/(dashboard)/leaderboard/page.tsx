"use client"

import React, { useEffect, useState } from "react"
import { Trophy, Medal, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAppStore } from "@/store/useAppStore"
import { createClient } from "@/lib/supabase/client"
import { rankTeamMembers } from "@/lib/scoring"
import { getLevelTitle, getBadgeById } from "@/lib/gamification"
import type { Task } from "@/types/database"

const RANK_ICONS = [
  <Trophy key="1" className="h-6 w-6 text-yellow-500" />,
  <Medal key="2" className="h-6 w-6 text-slate-400" />,
  <Medal key="3" className="h-6 w-6 text-amber-600" />,
]

export default function LeaderboardPage() {
  const { teamMembers, user } = useAppStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const loadTasks = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("tasks").select("*")
      if (data) setTasks(data)
      setIsLoading(false)
    }

    loadTasks()
  }, [user])

  const rankedMembers = rankTeamMembers(teamMembers, tasks)
  const currentUserRank = rankedMembers.find((m) => m.id === user?.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">Team performance rankings</p>
      </div>

      {/* Current User Highlight */}
      {currentUserRank && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 font-bold text-primary text-lg">
                #{currentUserRank.rank}
              </div>
              <Avatar className="h-10 w-10">
                <AvatarImage src={currentUserRank.avatar_url || undefined} />
                <AvatarFallback>
                  {(currentUserRank.full_name || currentUserRank.email).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">
                  {currentUserRank.full_name || "You"}
                  <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  {getLevelTitle(currentUserRank.level)} · Level {currentUserRank.level}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{currentUserRank.points}</p>
                <p className="text-xs text-muted-foreground">points</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Leaderboard */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading rankings...</div>
      ) : rankedMembers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No team members to rank yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rankedMembers.map((member) => {
            const isCurrentUser = member.id === user?.id
            const maxPoints = rankedMembers[0]?.points || 1

            return (
              <Card
                key={member.id}
                className={isCurrentUser ? "border-primary/40 bg-primary/5" : ""}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="w-10 flex items-center justify-center shrink-0">
                      {member.rank <= 3 ? (
                        RANK_ICONS[member.rank - 1]
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground">
                          #{member.rank}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback>
                        {(member.full_name || member.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{member.full_name || member.email}</p>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs py-0 shrink-0">You</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        <p className="text-xs text-muted-foreground">
                          Level {member.level} · {getLevelTitle(member.level)}
                        </p>
                        {member.badges.slice(0, 3).map((badgeId) => {
                          const badge = getBadgeById(badgeId)
                          return badge ? (
                            <span key={badgeId} title={badge.name} className="text-sm">
                              {badge.icon}
                            </span>
                          ) : null
                        })}
                      </div>
                      <div className="mt-2">
                        <Progress
                          value={(member.points / maxPoints) * 100}
                          className="h-1.5"
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-xl font-bold">{member.points}</p>
                      <p className="text-xs text-muted-foreground">pts</p>
                      <p className="text-xs text-muted-foreground">
                        {member.metrics.tasksCompleted} tasks
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

"use client"

import React, { useEffect, useState } from "react"
import { Users, Mail, Award, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAppStore } from "@/store/useAppStore"
import { createClient } from "@/lib/supabase/client"
import { calculatePerformanceScore } from "@/lib/scoring"
import { getLevelTitle, getBadgeById } from "@/lib/gamification"
import type { Task } from "@/types/database"

export default function TeamPage() {
  const { teamMembers, user } = useAppStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const loadTasks = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })

      if (data) setTasks(data)
      setIsLoading(false)
    }

    loadTasks()
  }, [user])

  const roleColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    admin: "destructive",
    manager: "default",
    member: "secondary",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Members</h1>
        <p className="text-muted-foreground">
          {teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""} in your team
        </p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading team data...</div>
      ) : teamMembers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No team members found. You may not be assigned to a team yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teamMembers.map((member) => {
            const metrics = calculatePerformanceScore(tasks, member.id)
            const levelTitle = getLevelTitle(member.level)
            const isCurrentUser = member.id === user?.id

            return (
              <Card key={member.id} className={isCurrentUser ? "border-primary/40" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-lg">
                          {(member.full_name || member.email).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold leading-none">
                            {member.full_name || "Unknown"}
                          </p>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs py-0">You</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{member.email}</p>
                      </div>
                    </div>
                    <Badge variant={roleColors[member.role] || "secondary"} className="text-xs">
                      {member.role}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Level & Points */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">Level {member.level}</span>
                      <span className="text-muted-foreground">· {levelTitle}</span>
                    </div>
                    <span className="font-semibold text-primary">{member.points} pts</span>
                  </div>

                  {/* Performance */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Performance
                      </span>
                      <span className="font-medium text-foreground">{metrics.overallScore}%</span>
                    </div>
                    <Progress value={metrics.overallScore} className="h-1.5" />
                  </div>

                  {/* Task Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-muted rounded-md p-2">
                      <p className="font-semibold text-base">{metrics.tasksCompleted}</p>
                      <p className="text-muted-foreground">Done</p>
                    </div>
                    <div className="bg-muted rounded-md p-2">
                      <p className="font-semibold text-base">{metrics.onTimeRate}%</p>
                      <p className="text-muted-foreground">On-time</p>
                    </div>
                    <div className="bg-muted rounded-md p-2">
                      <p className="font-semibold text-base">{member.badges.length}</p>
                      <p className="text-muted-foreground">Badges</p>
                    </div>
                  </div>

                  {/* Badges */}
                  {member.badges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {member.badges.slice(0, 4).map((badgeId) => {
                        const badge = getBadgeById(badgeId)
                        return badge ? (
                          <span key={badgeId} title={badge.name} className="text-base">
                            {badge.icon}
                          </span>
                        ) : null
                      })}
                      {member.badges.length > 4 && (
                        <span className="text-xs text-muted-foreground">+{member.badges.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* Department */}
                  {member.department && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {member.department}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

"use client"

import React, { useEffect, useState } from "react"
import {
  CheckSquare,
  Clock,
  TrendingUp,
  Users,
  Brain,
  Trophy,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAppStore } from "@/store/useAppStore"
import { createClient } from "@/lib/supabase/client"
import { calculatePerformanceScore } from "@/lib/scoring"
import { getPointsToNextLevel, getLevelTitle } from "@/lib/gamification"
import { SlackInsightsPanel } from "@/components/SlackInsightsPanel"
import type { Task } from "@/types/database"

export default function DashboardPage() {
  const { user, teamMembers, tasks, setTasks } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const loadTasks = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (data) setTasks(data)
      setIsLoading(false)
    }

    loadTasks()
  }, [user, setTasks])

  if (!user) return null

  const myTasks = tasks.filter((t) => t.assigned_to === user.id)
  const myMetrics = calculatePerformanceScore(tasks, user.id)
  const levelProgress = getPointsToNextLevel(user.points)
  const levelTitle = getLevelTitle(user.level)

  const completedTasks = myTasks.filter((t) => t.status === "done").length
  const inProgressTasks = myTasks.filter((t) => t.status === "in_progress").length
  const overdueTasks = myTasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done"
  ).length

  const recentTasks = myTasks.slice(0, 5)

  const statsCards = [
    {
      title: "Tasks Completed",
      value: completedTasks,
      icon: CheckSquare,
      color: "text-green-500",
      change: "+12% from last week",
      positive: true,
    },
    {
      title: "In Progress",
      value: inProgressTasks,
      icon: Clock,
      color: "text-blue-500",
      change: `${overdueTasks} overdue`,
      positive: overdueTasks === 0,
    },
    {
      title: "Performance Score",
      value: `${myMetrics.overallScore}%`,
      icon: TrendingUp,
      color: "text-purple-500",
      change: "On-time rate: " + myMetrics.onTimeRate + "%",
      positive: myMetrics.onTimeRate >= 70,
    },
    {
      title: "Team Size",
      value: teamMembers.length,
      icon: Users,
      color: "text-orange-500",
      change: "Active members",
      positive: true,
    },
  ]

  const priorityColors: Record<Task["priority"], string> = {
    urgent: "destructive",
    high: "destructive",
    medium: "secondary",
    low: "outline",
  }

  const statusColors: Record<Task["status"], string> = {
    done: "text-green-600",
    in_progress: "text-blue-600",
    review: "text-yellow-600",
    todo: "text-muted-foreground",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {user.full_name?.split(" ")[0] || "there"}! 👋
        </h1>
        <p className="text-muted-foreground">Here&apos;s your performance overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <div className="flex items-center gap-1 mt-1">
                {stat.positive ? (
                  <ArrowUp className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-red-500" />
                )}
                <p className={`text-xs ${stat.positive ? "text-green-500" : "text-red-500"}`}>
                  {stat.change}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Level Progress */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-base">Your Progress</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Level {user.level}</p>
                <p className="text-sm text-muted-foreground">{levelTitle}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-primary">{user.points}</p>
                <p className="text-sm text-muted-foreground">total points</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{levelProgress.current} XP</span>
                <span>{levelProgress.next} XP needed</span>
              </div>
              <Progress value={levelProgress.progress} className="h-2" />
            </div>

            {user.badges.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recent Badges</p>
                <div className="flex flex-wrap gap-1">
                  {user.badges.slice(-4).map((badge) => (
                    <span key={badge} className="text-lg" title={badge}>
                      {badge === "first_task" ? "🎯" :
                       badge === "task_master_10" ? "⚡" :
                       badge === "points_500" ? "💎" : "🏆"}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">Recent Tasks</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading tasks...</div>
            ) : recentTasks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tasks assigned yet</div>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </p>
                      <p className={`text-xs ${statusColors[task.status]}`}>
                        {task.status.replace("_", " ")}
                      </p>
                    </div>
                    <Badge variant={priorityColors[task.priority] as "destructive" | "secondary" | "outline" | "default"} className="shrink-0 text-xs">
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insight Teaser */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">AI Performance Insight</p>
              <p className="text-sm text-muted-foreground mt-1">
                {myMetrics.overallScore >= 80
                  ? `Excellent work! Your ${myMetrics.onTimeRate}% on-time completion rate is above average. Keep maintaining this momentum.`
                  : myMetrics.overallScore >= 60
                  ? `Good progress this week. Focus on reducing overdue tasks to improve your overall score.`
                  : `Let's work on improving your task completion rate. Consider breaking large tasks into smaller, manageable steps.`}
              </p>
              <p className="text-xs text-primary mt-2 font-medium">
                → View full insights in the AI Insights tab
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slack Productivity Insights */}
      <SlackInsightsPanel />
    </div>
  )
}

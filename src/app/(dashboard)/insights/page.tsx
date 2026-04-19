"use client"

import React, { useEffect, useState } from "react"
import { Brain, RefreshCw, Loader2, TrendingUp, Users, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/store/useAppStore"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import type { AiInsight } from "@/types/database"

const INSIGHT_ICONS: Record<AiInsight["insight_type"], React.ReactNode> = {
  weekly_summary: <TrendingUp className="h-5 w-5 text-blue-500" />,
  individual_feedback: <Brain className="h-5 w-5 text-purple-500" />,
  team_health: <Users className="h-5 w-5 text-green-500" />,
  risk_alert: <AlertTriangle className="h-5 w-5 text-red-500" />,
}

const INSIGHT_LABELS: Record<AiInsight["insight_type"], string> = {
  weekly_summary: "Weekly Summary",
  individual_feedback: "Individual Feedback",
  team_health: "Team Health",
  risk_alert: "Risk Alert",
}

const INSIGHT_BADGE_VARIANTS: Record<AiInsight["insight_type"], "default" | "secondary" | "destructive" | "outline"> = {
  weekly_summary: "default",
  individual_feedback: "secondary",
  team_health: "outline",
  risk_alert: "destructive",
}

export default function InsightsPage() {
  const { user, insights, setInsights } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!user) return

    const loadInsights = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("ai_insights")
        .select("*")
        .or(`user_id.eq.${user.id},team_id.eq.${user.team_id || "00000000-0000-0000-0000-000000000000"}`)
        .order("created_at", { ascending: false })
        .limit(20)

      if (data) setInsights(data)
      setIsLoading(false)
    }

    loadInsights()
  }, [user, setInsights])

  const generateWeeklyInsight = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch("/api/insights/weekly", { method: "POST" })
      const data = await response.json()

      if (response.ok && data.insight) {
        setInsights([data.insight, ...insights])
        toast({ title: "New insight generated!", description: "Your weekly team summary is ready." })
      } else {
        throw new Error(data.error || "Failed to generate insight")
      }
    } catch (error) {
      toast({
        title: "Failed to generate insight",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const generateIndividualInsight = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch("/api/insights/individual", { method: "POST" })
      const data = await response.json()

      if (response.ok && data.insight) {
        setInsights([data.insight, ...insights])
        toast({ title: "Personal insight ready!", description: "Your individual feedback has been generated." })
      } else {
        throw new Error(data.error || "Failed to generate insight")
      }
    } catch (error) {
      toast({
        title: "Failed to generate insight",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Insights</h1>
          <p className="text-muted-foreground">AI-powered performance analysis and recommendations</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generateIndividualInsight}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
            My Feedback
          </Button>
          <Button size="sm" onClick={generateWeeklyInsight} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Team Summary
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{insights.filter((i) => i.insight_type === "weekly_summary").length}</p>
              <p className="text-sm text-muted-foreground">Weekly Summaries</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Brain className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{insights.filter((i) => i.insight_type === "individual_feedback").length}</p>
              <p className="text-sm text-muted-foreground">Personal Feedback</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{insights.filter((i) => i.insight_type === "risk_alert").length}</p>
              <p className="text-sm text-muted-foreground">Risk Alerts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Insights</h2>

        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading insights...</div>
        ) : insights.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-medium">No insights yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click &quot;Team Summary&quot; or &quot;My Feedback&quot; to generate your first AI insight
              </p>
            </CardContent>
          </Card>
        ) : (
          insights.map((insight) => (
            <Card key={insight.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {INSIGHT_ICONS[insight.insight_type]}
                    <CardTitle className="text-base">{INSIGHT_LABELS[insight.insight_type]}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={INSIGHT_BADGE_VARIANTS[insight.insight_type]}>
                      {INSIGHT_LABELS[insight.insight_type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(insight.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{insight.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

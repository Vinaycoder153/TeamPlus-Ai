"use client"

import React, { useEffect, useState } from "react"
import { MessageSquare, Zap, EyeOff, AlertTriangle, RefreshCw, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface MemberSummary {
  userId: string
  name: string
  totalMessages: number
  activeDays: number
  dominantSignal: string
}

interface SlackInsightsData {
  mostActiveCommunicator: MemberSummary | null
  silentButProductive: MemberSummary | null
  highDistractionRisk: MemberSummary | null
  memberSummaries: MemberSummary[]
  periodDays: number
}

const SIGNAL_LABELS: Record<string, string> = {
  high_productivity: "High Productivity",
  distraction_risk: "Distraction Risk",
  deep_work: "Deep Work Mode",
  low_activity: "Low Activity",
  unknown: "Analysing…",
}

const SIGNAL_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  high_productivity: "default",
  distraction_risk: "destructive",
  deep_work: "secondary",
  low_activity: "outline",
  unknown: "outline",
}

export function SlackInsightsPanel() {
  const [data, setData] = useState<SlackInsightsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/slack/insights?days=7")
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Failed to load Slack insights")
      } else if (json.insights) {
        setData(json.insights)
      } else {
        setData(null)
      }
    } catch {
      setError("Failed to load Slack insights")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#4A154B]" />
            <CardTitle className="text-base">Slack Productivity Insights</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchInsights}
            disabled={isLoading}
            aria-label="Refresh Slack insights"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Slack insights…
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            No Slack activity data yet. Sync a channel to see team insights.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Based on last {data.periodDays} days of Slack activity
            </p>

            {/* Highlight cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Most active communicator */}
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Most Active
                </div>
                {data.mostActiveCommunicator ? (
                  <>
                    <p className="text-sm font-semibold truncate">
                      {data.mostActiveCommunicator.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.mostActiveCommunicator.totalMessages} messages
                    </p>
                    <Badge
                      variant={SIGNAL_VARIANTS[data.mostActiveCommunicator.dominantSignal] ?? "outline"}
                      className="text-xs"
                    >
                      {SIGNAL_LABELS[data.mostActiveCommunicator.dominantSignal] ?? "Unknown"}
                    </Badge>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No data</p>
                )}
              </div>

              {/* Silent but productive */}
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <EyeOff className="h-3.5 w-3.5" />
                  Deep Work Mode
                </div>
                {data.silentButProductive ? (
                  <>
                    <p className="text-sm font-semibold truncate">
                      {data.silentButProductive.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.silentButProductive.totalMessages} messages,{" "}
                      {data.silentButProductive.activeDays} active days
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      Silent but Productive
                    </Badge>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No deep-work members detected</p>
                )}
              </div>

              {/* High distraction risk */}
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Distraction Risk
                </div>
                {data.highDistractionRisk ? (
                  <>
                    <p className="text-sm font-semibold truncate">
                      {data.highDistractionRisk.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      High messaging, low task output
                    </p>
                    <Badge variant="destructive" className="text-xs">
                      Needs Attention
                    </Badge>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No distraction risks detected</p>
                )}
              </div>
            </div>

            {/* Full member list */}
            {data.memberSummaries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  All Members
                </p>
                <div className="space-y-2">
                  {data.memberSummaries.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{member.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {member.totalMessages} msgs
                        </span>
                      </div>
                      <Badge
                        variant={SIGNAL_VARIANTS[member.dominantSignal] ?? "outline"}
                        className="text-xs shrink-0 ml-2"
                      >
                        {SIGNAL_LABELS[member.dominantSignal] ?? "Unknown"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

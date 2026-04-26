"use client"

import React, { Suspense, useEffect, useState } from "react"
import {
  MessageSquare,
  Link2,
  Link2Off,
  Loader2,
  CheckCircle2,
  Hash,
  ChevronDown,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/store/useAppStore"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import type { SlackIntegration } from "@/types/database"
import { useSearchParams } from "next/navigation"

const SLACK_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You cancelled the Slack authorization. Please try again.",
  invalid_state: "Authorization failed due to a security check. Please try again.",
  missing_params: "The authorization response was incomplete. Please try again.",
  db_error: "Failed to save your Slack integration. Please try again.",
  server_error: "An unexpected error occurred. Please try again.",
  token_exchange_failed: "Failed to exchange authorization code. Please try again.",
}

interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  num_members: number | null
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-sm">Loading…</div>}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const { user } = useAppStore()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [integration, setIntegration] = useState<SlackIntegration | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [channelId, setChannelId] = useState("")
  const [channelName, setChannelName] = useState("")
  const [isSavingChannel, setIsSavingChannel] = useState(false)

  // Channel picker state
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [isFetchingChannels, setIsFetchingChannels] = useState(false)
  const [showChannelPicker, setShowChannelPicker] = useState(false)

  // Show feedback based on OAuth redirect params
  useEffect(() => {
    const connected = searchParams.get("slack_connected")
    const error = searchParams.get("slack_error")

    if (connected === "true") {
      toast({
        title: "Slack connected! 🎉",
        description: "Your Slack workspace has been linked successfully.",
      })
    } else if (error) {
      toast({
        title: "Slack connection failed",
        description: SLACK_ERROR_MESSAGES[error] || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    }
  }, [searchParams, toast])

  useEffect(() => {
    if (!user) return

    const loadIntegration = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("slack_integrations")
        .select("*")
        .eq("user_id", user.id)
        .single()

      if (data) {
        setIntegration(data)
        setChannelId(data.slack_channel_id ?? "")
        setChannelName(data.slack_channel_name ?? "")
      }
      setIsLoading(false)
    }

    loadIntegration()
  }, [user])

  const handleConnect = () => {
    window.location.href = "/api/slack/connect"
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const response = await fetch("/api/slack/disconnect", { method: "DELETE" })
      if (response.ok) {
        setIntegration(null)
        setChannelId("")
        setChannelName("")
        setChannels([])
        toast({ title: "Slack disconnected", description: "Your Slack workspace has been unlinked." })
      } else {
        throw new Error("Failed to disconnect")
      }
    } catch {
      toast({ title: "Failed to disconnect Slack", variant: "destructive" })
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleSaveChannel = async () => {
    if (!user || !integration || !channelId.trim()) return
    setIsSavingChannel(true)

    const supabase = createClient()
    const { error } = await supabase
      .from("slack_integrations")
      .update({
        slack_channel_id: channelId.trim(),
        slack_channel_name: channelName.trim() || channelId.trim(),
      })
      .eq("user_id", user.id)

    if (error) {
      toast({ title: "Failed to save channel", variant: "destructive" })
    } else {
      setIntegration((prev) =>
        prev
          ? {
              ...prev,
              slack_channel_id: channelId.trim(),
              slack_channel_name: channelName.trim() || channelId.trim(),
            }
          : prev
      )
      setShowChannelPicker(false)
      toast({ title: "Channel saved!", description: "Notifications will be sent to this channel." })
    }
    setIsSavingChannel(false)
  }

  const handleFetchChannels = async () => {
    setIsFetchingChannels(true)
    setShowChannelPicker(true)
    try {
      const res = await fetch("/api/slack/channels")
      const json = await res.json()
      if (res.ok) {
        setChannels(json.channels ?? [])
      } else {
        toast({
          title: "Failed to fetch channels",
          description: json.error ?? "Check that your bot is invited to the workspace.",
          variant: "destructive",
        })
        setShowChannelPicker(false)
      }
    } catch {
      toast({ title: "Failed to fetch channels", variant: "destructive" })
      setShowChannelPicker(false)
    } finally {
      setIsFetchingChannels(false)
    }
  }

  const handleSelectChannel = (channel: SlackChannel) => {
    setChannelId(channel.id)
    setChannelName(channel.name)
    setShowChannelPicker(false)
  }

  const handleTogglePreference = async (
    key: "notify_task_completion" | "notify_weekly_report",
    value: boolean
  ) => {
    if (!user || !integration) return

    const supabase = createClient()
    const updatePayload =
      key === "notify_task_completion"
        ? { notify_task_completion: value }
        : { notify_weekly_report: value }

    const { error } = await supabase
      .from("slack_integrations")
      .update(updatePayload)
      .eq("user_id", user.id)

    if (!error) {
      setIntegration((prev) => (prev ? { ...prev, [key]: value } : prev))
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage integrations and account preferences</p>
      </div>

      {/* Slack Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#4A154B]/10">
              <MessageSquare className="h-5 w-5 text-[#4A154B]" />
            </div>
            <div>
              <CardTitle className="text-base">Slack Integration</CardTitle>
              <CardDescription>
                Push task updates, productivity alerts, and AI weekly reports to your Slack workspace
              </CardDescription>
            </div>
            {integration && (
              <Badge className="ml-auto" variant="secondary">
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading integration…
            </div>
          ) : integration ? (
            <>
              {/* Workspace info */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {integration.slack_team_name ?? "Slack Workspace"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Team ID: {integration.slack_team_id}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2Off className="h-4 w-4 mr-1.5" />
                  )}
                  Disconnect
                </Button>
              </div>

              {/* Channel configuration */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Notification Channel</Label>
                <p className="text-xs text-muted-foreground">
                  Select a channel from your workspace or enter the channel ID manually.
                  The bot must be invited to the channel first.
                </p>

                {/* Channel picker */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Channel or DM ID"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Input
                    placeholder="Display name (optional)"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFetchChannels}
                    disabled={isFetchingChannels}
                    title="Browse channels"
                  >
                    {isFetchingChannels ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveChannel}
                    disabled={isSavingChannel || !channelId.trim()}
                  >
                    {isSavingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>

                {/* Inline channel list picker */}
                {showChannelPicker && channels.length > 0 && (
                  <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                    {channels.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                        onClick={() => handleSelectChannel(ch)}
                      >
                        <span className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          {ch.name}
                          {ch.is_private && (
                            <Badge variant="outline" className="text-xs py-0 px-1">
                              private
                            </Badge>
                          )}
                        </span>
                        {ch.num_members != null && (
                          <span className="text-xs text-muted-foreground">{ch.num_members} members</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {integration.slack_channel_id && (
                  <p className="text-xs text-green-600">
                    ✓ Notifications will be sent to{" "}
                    <strong>{integration.slack_channel_name || integration.slack_channel_id}</strong>
                  </p>
                )}
              </div>

              <Separator />

              {/* Notification preferences */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Notification Preferences</Label>
                <div className="space-y-2">
                  <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">Task completions</p>
                      <p className="text-xs text-muted-foreground">
                        Notify when you mark a task as done
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={integration.notify_task_completion}
                      onChange={(e) =>
                        handleTogglePreference("notify_task_completion", e.target.checked)
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">Weekly AI reports</p>
                      <p className="text-xs text-muted-foreground">
                        Send AI-generated weekly team summaries to Slack
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={integration.notify_weekly_report}
                      onChange={(e) =>
                        handleTogglePreference("notify_weekly_report", e.target.checked)
                      }
                    />
                  </label>
                </div>
              </div>

              {/* Activity sync */}
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Activity Sync</Label>
                <p className="text-xs text-muted-foreground">
                  Sync Slack channel activity to generate productivity insights on the dashboard.
                  Requires a configured notification channel.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!integration.slack_channel_id}
                  onClick={async () => {
                    if (!integration.slack_channel_id) return
                    try {
                      const res = await fetch("/api/slack/activity", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          channelId: integration.slack_channel_id,
                          channelName: integration.slack_channel_name ?? undefined,
                          lookbackHours: 24,
                        }),
                      })
                      const json = await res.json()
                      if (res.ok) {
                        toast({
                          title: "Activity synced!",
                          description: `Detected ${json.metrics?.messageCount ?? 0} messages. Signal: ${json.metrics?.productivitySignal ?? "unknown"}`,
                        })
                      } else {
                        toast({
                          title: "Sync failed",
                          description: json.error ?? "Please try again.",
                          variant: "destructive",
                        })
                      }
                    } catch {
                      toast({ title: "Sync failed", variant: "destructive" })
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Sync Now
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-[#4A154B]/10 mx-auto">
                <MessageSquare className="h-7 w-7 text-[#4A154B]" />
              </div>
              <div>
                <p className="font-medium">Connect your Slack workspace</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Receive real-time task notifications and AI-powered weekly reports directly in Slack
                </p>
              </div>
              <Button onClick={handleConnect} className="gap-2">
                <Link2 className="h-4 w-4" />
                Connect Slack
              </Button>
              <p className="text-xs text-muted-foreground">
                You&apos;ll be redirected to Slack to authorize the TeamPulse AI app
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

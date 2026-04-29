/**
 * Slack Web API utility for TeamPulse AI.
 * Uses the Slack Web API directly via fetch to avoid extra dependencies.
 */

import { createHmac } from "crypto"

const SLACK_API_BASE = "https://slack.com/api"

export interface SlackMessageBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  fields?: Array<{ type: string; text: string }>
  elements?: Array<{ type: string; text?: { type: string; text: string }; action_id?: string }>
}

export interface SlackPostMessageOptions {
  channel: string
  text: string
  blocks?: SlackMessageBlock[]
}

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_archived: boolean
  num_members?: number
}

export interface SlackMessage {
  type: string
  user?: string
  text?: string
  ts: string
}

export type ProductivitySignal =
  | "high_productivity"
  | "distraction_risk"
  | "deep_work"
  | "low_activity"
  | "unknown"

export interface ActivityMetrics {
  messageCount: number
  peakHour: number | null
  avgResponseTimeMinutes: number | null
  productivitySignal: ProductivitySignal
}

/**
 * Post a message to a Slack channel using a bot access token.
 */
export async function postSlackMessage(
  accessToken: string,
  options: SlackPostMessageOptions
): Promise<{ ok: boolean; error?: string; ts?: string }> {
  const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(options),
  })

  const data = await response.json()
  return data as { ok: boolean; error?: string; ts?: string }
}

/**
 * Exchange a temporary OAuth code for a permanent access token.
 */
export async function exchangeSlackOAuthCode(code: string): Promise<{
  ok: boolean
  access_token?: string
  scope?: string
  bot_user_id?: string
  team?: { id: string; name: string }
  authed_user?: { id: string }
  error?: string
}> {
  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  const redirectUri = process.env.SLACK_REDIRECT_URI

  if (!clientId || !clientSecret) {
    return { ok: false, error: "Slack credentials not configured" }
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  })

  const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })

  return response.json()
}

/**
 * Fetch the list of public/private channels the bot has access to.
 */
export async function listSlackChannels(
  accessToken: string,
  types = "public_channel,private_channel"
): Promise<{ ok: boolean; channels?: SlackChannel[]; error?: string }> {
  const params = new URLSearchParams({
    types,
    exclude_archived: "true",
    limit: "200",
  })

  const response = await fetch(`${SLACK_API_BASE}/conversations.list?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await response.json()
  return data as { ok: boolean; channels?: SlackChannel[]; error?: string }
}

/**
 * Fetch recent messages from a Slack channel.
 * Returns at most `limit` messages from the last `lookbackHours` hours.
 */
export async function fetchChannelMessages(
  accessToken: string,
  channelId: string,
  options: { limit?: number; lookbackHours?: number } = {}
): Promise<{ ok: boolean; messages?: SlackMessage[]; error?: string }> {
  const { limit = 200, lookbackHours = 24 } = options
  const oldest = ((Date.now() - lookbackHours * 60 * 60 * 1000) / 1000).toFixed(0)

  const params = new URLSearchParams({
    channel: channelId,
    limit: String(limit),
    oldest,
  })

  const response = await fetch(
    `${SLACK_API_BASE}/conversations.history?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  const data = await response.json()
  return data as { ok: boolean; messages?: SlackMessage[]; error?: string }
}

/**
 * Derive per-user activity metrics from a list of channel messages.
 */
export function computeUserActivityMetrics(
  messages: SlackMessage[],
  slackUserId: string
): ActivityMetrics {
  const userMessages = messages.filter((m) => m.user === slackUserId)
  const messageCount = userMessages.length

  if (messageCount === 0) {
    return {
      messageCount: 0,
      peakHour: null,
      avgResponseTimeMinutes: null,
      productivitySignal: "low_activity",
    }
  }

  // Derive peak hour
  const hourCounts = new Map<number, number>()
  for (const msg of userMessages) {
    const hour = new Date(Number(msg.ts) * 1000).getUTCHours()
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }
  const peakHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]

  // Average gap between consecutive user messages (response time proxy)
  let avgResponseTimeMinutes: number | null = null
  if (userMessages.length >= 2) {
    const timestamps = userMessages.map((m) => Number(m.ts)).sort((a, b) => a - b)
    const gaps: number[] = []
    for (let i = 1; i < timestamps.length; i++) {
      gaps.push((timestamps[i] - timestamps[i - 1]) / 60)
    }
    avgResponseTimeMinutes = gaps.reduce((s, g) => s + g, 0) / gaps.length
  }

  return {
    messageCount,
    peakHour,
    avgResponseTimeMinutes,
    productivitySignal: "unknown", // enriched downstream after merging task metrics
  }
}

/**
 * Map Slack activity + task metrics to a productivity signal.
 *
 * Rules:
 *  - High messages + high task completion → high_productivity
 *  - High messages + low task completion  → distraction_risk
 *  - Low messages  + high task completion → deep_work
 *  - Low messages  + low task completion  → low_activity
 */
export function mapProductivitySignal(
  messageCount: number,
  taskCompletionRate: number // 0–100
): ProductivitySignal {
  const highActivity = messageCount >= 10
  const highCompletion = taskCompletionRate >= 60

  if (highActivity && highCompletion) return "high_productivity"
  if (highActivity && !highCompletion) return "distraction_risk"
  if (!highActivity && highCompletion) return "deep_work"
  if (messageCount === 0) return "low_activity"
  return "low_activity"
}

/**
 * Verify a Slack request signature.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string,
  signature: string
): boolean {
  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > 300) return false

  const baseString = `v0:${timestamp}:${rawBody}`
  const expected = `v0=${createHmac("sha256", signingSecret).update(baseString).digest("hex")}`

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Build a Slack message for a task completion event.
 */
export function buildTaskCompletionMessage(params: {
  taskTitle: string
  taskPriority: string
  pointsEarned: number
  completedBy: string
  channelId: string
}): SlackPostMessageOptions {
  return {
    channel: params.channelId,
    text: `✅ Task completed: *${params.taskTitle}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *Task Completed!*\n*${params.taskTitle}*`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Completed by:*\n${params.completedBy}` },
          { type: "mrkdwn", text: `*Priority:*\n${params.taskPriority}` },
          { type: "mrkdwn", text: `*Points earned:*\n+${params.pointsEarned} pts` },
        ],
      },
    ],
  }
}

/**
 * Build a Slack message for a weekly AI team report.
 */
export function buildWeeklyReportMessage(params: {
  teamName: string
  reportContent: string
  channelId: string
}): SlackPostMessageOptions {
  // Truncate content to stay within Slack's block text limit (3000 chars)
  const truncated =
    params.reportContent.length > 2900
      ? params.reportContent.slice(0, 2900) + "…"
      : params.reportContent

  return {
    channel: params.channelId,
    text: `📊 Weekly Team Report for ${params.teamName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📊 *Weekly Team Report — ${params.teamName}*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: truncated,
        },
      },
    ],
  }
}

/**
 * Build a Slack message for a productivity alert.
 */
export function buildProductivityAlertMessage(params: {
  memberName: string
  alertMessage: string
  channelId: string
}): SlackPostMessageOptions {
  return {
    channel: params.channelId,
    text: `⚠️ Productivity alert for ${params.memberName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `⚠️ *Productivity Alert*\n*${params.memberName}*: ${params.alertMessage}`,
        },
      },
    ],
  }
}

/**
 * Build a Slack response for slash commands (ephemeral by default).
 */
export function buildSlashCommandResponse(
  text: string,
  responseType: "ephemeral" | "in_channel" = "ephemeral"
): Record<string, unknown> {
  return {
    response_type: responseType,
    text,
  }
}


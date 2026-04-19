/**
 * Slack Web API utility for TeamPulse AI.
 * Uses the Slack Web API directly via fetch to avoid extra dependencies.
 */

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

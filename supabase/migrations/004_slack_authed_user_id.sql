-- Add authed_user_slack_id column to slack_integrations
-- This stores the Slack user ID of the person who authorized the app,
-- distinct from bot_user_id which is the bot's identity.
ALTER TABLE public.slack_integrations
  ADD COLUMN IF NOT EXISTS authed_user_slack_id TEXT;

-- Fix missing INSERT policy for ai_insights
-- Without this, authenticated API routes cannot insert new insights
CREATE POLICY "Users can insert insights" ON public.ai_insights
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    (
      team_id IS NOT NULL AND
      team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Slack integrations table
-- Stores OAuth tokens for connecting user/team Slack workspaces
CREATE TABLE IF NOT EXISTS public.slack_integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  slack_team_id TEXT NOT NULL,
  slack_team_name TEXT,
  slack_channel_id TEXT,
  slack_channel_name TEXT,
  access_token TEXT NOT NULL,
  bot_user_id TEXT,
  scope TEXT,
  notify_task_completion BOOLEAN NOT NULL DEFAULT true,
  notify_weekly_report BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Row Level Security for slack_integrations
ALTER TABLE public.slack_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Slack integration" ON public.slack_integrations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own Slack integration" ON public.slack_integrations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own Slack integration" ON public.slack_integrations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own Slack integration" ON public.slack_integrations
  FOR DELETE USING (user_id = auth.uid());

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_slack_integrations_updated_at
  BEFORE UPDATE ON public.slack_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

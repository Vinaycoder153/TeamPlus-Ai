-- Activity logs table: stores Slack channel message metrics per user per day
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  slack_user_id TEXT,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  -- Date this activity snapshot covers (UTC day boundary)
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  -- Hour-of-day (0-23) with the most messages — null if no messages
  peak_hour INTEGER CHECK (peak_hour IS NULL OR (peak_hour >= 0 AND peak_hour <= 23)),
  -- Average minutes between first and last message timestamps
  avg_response_time_minutes DECIMAL(8,2),
  -- Productivity classification derived from Slack + task metrics
  productivity_signal TEXT CHECK (
    productivity_signal IN (
      'high_productivity',
      'distraction_risk',
      'deep_work',
      'low_activity',
      'unknown'
    )
  ) DEFAULT 'unknown',
  raw_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, channel_id, activity_date)
);

-- Row Level Security
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity logs" ON public.activity_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Managers can view team activity logs" ON public.activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND team_id = activity_logs.team_id
    )
  );

CREATE POLICY "System can insert activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update activity logs" ON public.activity_logs
  FOR UPDATE USING (true);

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_activity_logs_updated_at
  BEFORE UPDATE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast team/date range queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_team_date
  ON public.activity_logs(team_id, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date
  ON public.activity_logs(user_id, activity_date DESC);

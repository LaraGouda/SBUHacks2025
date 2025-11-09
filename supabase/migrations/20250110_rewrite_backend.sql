-- Complete Backend and Database Rework
-- This migration creates a normalized, scalable database structure

-- ============================================================================
-- 1. USER PROFILES TABLE
-- ============================================================================
-- Store additional user profile information
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. OAUTH TOKENS TABLE
-- ============================================================================
-- Store Google OAuth tokens securely
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- ============================================================================
-- 3. MEETINGS TABLE (Improved)
-- ============================================================================
-- Drop old meetings table if exists and recreate with better structure
DROP TABLE IF EXISTS public.meetings CASCADE;

CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  transcript TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'analyzed' CHECK (status IN ('pending', 'analyzing', 'analyzed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. TASKS TABLE
-- ============================================================================
-- Normalize tasks into their own table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. EMAIL DRAFTS TABLE
-- ============================================================================
-- Store email drafts separately
CREATE TABLE IF NOT EXISTS public.email_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  recipient TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'scheduled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. CALENDAR EVENTS TABLE
-- ============================================================================
-- Store calendar events separately
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone TEXT,
  location TEXT,
  google_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. BLOCKERS TABLE
-- ============================================================================
-- Store blockers/issues separately
CREATE TABLE IF NOT EXISTS public.blockers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON public.meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON public.meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(status);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON public.tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON public.tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_email_drafts_user_id ON public.email_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_meeting_id ON public.email_drafts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON public.email_drafts(status);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_meeting_id ON public.calendar_events(meeting_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON public.calendar_events(start_time);

CREATE INDEX IF NOT EXISTS idx_blockers_user_id ON public.blockers(user_id);
CREATE INDEX IF NOT EXISTS idx_blockers_meeting_id ON public.blockers(meeting_id);
CREATE INDEX IF NOT EXISTS idx_blockers_resolved ON public.blockers(resolved);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON public.oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON public.oauth_tokens(provider);

-- ============================================================================
-- 9. TRIGGERS FOR UPDATED_AT
-- ============================================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_drafts_updated_at
  BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blockers_updated_at
  BEFORE UPDATE ON public.blockers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 10. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockers ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- OAuth Tokens Policies
CREATE POLICY "Users can view their own oauth tokens"
  ON public.oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own oauth tokens"
  ON public.oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own oauth tokens"
  ON public.oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own oauth tokens"
  ON public.oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Meetings Policies
CREATE POLICY "Users can view their own meetings"
  ON public.meetings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meetings"
  ON public.meetings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meetings"
  ON public.meetings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meetings"
  ON public.meetings FOR DELETE
  USING (auth.uid() = user_id);

-- Tasks Policies
CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Email Drafts Policies
CREATE POLICY "Users can view their own email drafts"
  ON public.email_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email drafts"
  ON public.email_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email drafts"
  ON public.email_drafts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email drafts"
  ON public.email_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- Calendar Events Policies
CREATE POLICY "Users can view their own calendar events"
  ON public.calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events"
  ON public.calendar_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events"
  ON public.calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- Blockers Policies
CREATE POLICY "Users can view their own blockers"
  ON public.blockers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own blockers"
  ON public.blockers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blockers"
  ON public.blockers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blockers"
  ON public.blockers FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 11. DATABASE FUNCTIONS
-- ============================================================================

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to get user dashboard stats
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'total_meetings', (SELECT COUNT(*) FROM public.meetings WHERE user_id = p_user_id),
    'total_tasks', (SELECT COUNT(*) FROM public.tasks WHERE user_id = p_user_id),
    'completed_tasks', (SELECT COUNT(*) FROM public.tasks WHERE user_id = p_user_id AND completed = true),
    'pending_tasks', (SELECT COUNT(*) FROM public.tasks WHERE user_id = p_user_id AND completed = false),
    'pending_emails', (SELECT COUNT(*) FROM public.email_drafts WHERE user_id = p_user_id AND status = 'draft'),
    'upcoming_events', (SELECT COUNT(*) FROM public.calendar_events WHERE user_id = p_user_id AND start_time > now()),
    'active_blockers', (SELECT COUNT(*) FROM public.blockers WHERE user_id = p_user_id AND resolved = false)
  ) INTO v_stats;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to save meeting analysis results
CREATE OR REPLACE FUNCTION public.save_meeting_analysis(
  p_user_id UUID,
  p_title TEXT,
  p_transcript TEXT,
  p_summary TEXT,
  p_tasks JSONB,
  p_email_subject TEXT,
  p_email_body TEXT,
  p_calendar_events JSONB,
  p_blockers JSONB
)
RETURNS UUID AS $$
DECLARE
  v_meeting_id UUID;
  v_task JSONB;
  v_event JSONB;
  v_blocker JSONB;
BEGIN
  -- Insert meeting
  INSERT INTO public.meetings (user_id, title, transcript, summary, status)
  VALUES (p_user_id, p_title, p_transcript, p_summary, 'analyzed')
  RETURNING id INTO v_meeting_id;

  -- Insert tasks
  IF p_tasks IS NOT NULL THEN
    FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
    LOOP
      INSERT INTO public.tasks (meeting_id, user_id, description)
      VALUES (
        v_meeting_id, 
        p_user_id, 
        COALESCE(
          v_task->>'description',
          CASE 
            WHEN jsonb_typeof(v_task) = 'string' THEN v_task #>> '{}'
            ELSE v_task->>'description'
          END,
          v_task::TEXT
        )
      );
    END LOOP;
  END IF;

  -- Insert email draft
  IF p_email_body IS NOT NULL THEN
    INSERT INTO public.email_drafts (meeting_id, user_id, subject, body, status)
    VALUES (v_meeting_id, p_user_id, p_email_subject, p_email_body, 'draft');
  END IF;

  -- Insert calendar events
  IF p_calendar_events IS NOT NULL THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_calendar_events)
    LOOP
      INSERT INTO public.calendar_events (
        meeting_id, user_id, title, description, start_time, end_time
      )
      VALUES (
        v_meeting_id,
        p_user_id,
        v_event->>'title'::TEXT,
        v_event->>'description'::TEXT,
        (v_event->>'start_time')::TIMESTAMP WITH TIME ZONE,
        (v_event->>'end_time')::TIMESTAMP WITH TIME ZONE
      );
    END LOOP;
  END IF;

  -- Insert blockers
  IF p_blockers IS NOT NULL THEN
    FOR v_blocker IN SELECT * FROM jsonb_array_elements(p_blockers)
    LOOP
      INSERT INTO public.blockers (meeting_id, user_id, description, severity)
      VALUES (
        v_meeting_id,
        p_user_id,
        v_blocker->>'description'::TEXT,
        COALESCE(v_blocker->>'severity'::TEXT, 'medium')
      );
    END LOOP;
  END IF;

  RETURN v_meeting_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


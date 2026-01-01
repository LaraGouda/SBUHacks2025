-- Update save_meeting_analysis to persist task priority and raw analysis payload
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS raw_analysis JSONB;

CREATE OR REPLACE FUNCTION public.save_meeting_analysis(
  p_user_id UUID,
  p_title TEXT,
  p_transcript TEXT,
  p_summary TEXT,
  p_tasks JSONB,
  p_email_subject TEXT,
  p_email_body TEXT,
  p_calendar_events JSONB,
  p_blockers JSONB,
  p_raw_analysis JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_meeting_id UUID;
  v_task JSONB;
  v_event JSONB;
  v_blocker JSONB;
  v_priority TEXT;
BEGIN
  -- Insert meeting
  INSERT INTO public.meetings (user_id, title, transcript, summary, status, raw_analysis)
  VALUES (p_user_id, p_title, p_transcript, p_summary, 'analyzed', p_raw_analysis)
  RETURNING id INTO v_meeting_id;

  -- Insert tasks
  IF p_tasks IS NOT NULL THEN
    FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
    LOOP
      v_priority := lower(COALESCE(v_task->>'priority', v_task->>'importance', v_task->>'severity', 'normal'));
      IF v_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
        v_priority := 'normal';
      END IF;

      INSERT INTO public.tasks (meeting_id, user_id, description, priority)
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
        ),
        v_priority
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

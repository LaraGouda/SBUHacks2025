
-- Migration: 20251109014647

-- Migration: 20251109013938
-- Create meetings table for storing analyzed meeting transcripts
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  transcript TEXT NOT NULL,
  summary TEXT,
  next_tasks JSONB DEFAULT '[]'::jsonb,
  email_draft TEXT,
  calendar_events JSONB DEFAULT '[]'::jsonb,
  blockers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to view meetings (for now, since no auth yet)
CREATE POLICY "Anyone can view meetings" 
ON public.meetings 
FOR SELECT 
USING (true);

-- Create policy to allow anyone to insert meetings (for now, since no auth yet)
CREATE POLICY "Anyone can create meetings" 
ON public.meetings 
FOR INSERT 
WITH CHECK (true);

-- Create policy to allow anyone to update meetings (for now, since no auth yet)
CREATE POLICY "Anyone can update meetings" 
ON public.meetings 
FOR UPDATE 
USING (true);

-- Create policy to allow anyone to delete meetings (for now, since no auth yet)
CREATE POLICY "Anyone can delete meetings" 
ON public.meetings 
FOR DELETE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_meetings_created_at ON public.meetings(created_at DESC);


-- Migration: 20251109020348
-- Make user_id NOT NULL and add foreign key
ALTER TABLE public.meetings 
  ALTER COLUMN user_id SET NOT NULL;

-- Drop the existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can delete meetings" ON public.meetings;

-- Create user-specific RLS policies
CREATE POLICY "Users can view their own meetings"
  ON public.meetings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meetings"
  ON public.meetings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meetings"
  ON public.meetings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meetings"
  ON public.meetings
  FOR DELETE
  USING (auth.uid() = user_id);

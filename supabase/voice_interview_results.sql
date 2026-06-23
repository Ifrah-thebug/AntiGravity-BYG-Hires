-- AI voice interview results (written by n8n after VAPI call ends).
-- Run in Supabase SQL editor if not already created.

CREATE TABLE IF NOT EXISTS public.voice_interview_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_email text NOT NULL,
  talent_id uuid,
  role_title text,
  vapi_call_id text,
  interview_score integer CHECK (interview_score IS NULL OR (interview_score >= 0 AND interview_score <= 100)),
  interview_summary text,
  experience numeric,
  motivation numeric,
  communication numeric,
  problem_solving numeric,
  work_style_and_collaboration numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_interview_results_email_created
  ON public.voice_interview_results (lower(trim(candidate_email)), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_interview_results_talent_created
  ON public.voice_interview_results (talent_id, created_at DESC)
  WHERE talent_id IS NOT NULL;

ALTER TABLE public.voice_interview_results ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.voice_interview_results TO service_role;

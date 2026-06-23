-- Client-initiated AI voice interview unlocks (run after voice_interview_results.sql).

CREATE TABLE IF NOT EXISTS public.voice_interview_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  client_email text NOT NULL,
  client_name text,
  company text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'completed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_interview_requests_talent_status
  ON public.voice_interview_requests (talent_id, status, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_interview_requests_active_client_talent
  ON public.voice_interview_requests (talent_id, lower(trim(client_email)))
  WHERE (status = 'active');

ALTER TABLE public.voice_interview_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.voice_interview_requests TO service_role;

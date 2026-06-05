-- One upcoming intro booking per talent (HR + talent pair via app).
-- Run in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.intro_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL,
  cal_uid text,
  title text NOT NULL DEFAULT 'Intro Interview',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  guest_name text,
  guest_email text,
  meeting_url text,
  status text NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intro_bookings_talent_id
  ON public.intro_bookings (talent_id);

CREATE INDEX IF NOT EXISTS idx_intro_bookings_start_at
  ON public.intro_bookings (start_at);

ALTER TABLE public.intro_bookings ENABLE ROW LEVEL SECURITY;

-- Backend service role only (no public client access).
GRANT ALL ON public.intro_bookings TO service_role;

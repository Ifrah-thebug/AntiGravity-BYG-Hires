-- MVP: clients + talent-published intro slots + per client–talent bookings
--
-- Run order in Supabase SQL editor:
--   1. intro_bookings.sql (if not already)
--   2. profiles_cal_calendar_sync.sql (Cal columns on profiles)
--   3. This file (talent_intro_slots_mvp.sql)

-- ── Hiring clients / visitors (email-first; auth linked later) ──
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  company text,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  account_confirmed_at timestamptz,
  confirmation_token text,
  confirmation_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_lower
  ON public.clients (lower(trim(email)));

CREATE INDEX IF NOT EXISTS idx_clients_user_id
  ON public.clients (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.clients TO service_role;

-- Published availability (no Cal event until client books)
CREATE TABLE IF NOT EXISTS public.talent_intro_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  day_key text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'held', 'booked', 'expired', 'cancelled')),
  held_until timestamptz,
  held_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_talent_intro_slots_talent_start
  ON public.talent_intro_slots (talent_id, start_at);

CREATE INDEX IF NOT EXISTS idx_talent_intro_slots_talent_status_start
  ON public.talent_intro_slots (talent_id, status, start_at);

-- One booked intro per talent per calendar day
CREATE UNIQUE INDEX IF NOT EXISTS idx_talent_intro_slots_one_booked_per_day
  ON public.talent_intro_slots (talent_id, day_key)
  WHERE (status = 'booked');

-- Extend intro_bookings for client–talent pairs
ALTER TABLE public.intro_bookings
  ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES public.talent_intro_slots (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS company text;

CREATE INDEX IF NOT EXISTS idx_intro_bookings_client_id
  ON public.intro_bookings (client_id)
  WHERE client_id IS NOT NULL;

-- Drop old one-booking-per-talent constraint
DROP INDEX IF EXISTS idx_intro_bookings_talent_id;

-- One active intro per client + talent
CREATE UNIQUE INDEX IF NOT EXISTS idx_intro_bookings_client_talent_active
  ON public.intro_bookings (talent_id, client_email)
  WHERE (
    client_email IS NOT NULL
    AND client_email <> ''
    AND status IN ('pending', 'confirmed', 'accepted')
  );

ALTER TABLE public.talent_intro_slots ENABLE ROW LEVEL SECURITY;
-- Backend service role only
GRANT ALL ON public.talent_intro_slots TO service_role;

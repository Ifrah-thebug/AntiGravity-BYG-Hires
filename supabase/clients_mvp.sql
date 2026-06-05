-- Standalone clients table (also included in talent_intro_slots_mvp.sql)
-- Run this ONLY if you already ran talent_intro_slots_mvp without clients.
-- Otherwise run talent_intro_slots_mvp.sql once (recommended).

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

ALTER TABLE public.intro_bookings
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_intro_bookings_client_id
  ON public.intro_bookings (client_id)
  WHERE client_id IS NOT NULL;

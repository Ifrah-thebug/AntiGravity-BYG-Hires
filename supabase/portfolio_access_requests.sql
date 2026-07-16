-- Portfolio access: client requests + public share settings on profiles
-- Run in Supabase SQL editor after profiles + clients migrations.

-- ── Per-client portfolio requests (BYG hiring clients) ──
CREATE TABLE IF NOT EXISTS public.portfolio_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  client_email text NOT NULL,
  client_name text,
  company text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  access_token uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_access_requests_talent_status
  ON public.portfolio_access_requests (talent_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_access_requests_client_email
  ON public.portfolio_access_requests (lower(trim(client_email)), status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_access_requests_active_client_talent
  ON public.portfolio_access_requests (talent_id, lower(trim(client_email)))
  WHERE status IN ('pending', 'approved');

ALTER TABLE public.portfolio_access_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.portfolio_access_requests TO service_role;

-- ── Public share settings (LinkedIn / GitHub / email signature links) ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portfolio_public_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portfolio_share_token uuid DEFAULT gen_random_uuid();

UPDATE public.profiles
SET portfolio_share_token = gen_random_uuid()
WHERE portfolio_share_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_portfolio_share_token
  ON public.profiles (portfolio_share_token)
  WHERE portfolio_share_token IS NOT NULL;

COMMENT ON COLUMN public.profiles.portfolio_public_enabled IS
  'When true, /talent/:id/portfolio is viewable by anyone (approved profiles). When false, only owner, valid ?share= token, or approved BYG clients.';

COMMENT ON COLUMN public.profiles.portfolio_share_token IS
  'Secret token for unlisted share URL: /talent/:id/portfolio?share=<token>';

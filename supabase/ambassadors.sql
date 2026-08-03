-- Ambassador program: unique codes, talent invites, registration attribution.
-- Run in Supabase SQL editor. Backend uses service_role.

CREATE TABLE IF NOT EXISTS public.ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL DEFAULT '',
  email text,
  user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,
  promo_title text NOT NULL DEFAULT 'Ambassador perk',
  promo_description text NOT NULL DEFAULT 'Earn rewards when talent you invite join BYG Hires.',
  promo_reward text NOT NULL DEFAULT 'Exclusive ambassador recognition + priority support',
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ambassadors_code_format CHECK (code ~ '^[A-Z0-9-]{4,32}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ambassadors_code_unique
  ON public.ambassadors (upper(trim(code)));

CREATE INDEX IF NOT EXISTS idx_ambassadors_user ON public.ambassadors (user_id);
CREATE INDEX IF NOT EXISTS idx_ambassadors_email ON public.ambassadors (lower(trim(email)));

-- Link bulk/email talent invites to an ambassador (optional).
ALTER TABLE public.talent_invites
  ADD COLUMN IF NOT EXISTS ambassador_id uuid REFERENCES public.ambassadors (id) ON DELETE SET NULL;

ALTER TABLE public.talent_invites
  ALTER COLUMN cv_storage_path DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_talent_invites_ambassador
  ON public.talent_invites (ambassador_id);

-- Profiles can remember which ambassador brought them in.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ambassador_id uuid REFERENCES public.ambassadors (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_ambassador ON public.profiles (ambassador_id);

ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ambassadors TO service_role;
GRANT SELECT ON public.ambassadors TO authenticated;

INSERT INTO public.ambassadors (code, name, promo_title, promo_description, promo_reward)
SELECT
  'BYG-STAR-01',
  'Demo Ambassador',
  'Founding Ambassador perk',
  'When talent you invite activate their account, you unlock this perk — plus decaying cash rewards on placements.',
  'Up to $50 on 1st placement · lifetime residual floor $10'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ambassadors WHERE upper(trim(code)) = 'BYG-STAR-01'
);

-- See also: ambassadors_rewards.sql (demo placement ledger for decaying $ rewards).

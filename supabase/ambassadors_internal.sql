-- Internal ambassador role (BYG HR): review own invited talent + book screening slots.
-- Run in Supabase SQL editor after ambassadors.sql. Safe to re-run.

ALTER TABLE public.ambassadors
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'circle';

UPDATE public.ambassadors
SET kind = 'circle'
WHERE kind IS NULL OR btrim(kind) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ambassadors_kind_check'
  ) THEN
    ALTER TABLE public.ambassadors
      ADD CONSTRAINT ambassadors_kind_check
      CHECK (kind IN ('circle', 'internal'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ambassadors_kind ON public.ambassadors (kind);

-- Cooldown for ambassador reminder emails (per talent).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS intro_slot_nudge_at timestamptz;

-- 'calendar' | 'slots' — so connect-calendar and publish-slots have separate 24h locks.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS intro_nudge_kind text;


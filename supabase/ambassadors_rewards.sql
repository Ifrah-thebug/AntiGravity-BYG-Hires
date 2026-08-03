-- Ambassador decaying rewards (demo ledger). Run after ambassadors.sql.
-- Real payment providers are NOT wired — rows are for tracking / UI demo.

CREATE TABLE IF NOT EXISTS public.ambassador_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors (id) ON DELETE CASCADE,
  talent_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  talent_email text,
  talent_name text,
  invite_id uuid REFERENCES public.talent_invites (id) ON DELETE SET NULL,
  placement_cycle integer NOT NULL CHECK (placement_cycle >= 1),
  reward_usd numeric(10, 2) NOT NULL CHECK (reward_usd >= 0),
  status text NOT NULL DEFAULT 'demo'
    CHECK (status IN ('demo', 'pending', 'paid')),
  notes text,
  placed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ambassador_placements_ambassador
  ON public.ambassador_placements (ambassador_id, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ambassador_placements_email
  ON public.ambassador_placements (ambassador_id, lower(trim(talent_email)));

ALTER TABLE public.ambassador_placements ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ambassador_placements TO service_role;
GRANT SELECT ON public.ambassador_placements TO authenticated;

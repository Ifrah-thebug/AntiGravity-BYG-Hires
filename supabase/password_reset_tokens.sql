-- Password reset tokens (Backend Option B — custom flow like talent activation).
-- Run once in Supabase SQL Editor. Backend uses service role only; no client RLS policies.

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active_hash
  ON public.password_reset_tokens (token_hash)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_active
  ON public.password_reset_tokens (user_id)
  WHERE used_at IS NULL;

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.password_reset_tokens TO service_role;
GRANT ALL ON public.password_reset_tokens TO postgres;

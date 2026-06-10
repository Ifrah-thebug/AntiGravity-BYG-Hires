-- Bulk CV import invites (admin upload → activation email → talent setup).
-- Backend uses service_role; no direct client access.

CREATE TABLE IF NOT EXISTS public.talent_invite_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talent_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.talent_invite_batches (id) ON DELETE CASCADE,
  email text,
  name text,
  original_filename text,
  cv_storage_path text NOT NULL,
  cv_mime_type text,
  parsed_json jsonb,
  parse_status text NOT NULL DEFAULT 'not_started'
    CHECK (parse_status IN ('not_started', 'parsing', 'parsed', 'failed')),
  parse_error text,
  email_extract_status text NOT NULL DEFAULT 'pending'
    CHECK (email_extract_status IN ('pending', 'found', 'missing', 'manual')),
  invite_token text UNIQUE,
  token_expires_at timestamptz,
  invited_at timestamptz,
  activation_link_clicked_at timestamptz,
  activation_link_click_count integer NOT NULL DEFAULT 0,
  activated_at timestamptz,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'ready', 'invited', 'activated', 'expired', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_talent_invites_batch ON public.talent_invites (batch_id);
CREATE INDEX IF NOT EXISTS idx_talent_invites_email ON public.talent_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_talent_invites_token ON public.talent_invites (invite_token);
CREATE INDEX IF NOT EXISTS idx_talent_invites_status ON public.talent_invites (status);
CREATE INDEX IF NOT EXISTS idx_talent_invites_user ON public.talent_invites (user_id);

ALTER TABLE public.talent_invite_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_invites ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.talent_invite_batches TO service_role;
GRANT ALL ON public.talent_invites TO service_role;

-- Backend service_role reads admins during other flows
GRANT SELECT ON public.admins TO service_role;

-- Existing deployments: run once in Supabase SQL editor
-- ALTER TABLE public.talent_invites ADD COLUMN IF NOT EXISTS activation_link_clicked_at timestamptz;
-- ALTER TABLE public.talent_invites ADD COLUMN IF NOT EXISTS activation_link_click_count integer NOT NULL DEFAULT 0;

-- Talent onboarding chatbot — sessions and messages
-- Run in Supabase SQL editor after profiles migrations.

CREATE TABLE IF NOT EXISTS public.talent_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_talent_chat_sessions_user_updated
  ON public.talent_chat_sessions (user_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_talent_chat_sessions_user_unique
  ON public.talent_chat_sessions (user_id);

CREATE TABLE IF NOT EXISTS public.talent_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.talent_chat_sessions (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_talent_chat_messages_session_created
  ON public.talent_chat_messages (session_id, created_at ASC);

ALTER TABLE public.talent_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_chat_messages ENABLE ROW LEVEL SECURITY;

-- Backend service role only (same pattern as clients / intro_bookings).
GRANT ALL ON public.talent_chat_sessions TO service_role;
GRANT ALL ON public.talent_chat_messages TO service_role;

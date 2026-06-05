-- Cal.com calendar sync for talent profiles (replaces Nylas).
-- Run in Supabase SQL editor after backing up if needed.

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS nylas_grant_id,
DROP COLUMN IF EXISTS nylas_connected_at;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cal_username text,
ADD COLUMN IF NOT EXISTS cal_user_id text,
ADD COLUMN IF NOT EXISTS cal_connected_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_cal_username
ON public.profiles (cal_username);

DROP INDEX IF EXISTS idx_profiles_nylas_grant_id;

GRANT SELECT, UPDATE ON public.profiles TO service_role;

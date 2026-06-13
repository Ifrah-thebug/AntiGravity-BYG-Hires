-- Anchor cron activation ladder to original admin Send (not token refresh times).
-- Profile completion nudge for activated users with incomplete profiles.
-- Run once in Supabase SQL Editor (after talent_invite_reminders.sql).

ALTER TABLE public.talent_invites
  ADD COLUMN IF NOT EXISTS first_invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_reminder_sent_at timestamptz;

-- Backfill: existing sent invites use their first known invited_at.
-- If you already bulk-sent on a known date, run talent_invite_first_invited_at_fix_bulk_send.sql
-- instead to pin first_invited_at to that send time (avoids reminder-shifted invited_at).
UPDATE public.talent_invites
SET first_invited_at = invited_at
WHERE first_invited_at IS NULL
  AND invited_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_talent_invites_first_invited_at
  ON public.talent_invites (status, first_invited_at)
  WHERE status = 'invited' AND activated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_talent_invites_profile_reminder
  ON public.talent_invites (status, activated_at)
  WHERE status = 'activated' AND user_id IS NOT NULL;

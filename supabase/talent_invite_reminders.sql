-- Reminder tracking for bulk-import talent invites (activation + assessment nudges).
-- Run once in Supabase SQL Editor, then run talent_invite_first_invited_at.sql.

ALTER TABLE public.talent_invites
  ADD COLUMN IF NOT EXISTS activation_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assessment_reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_talent_invites_activation_reminder
  ON public.talent_invites (status, invited_at)
  WHERE status = 'invited' AND activated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_talent_invites_assessment_reminder
  ON public.talent_invites (status, activated_at)
  WHERE status = 'activated' AND user_id IS NOT NULL;

-- One-time fix: pin first_invited_at AND invited_at to the original bulk admin Send
-- so cron timing and admin UI "Email sent" stay aligned.
--
-- Run in Supabase SQL Editor AFTER talent_invite_first_invited_at.sql
--
-- Timezone: Jun 12, 2026 8:13 PM in Asia/Karachi (PKT, UTC+5).
-- If your bulk send was in another timezone, change BULK_SEND_AT below, e.g.:
--   UTC:  '2026-06-12 20:13:00+00'
--   US ET: '2026-06-12 20:13:00-04'  (EDT)

-- Preview before running (optional):
-- SELECT id, email, status, invited_at, first_invited_at, activation_reminder_count
-- FROM public.talent_invites
-- WHERE invited_at IS NOT NULL
-- ORDER BY email;

UPDATE public.talent_invites
SET
  first_invited_at = TIMESTAMPTZ '2026-06-12 20:13:00+05',
  invited_at = TIMESTAMPTZ '2026-06-12 20:13:00+05'
WHERE invited_at IS NOT NULL;

-- Verify:
-- SELECT id, email, status, invited_at, first_invited_at
-- FROM public.talent_invites
-- WHERE invited_at IS NOT NULL
-- ORDER BY email;

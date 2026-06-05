-- Optional: clear stale "held" slots after removing the 8-minute hold feature.
-- Run once in Supabase SQL editor.

UPDATE public.talent_intro_slots
SET
  status = 'open',
  held_until = NULL,
  held_by_email = NULL,
  updated_at = now()
WHERE status = 'held';

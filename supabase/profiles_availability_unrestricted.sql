-- Make profiles.availability unrestricted (no hardcoded enum values).
-- This version assumes your table has ONLY the availability column.
-- It allows values like:
--   'immediate', '2weeks', 'from 1 week', 'from next month', '2026-09-01'

-- 1) Ensure column exists and is TEXT.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS availability text;

-- 2) Drop any old hardcoded check constraints.
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_availability_check;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_availability_from_month_required_check;

-- 3) Keep existing values; only guarantee non-null and no forced enum.
UPDATE public.profiles
SET availability = coalesce(nullif(trim(availability), ''), 'immediate');

ALTER TABLE public.profiles
ALTER COLUMN availability SET NOT NULL;

-- 4) Keep a sensible default for new rows (can still be edited to any text later).
ALTER TABLE public.profiles
ALTER COLUMN availability SET DEFAULT 'immediate';

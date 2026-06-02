-- Add pricing + availability + timing fields to public.profiles
-- Run in Supabase SQL Editor.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS monthly_fee_usd integer NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS directory_fee_usd integer NOT NULL DEFAULT 1100,
ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'immediate',
ADD COLUMN IF NOT EXISTS availability_from_month date,
ADD COLUMN IF NOT EXISTS role_type text NOT NULL DEFAULT 'flexible';

UPDATE public.profiles
SET availability = 'from_month',
    availability_from_month = make_date(extract(year from now())::int, 7, 1)
WHERE availability = 'july';

UPDATE public.profiles
SET directory_fee_usd = round(coalesce(monthly_fee_usd, 0) * 1.1)::integer
WHERE directory_fee_usd IS NULL
   OR directory_fee_usd <> round(coalesce(monthly_fee_usd, 0) * 1.1)::integer;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_availability_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_availability_check
CHECK (availability IN ('immediate', '2weeks', '1month', 'from_month'));

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_type_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_type_check
CHECK (role_type IN ('flexible', 'fulltime', 'night', 'parttime'));

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_monthly_fee_non_negative_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_monthly_fee_non_negative_check
CHECK (monthly_fee_usd >= 0);

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_directory_fee_non_negative_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_directory_fee_non_negative_check
CHECK (directory_fee_usd >= 0);

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_availability_from_month_required_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_availability_from_month_required_check
CHECK (
  (availability = 'from_month' AND availability_from_month IS NOT NULL)
  OR (availability <> 'from_month')
);

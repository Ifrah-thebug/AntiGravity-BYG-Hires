-- Optional: audit column for intro_bookings (sync no longer requires this).
ALTER TABLE public.intro_bookings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Optional: add updated_at if your profiles table was created without it
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

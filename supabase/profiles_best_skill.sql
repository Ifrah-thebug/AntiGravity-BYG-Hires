-- Top skill highlighted on talent directory (fire badge). Run in Supabase SQL editor.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS best_skill text;

-- Talent department (homepage role tiles + directory filtering)
-- Run once in Supabase SQL editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT 'admin-operations';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_department_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_department_check
  CHECK (
    department IN (
      'ai-automation',
      'admin-operations',
      'account-coordinators',
      'marketing-content',
      'virtual-assistants',
      'customer-support',
      'sales',
      'hr',
      'it-technical',
      'finance'
    )
  );

CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles (department);

-- Public talent directory read access (for non-logged-in visitors)
-- Run this in Supabase SQL Editor.
-- Prefer profiles_directory_status.sql for full approval workflow setup.

-- 1) Ensure anon/authenticated API roles can issue SELECT.
GRANT SELECT ON public.profiles TO anon, authenticated;

-- 2) Public listing: approved profiles with name + job title only.
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  directory_status = 'approved'
  AND coalesce(nullif(trim(name), ''), '') <> ''
  AND coalesce(nullif(trim(job_title), ''), '') <> ''
);

-- Public talent directory read access (for non-logged-in visitors)
-- Run this in Supabase SQL Editor.

-- 1) Ensure anon/authenticated API roles can issue SELECT.
GRANT SELECT ON public.profiles TO anon, authenticated;

-- 2) Keep owner-only private access for full rows, but allow public listing rows.
--    This policy allows read access for anyone (anon + authenticated).
--    Directory UI still controls which columns are queried on the client.
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  coalesce(nullif(trim(name), ''), '') <> ''
  AND coalesce(nullif(trim(job_title), ''), '') <> ''
);

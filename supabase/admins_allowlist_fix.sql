-- Fix: "permission denied for table admin_signup_allowlist" on /admin/signup
-- Run once in Supabase SQL Editor if you already applied an older admins.sql

CREATE OR REPLACE FUNCTION public.is_admin_signup_email_allowed()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_signup_allowlist
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_signup_email_allowed() TO authenticated;

DROP POLICY IF EXISTS "Allowlisted users create admin row" ON admins;

CREATE POLICY "Allowlisted users create admin row"
ON admins FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  AND public.is_admin_signup_email_allowed()
);

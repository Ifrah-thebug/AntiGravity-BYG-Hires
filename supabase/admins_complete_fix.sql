-- Run once in Supabase SQL Editor (fixes signup + "permission denied for table admins")
-- Safe to re-run: uses CREATE OR REPLACE (no DROP FUNCTION) so RLS policies stay valid.

-- 0) Drop admins policies only if you need a clean recreate (optional; safe if names match)
DROP POLICY IF EXISTS "Allowlisted users create admin row" ON public.admins;
DROP POLICY IF EXISTS "Admins read admin records" ON public.admins;

-- 1) Allowlist check
CREATE OR REPLACE FUNCTION public.is_admin_signup_email_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $allowlist$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_signup_allowlist
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$allowlist$;

GRANT EXECUTE ON FUNCTION public.is_admin_signup_email_allowed() TO authenticated;

-- 2) Is current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $isadmin$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins
    WHERE user_id = auth.uid()
  );
$isadmin$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- 3) Register admin row (call while signed in)
CREATE OR REPLACE FUNCTION public.register_admin_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $register$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated. Confirm your email and sign in, then try again.';
  END IF;

  v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Email missing from session.';
  END IF;

  IF NOT public.is_admin_signup_email_allowed() THEN
    RAISE EXCEPTION 'This email is not allowlisted for super admin registration.';
  END IF;

  INSERT INTO public.admins (user_id, email)
  VALUES (auth.uid(), v_email)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
END;
$register$;

GRANT EXECUTE ON FUNCTION public.register_admin_account() TO authenticated;

-- 4) Table privileges
GRANT SELECT, INSERT ON public.admins TO authenticated;

-- 5) RLS policies on admins (recreated after step 0 drop)
CREATE POLICY "Allowlisted users create admin row"
ON public.admins
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  AND public.is_admin_signup_email_allowed()
);

CREATE POLICY "Admins read admin records"
ON public.admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

-- 6) Profiles + storage (idempotent; skip if already exist from admins.sql)
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;

CREATE POLICY "Admins read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "Admins read talent-files" ON storage.objects;

CREATE POLICY "Admins read talent-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'talent-files'
  AND public.is_admin_user()
);

-- 7) Link existing Auth user (hr@bnyahyagroup.com)
INSERT INTO public.admins (user_id, email)
SELECT id, lower(email)
FROM auth.users
WHERE lower(email) = 'hr@bnyahyagroup.com'
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

-- Super admin: admins table + RLS (run after setup.sql)
--
-- 1) Add emails allowed to self-register at /admin/signup
-- 2) Create Auth users via signup, or invite in Dashboard then insert admins row

-- ─── Who may register as admin (email allowlist) ─────────────────────────────
CREATE TABLE IF NOT EXISTS admin_signup_allowlist (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_signup_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to admin signup allowlist"
ON admin_signup_allowlist FOR ALL TO authenticated
USING (false)
WITH CHECK (false);

-- Add your super-admin emails (must match VITE_ADMIN_SIGNUP_EMAILS in .env)
INSERT INTO admin_signup_allowlist (email) VALUES
  ('hr@bnyahyagroup.com')
ON CONFLICT (email) DO NOTHING;

-- ─── Registered super admins (linked to auth.users) ──────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins
    WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- Reads allowlist with elevated rights (RLS on allowlist blocks direct SELECT for users)
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

CREATE OR REPLACE FUNCTION public.register_admin_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  INSERT INTO admins (user_id, email)
  VALUES (auth.uid(), v_email)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_admin_account() TO authenticated;

GRANT SELECT, INSERT ON public.admins TO authenticated;

-- Read own row or any admin row when you are admin
DROP POLICY IF EXISTS "Admins read admin records" ON admins;
CREATE POLICY "Admins read admin records"
ON admins FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

-- Self-register after Auth signup (email must be on allowlist)
DROP POLICY IF EXISTS "Allowlisted users create admin row" ON admins;
CREATE POLICY "Allowlisted users create admin row"
ON admins FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  AND public.is_admin_signup_email_allowed()
);

-- ─── Profiles: admins can read all talent rows (incl. cv_url, email) ───────────
DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;

CREATE POLICY "Admins read all profiles"
ON profiles FOR SELECT TO authenticated
USING (public.is_admin_user());

-- ─── Storage: admins can read all talent-files ───────────────────────────────
DROP POLICY IF EXISTS "Admins read talent-files" ON storage.objects;

CREATE POLICY "Admins read talent-files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'talent-files'
  AND public.is_admin_user()
);

-- Optional: bootstrap first admin manually after creating Auth user:
-- INSERT INTO admins (user_id, email) VALUES ('<auth-user-uuid>', 'you@example.com');

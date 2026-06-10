-- Run in Supabase SQL Editor (once per project)

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  job_title TEXT,
  about TEXT,
  skills JSONB DEFAULT '[]'::jsonb,
  experience_years INTEGER DEFAULT 0,
  monthly_fee_usd INTEGER DEFAULT 300,
  directory_fee_usd INTEGER DEFAULT 330,
  availability TEXT DEFAULT 'immediate',
  availability_from_month DATE,
  role_type TEXT DEFAULT 'flexible',
  photo_url TEXT DEFAULT '',
  cv_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
ON profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own profile"
ON profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own profile"
ON profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Optional: public directory listing
-- CREATE POLICY "Public read profiles" ON profiles FOR SELECT TO public USING (true);

-- Talent portfolio projects (Behance-style work showcase)
-- Run in Supabase SQL Editor after profiles migrations.

CREATE TABLE IF NOT EXISTS public.talent_portfolio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  cover_image_url text NOT NULL DEFAULT '',
  project_url text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talent_portfolio_projects_title_nonempty CHECK (char_length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_projects_profile_sort
  ON public.talent_portfolio_projects (profile_id, sort_order ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_projects_user
  ON public.talent_portfolio_projects (user_id);

ALTER TABLE public.talent_portfolio_projects ENABLE ROW LEVEL SECURITY;

-- Owners manage their own portfolio items.
CREATE POLICY "Owners read own portfolio projects"
  ON public.talent_portfolio_projects
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners insert own portfolio projects"
  ON public.talent_portfolio_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners update own portfolio projects"
  ON public.talent_portfolio_projects
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners delete own portfolio projects"
  ON public.talent_portfolio_projects
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Public can view published work for approved directory profiles.
CREATE POLICY "Public read published portfolio projects"
  ON public.talent_portfolio_projects
  FOR SELECT
  TO public
  USING (
    published = true
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = talent_portfolio_projects.profile_id
        AND p.directory_status = 'approved'
        AND coalesce(nullif(trim(p.name), ''), '') <> ''
        AND coalesce(nullif(trim(p.job_title), ''), '') <> ''
    )
  );

-- Required: without these, the app gets "permission denied for table talent_portfolio_projects".
GRANT ALL ON public.talent_portfolio_projects TO service_role;
GRANT ALL ON public.talent_portfolio_projects TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_portfolio_projects TO authenticated;
GRANT SELECT ON public.talent_portfolio_projects TO anon;

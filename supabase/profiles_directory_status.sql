-- Profile directory approval workflow
-- Run in Supabase SQL Editor after existing profile migrations.

-- Ensure public talent id column exists (used in /talent/:id URLs)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE public.profiles
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Review / directory visibility
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS directory_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS review_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_directory_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_directory_status_check
  CHECK (
    directory_status IN (
      'draft',
      'pending_review',
      'changes_requested',
      'approved',
      'rejected'
    )
  );

CREATE INDEX IF NOT EXISTS idx_profiles_directory_status_submitted
  ON public.profiles (directory_status, submitted_at DESC NULLS LAST);

-- Grandfather existing complete profiles so the live directory keeps working.
UPDATE public.profiles
SET
  directory_status = 'approved',
  approved_at = COALESCE(approved_at, updated_at, created_at, now())
WHERE
  coalesce(nullif(trim(name), ''), '') <> ''
  AND coalesce(nullif(trim(job_title), ''), '') <> ''
  AND directory_status = 'draft';

-- Guard: talents cannot self-approve or tamper with admin review fields.
CREATE OR REPLACE FUNCTION public.profiles_directory_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.directory_status IS NULL OR NEW.directory_status NOT IN ('draft', 'pending_review') THEN
      NEW.directory_status := 'draft';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Service role (backend admin) may set any status.
    IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
      RETURN NEW;
    END IF;

    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM OLD.user_id THEN
      RETURN NEW;
    END IF;

    -- Preserve admin review metadata unless moving to pending_review.
    IF NEW.directory_status IS DISTINCT FROM OLD.directory_status THEN
      IF NEW.directory_status = 'pending_review'
         AND OLD.directory_status IN ('draft', 'changes_requested') THEN
        NEW.submitted_at := COALESCE(NEW.submitted_at, now());
      ELSE
        NEW.directory_status := OLD.directory_status;
      END IF;
    END IF;

    NEW.review_notes := OLD.review_notes;
    NEW.review_issues := OLD.review_issues;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.approved_at := OLD.approved_at;

    -- Material edits on an approved profile require re-review.
    IF OLD.directory_status = 'approved' AND (
      NEW.photo_url IS DISTINCT FROM OLD.photo_url
      OR NEW.cv_url IS DISTINCT FROM OLD.cv_url
      OR NEW.job_title IS DISTINCT FROM OLD.job_title
      OR NEW.skills IS DISTINCT FROM OLD.skills
      OR NEW.about IS DISTINCT FROM OLD.about
    ) THEN
      NEW.directory_status := 'pending_review';
      NEW.submitted_at := now();
      NEW.approved_at := NULL;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_directory_status_guard ON public.profiles;
CREATE TRIGGER profiles_directory_status_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_directory_status_guard();

-- Public directory: only approved profiles with name + job title.
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

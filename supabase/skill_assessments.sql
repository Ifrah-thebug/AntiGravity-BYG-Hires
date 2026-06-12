-- Per-skill talent assessments (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS public.skill_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'expired', 'cancelled')),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_breakdown JSONB,
  total_score INTEGER CHECK (total_score IS NULL OR (total_score >= 0 AND total_score <= 100)),
  feedback_summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_assessments_talent_id
  ON public.skill_assessments (talent_id);

CREATE INDEX IF NOT EXISTS idx_skill_assessments_user_id
  ON public.skill_assessments (user_id);

CREATE INDEX IF NOT EXISTS idx_skill_assessments_talent_skill
  ON public.skill_assessments (talent_id, skill, status);

ALTER TABLE public.skill_assessments ENABLE ROW LEVEL SECURITY;

-- Talent reads own rows
DROP POLICY IF EXISTS "Talent read own skill assessments" ON public.skill_assessments;
CREATE POLICY "Talent read own skill assessments"
ON public.skill_assessments FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Public directory: completed scores only (skill + score, no answers)
DROP POLICY IF EXISTS "Public read completed skill assessments" ON public.skill_assessments;
CREATE POLICY "Public read completed skill assessments"
ON public.skill_assessments FOR SELECT TO anon, authenticated
USING (
  status = 'completed'
  AND total_score IS NOT NULL
);

-- API (Express) uses SUPABASE_SERVICE_ROLE_KEY — must have table grants
GRANT ALL ON public.skill_assessments TO service_role;
GRANT ALL ON public.skill_assessments TO postgres;

-- Browser: directory reads completed scores only (RLS policies above)
GRANT SELECT ON public.skill_assessments TO anon, authenticated;

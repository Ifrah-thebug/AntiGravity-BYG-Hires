-- Run once if you already created skill_assessments and see
-- "permission denied for table skill_assessments" in backend logs.

GRANT ALL ON public.skill_assessments TO service_role;
GRANT ALL ON public.skill_assessments TO postgres;
GRANT SELECT ON public.skill_assessments TO anon, authenticated;

-- Run once if you already created talent_portfolio_projects and see
-- "permission denied for table talent_portfolio_projects" in the app.

GRANT ALL ON public.talent_portfolio_projects TO service_role;
GRANT ALL ON public.talent_portfolio_projects TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_portfolio_projects TO authenticated;
GRANT SELECT ON public.talent_portfolio_projects TO anon;

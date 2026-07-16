-- Gate direct Supabase reads: portfolio data is served via backend API
-- (public link, share token, owner, or approved client).
-- Run after portfolio_access_requests.sql and talent_portfolio_projects.sql.

DROP POLICY IF EXISTS "Public read published portfolio projects"
  ON public.talent_portfolio_projects;

REVOKE SELECT ON public.talent_portfolio_projects FROM anon;

-- Owners (authenticated) still manage projects via existing RLS policies.

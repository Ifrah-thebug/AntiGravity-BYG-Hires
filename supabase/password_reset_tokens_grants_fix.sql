-- Run in Supabase SQL Editor if forgot-password fails with:
-- "permission denied for table password_reset_tokens"

GRANT ALL ON public.password_reset_tokens TO service_role;
GRANT ALL ON public.password_reset_tokens TO postgres;

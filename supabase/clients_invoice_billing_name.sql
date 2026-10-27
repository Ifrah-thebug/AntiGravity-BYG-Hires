-- Optional "Bill to" name on client invoices (company / DBA / legal entity).
-- Run once in Supabase SQL editor. Safe to re-run.

alter table public.clients
  add column if not exists invoice_billing_name text;

grant all on table public.clients to service_role;

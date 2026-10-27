-- Global workforce settings (platform fee default, etc.)
-- Run once in Supabase SQL editor. Safe to re-run.
-- Backend uses service_role only (same pattern as other wf_* tables).

create table if not exists public.wf_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.wf_settings enable row level security;

-- Backend access (fixes: permission denied for table wf_settings)
grant all on table public.wf_settings to service_role;
grant select, insert, update, delete on table public.wf_settings to postgres;

insert into public.wf_settings (key, value)
values ('platform', '{"defaultFeePercent": 0}'::jsonb)
on conflict (key) do nothing;

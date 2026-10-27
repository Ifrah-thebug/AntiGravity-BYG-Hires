-- Fix: permission denied for table wf_settings
-- Run this if you already created wf_settings without grants.

grant all on table public.wf_settings to service_role;

insert into public.wf_settings (key, value)
values ('platform', '{"defaultFeePercent": 0}'::jsonb)
on conflict (key) do nothing;

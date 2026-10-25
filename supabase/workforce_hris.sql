-- BYG Workforce HRIS (additive). Safe to run after existing migrations.
-- Does NOT alter ambassador_placements or marketplace tables.

CREATE TABLE IF NOT EXISTS public.wf_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  client_name text,
  client_email text,
  talent_user_id uuid,
  talent_email text NOT NULL,
  talent_name text,
  role_title text,
  status text NOT NULL DEFAULT 'offered'
    CHECK (status IN ('offered', 'contracted', 'active', 'paused', 'ended')),
  start_date date,
  end_date date,
  intro_booking_id uuid,
  ambassador_placement_id uuid,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_engagements_talent_email
  ON public.wf_engagements (lower(trim(talent_email)));
CREATE INDEX IF NOT EXISTS idx_wf_engagements_status
  ON public.wf_engagements (status);

CREATE TABLE IF NOT EXISTS public.wf_salary_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.wf_engagements (id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  cadence text NOT NULL DEFAULT 'monthly'
    CHECK (cadence IN ('weekly', 'biweekly', 'monthly')),
  byg_fee_percent numeric(5, 2) NOT NULL DEFAULT 10
    CHECK (byg_fee_percent >= 0 AND byg_fee_percent <= 100),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_salary_one_open
  ON public.wf_salary_schedules (engagement_id)
  WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS public.wf_contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  body_html text NOT NULL,
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wf_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.wf_engagements (id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.wf_contract_templates (id) ON DELETE SET NULL,
  filled_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_ai', 'needs_fixes', 'ready_to_sign', 'partially_signed', 'signed', 'void')),
  ai_review_status text
    CHECK (ai_review_status IS NULL OR ai_review_status IN ('pass', 'needs_fixes', 'escalate', 'pending')),
  ai_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_raw text,
  doc_hash text,
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wf_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.wf_contracts (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('client', 'talent', 'byg')),
  signer_email text NOT NULL,
  otp_hash text,
  otp_expires_at timestamptz,
  signature_data text,
  consent boolean NOT NULL DEFAULT false,
  ip text,
  signed_at timestamptz,
  doc_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, role)
);

CREATE TABLE IF NOT EXISTS public.wf_payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'finalized', 'void')),
  created_by uuid,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.wf_payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.wf_payroll_runs (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES public.wf_engagements (id) ON DELETE CASCADE,
  salary_amount numeric(12, 2) NOT NULL,
  fee_amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  UNIQUE (payroll_run_id, engagement_id)
);

CREATE TABLE IF NOT EXISTS public.wf_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.wf_engagements (id) ON DELETE CASCADE,
  payroll_item_id uuid REFERENCES public.wf_payroll_items (id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric(12, 2) NOT NULL,
  fee_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total numeric(12, 2) NOT NULL,
  due_date date,
  paid_at timestamptz,
  client_name text,
  client_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wf_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.wf_invoices (id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.wf_ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('asset', 'liability', 'equity', 'revenue', 'expense'))
);

CREATE TABLE IF NOT EXISTS public.wf_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.wf_ledger_accounts (id),
  debit numeric(12, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(12, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  currency text NOT NULL DEFAULT 'USD',
  ref_type text,
  ref_id uuid,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (debit > 0 AND credit > 0)),
  CHECK (debit > 0 OR credit > 0)
);

CREATE TABLE IF NOT EXISTS public.wf_payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('talent', 'client')),
  owner_email text NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  external_ref text,
  masked_label text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_email, provider)
);

CREATE TABLE IF NOT EXISTS public.wf_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.wf_engagements (id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.wf_invoices (id) ON DELETE SET NULL,
  payment_account_id uuid REFERENCES public.wf_payment_accounts (id) ON DELETE SET NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.wf_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.wf_ledger_accounts (code, name, kind) VALUES
  ('cash', 'Platform cash', 'asset'),
  ('talent_payable', 'Talent payable', 'liability'),
  ('byg_fee_revenue', 'BYG fee revenue', 'revenue')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.wf_contract_templates (name, version, body_html, required_fields, active)
SELECT
  'Standard contractor agreement',
  1,
  '<h1>BYG Hires Contractor Agreement</h1><p>Role: {{role_title}}</p><p>Rate: {{salary_amount}} {{currency}} / {{cadence}}</p><p>Start: {{start_date}}</p><p>Talent: {{talent_name}} ({{talent_email}})</p><p>Client: {{client_name}}</p>',
  '["role_title","salary_amount","currency","cadence","start_date","talent_name","talent_email","client_name"]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.wf_contract_templates WHERE name = 'Standard contractor agreement' AND version = 1
);

ALTER TABLE public.wf_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wf_salary_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wf_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wf_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wf_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wf_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wf_ledger_entries ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

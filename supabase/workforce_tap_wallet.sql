-- Tap payments + client wallet for Workforce HRIS
-- Run in Supabase SQL editor after workforce_hris.sql

ALTER TABLE public.wf_invoices
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS provider_ref text;

CREATE TABLE IF NOT EXISTS public.wf_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_email, currency)
);

CREATE INDEX IF NOT EXISTS idx_wf_wallets_email
  ON public.wf_wallets (lower(trim(owner_email)));

CREATE TABLE IF NOT EXISTS public.wf_tap_charges (
  id text PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('invoice_pay', 'wallet_topup')),
  owner_email text NOT NULL,
  invoice_id uuid REFERENCES public.wf_invoices (id) ON DELETE SET NULL,
  amount numeric(14, 2) NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'captured', 'failed', 'abandoned')),
  redirect_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  captured_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_wf_tap_charges_owner
  ON public.wf_tap_charges (lower(trim(owner_email)));
CREATE INDEX IF NOT EXISTS idx_wf_tap_charges_invoice
  ON public.wf_tap_charges (invoice_id);

CREATE TABLE IF NOT EXISTS public.wf_wallet_txns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wf_wallets (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('topup', 'spend')),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  tap_charge_id text REFERENCES public.wf_tap_charges (id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.wf_invoices (id) ON DELETE SET NULL,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_wallet_txns_wallet
  ON public.wf_wallet_txns (wallet_id, created_at DESC);

ALTER TABLE public.wf_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wf_tap_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wf_wallet_txns ENABLE ROW LEVEL SECURITY;

INSERT INTO public.wf_ledger_accounts (code, name, kind) VALUES
  ('client_prepaid', 'Client prepaid wallet', 'liability')
ON CONFLICT (code) DO NOTHING;

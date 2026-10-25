-- BYG Workforce v3 — production hardening, recurring billing, payouts, jobs.
-- Run AFTER workforce_hris.sql, workforce_contract_v2.sql, workforce_tap_wallet.sql.
-- Safe to re-run.
--
-- What it does:
--   1. Billing periods on invoices (no double billing), wallet auto-pay, payout details.
--   2. Job requisitions + candidate pipeline (wf_jobs, wf_job_candidates).
--   3. Atomic money functions (row-locked) for invoice payment, Tap fulfilment,
--      wallet credit and payout release. Callable by service_role only.
--   4. Locks every wf_* table: RLS on, no anon/authenticated access (backend only).

-- ─── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.wf_engagements
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS ended_reason text;

ALTER TABLE public.wf_invoices
  ADD COLUMN IF NOT EXISTS period_index integer,
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date;

ALTER TABLE public.wf_wallets
  ADD COLUMN IF NOT EXISTS auto_pay boolean NOT NULL DEFAULT false;

ALTER TABLE public.wf_payment_accounts
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.wf_payouts
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS released_by text;

-- Anchored billing periods (must match backend/src/services/workforce/periods.js)
CREATE OR REPLACE FUNCTION public.wf_period_start(p_anchor date, p_cadence text, p_index integer)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_cadence
    WHEN 'weekly' THEN p_anchor + 7 * p_index
    WHEN 'biweekly' THEN p_anchor + 14 * p_index
    ELSE (p_anchor + make_interval(months => p_index))::date
  END
$$;

-- Backfill: the first invoice of each engagement covers period 0.
UPDATE public.wf_invoices i
SET period_index = 0,
    period_start = e.start_date,
    period_end = public.wf_period_start(e.start_date, s.cadence, 1) - 1
FROM public.wf_engagements e
JOIN public.wf_salary_schedules s ON s.engagement_id = e.id AND s.effective_to IS NULL
WHERE i.engagement_id = e.id
  AND i.period_index IS NULL
  AND i.status <> 'void'
  AND e.start_date IS NOT NULL
  AND i.id = (
    SELECT x.id FROM public.wf_invoices x
    WHERE x.engagement_id = e.id AND x.status <> 'void'
    ORDER BY x.created_at ASC LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_invoices_engagement_period
  ON public.wf_invoices (engagement_id, period_index)
  WHERE status <> 'void' AND period_index IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_payouts_one_per_invoice
  ON public.wf_payouts (invoice_id)
  WHERE status <> 'cancelled' AND invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wf_engagements_client_email
  ON public.wf_engagements (lower(trim(client_email)));

-- ─── 2. Jobs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wf_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  client_email text NOT NULL,
  client_name text,
  title text NOT NULL,
  description text,
  skills text[] NOT NULL DEFAULT '{}',
  location text NOT NULL DEFAULT 'Remote',
  employment_type text NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contract')),
  budget_min numeric(12, 2),
  budget_max numeric(12, 2),
  currency text NOT NULL DEFAULT 'USD',
  headcount integer NOT NULL DEFAULT 1 CHECK (headcount BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'on_hold', 'filled', 'closed')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_wf_jobs_client_email ON public.wf_jobs (lower(trim(client_email)));
CREATE INDEX IF NOT EXISTS idx_wf_jobs_status ON public.wf_jobs (status);

CREATE TABLE IF NOT EXISTS public.wf_job_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.wf_jobs (id) ON DELETE CASCADE,
  talent_profile_id text,
  talent_email text NOT NULL,
  talent_name text,
  talent_title text,
  stage text NOT NULL DEFAULT 'shortlisted'
    CHECK (stage IN ('shortlisted', 'intro', 'interview', 'offer', 'hired', 'rejected', 'withdrawn')),
  source text NOT NULL DEFAULT 'byg' CHECK (source IN ('byg', 'client')),
  notes text,
  engagement_id uuid REFERENCES public.wf_engagements (id) ON DELETE SET NULL,
  added_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, talent_email)
);

CREATE INDEX IF NOT EXISTS idx_wf_job_candidates_job ON public.wf_job_candidates (job_id);

-- ─── 3. Contract template wording (payment rails are live) ──────────────────
UPDATE public.wf_contract_templates
SET body_html = replace(
  body_html,
  'Live payment rails may be added later; until then, ledgered / manual settlement applies.',
  'Client funds each billing period in advance by card (Tap Payments), bank transfer, or a prepaid BYG Hires wallet balance; BYG Hires disburses Contractor compensation after the corresponding invoice is funded.'
)
WHERE body_html LIKE '%Live payment rails may be added later%';

-- ─── 4. Money functions ─────────────────────────────────────────────────────
-- Errors carry a machine code in HINT; the backend maps it to HTTP status.

CREATE OR REPLACE FUNCTION public.wf_post_ledger(
  p_code text, p_debit numeric, p_credit numeric, p_currency text,
  p_ref_type text, p_ref_id uuid, p_memo text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_account uuid;
BEGIN
  IF coalesce(p_debit, 0) = 0 AND coalesce(p_credit, 0) = 0 THEN
    RETURN;
  END IF;
  SELECT id INTO v_account FROM public.wf_ledger_accounts WHERE code = p_code;
  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Ledger account % missing', p_code USING HINT = 'LEDGER_ACCOUNT_MISSING';
  END IF;
  INSERT INTO public.wf_ledger_entries (account_id, debit, credit, currency, ref_type, ref_id, memo)
  VALUES (v_account, coalesce(p_debit, 0), coalesce(p_credit, 0), p_currency, p_ref_type, p_ref_id, p_memo);
END
$$;

-- Credit a client wallet (Tap top-up, bank transfer recorded by admin, overpayment).
CREATE OR REPLACE FUNCTION public.wf_wallet_credit(
  p_owner_email text, p_currency text, p_amount numeric,
  p_memo text DEFAULT NULL, p_tap_charge_id text DEFAULT NULL, p_actor text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_email text := lower(trim(p_owner_email));
  v_currency text := upper(trim(p_currency));
  v_amount numeric := round(p_amount, 2);
  v_wallet public.wf_wallets%ROWTYPE;
  v_txn uuid;
BEGIN
  IF v_email IS NULL OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Valid wallet owner email required' USING HINT = 'INVALID_EMAIL';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive' USING HINT = 'INVALID_AMOUNT';
  END IF;

  INSERT INTO public.wf_wallets (owner_email, currency, balance)
  VALUES (v_email, v_currency, 0)
  ON CONFLICT (owner_email, currency) DO NOTHING;

  SELECT * INTO v_wallet FROM public.wf_wallets
  WHERE owner_email = v_email AND currency = v_currency
  FOR UPDATE;

  UPDATE public.wf_wallets
  SET balance = balance + v_amount, updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  INSERT INTO public.wf_wallet_txns (wallet_id, kind, amount, currency, tap_charge_id, memo)
  VALUES (v_wallet.id, 'topup', v_amount, v_currency, p_tap_charge_id, coalesce(p_memo, 'Wallet top-up'))
  RETURNING id INTO v_txn;

  PERFORM public.wf_post_ledger('cash', v_amount, 0, v_currency, 'wallet_topup', v_txn, coalesce(p_memo, 'Wallet top-up ' || v_email));
  PERFORM public.wf_post_ledger('client_prepaid', 0, v_amount, v_currency, 'wallet_topup', v_txn, coalesce(p_memo, 'Wallet top-up ' || v_email));

  INSERT INTO public.wf_audit_events (actor_email, action, entity_type, entity_id, meta)
  VALUES (p_actor, 'wallet.credited', 'wallet', v_wallet.id,
          jsonb_build_object('amount', v_amount, 'currency', v_currency, 'tapChargeId', p_tap_charge_id, 'memo', p_memo));

  RETURN jsonb_build_object('wallet', to_jsonb(v_wallet), 'txnId', v_txn);
END
$$;

-- Pay an invoice. p_method: manual (admin recorded) | tap | wallet.
-- Idempotent for the same provider ref; creates the pending talent payout.
CREATE OR REPLACE FUNCTION public.wf_pay_invoice(
  p_invoice_id uuid, p_method text, p_provider_ref text DEFAULT NULL,
  p_payer_email text DEFAULT NULL, p_actor text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_inv public.wf_invoices%ROWTYPE;
  v_wallet public.wf_wallets%ROWTYPE;
  v_talent_email text;
  v_account uuid;
  v_payout uuid;
  v_txn uuid;
  v_ref text := nullif(trim(p_provider_ref), '');
BEGIN
  IF p_method NOT IN ('manual', 'tap', 'wallet') THEN
    RAISE EXCEPTION 'Invalid payment method' USING HINT = 'INVALID_METHOD';
  END IF;

  SELECT * INTO v_inv FROM public.wf_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING HINT = 'NOT_FOUND';
  END IF;
  IF v_inv.status = 'void' THEN
    RAISE EXCEPTION 'Cannot pay a void invoice' USING HINT = 'VOID';
  END IF;
  IF v_inv.status = 'paid' THEN
    IF v_ref IS NOT NULL AND v_inv.provider_ref = v_ref THEN
      RETURN jsonb_build_object('invoice', to_jsonb(v_inv), 'duplicate', true);
    END IF;
    RAISE EXCEPTION 'Invoice already paid' USING HINT = 'ALREADY_PAID';
  END IF;
  IF v_inv.total <= 0 THEN
    RAISE EXCEPTION 'Cannot pay zero-total invoice' USING HINT = 'ZERO_INVOICE';
  END IF;
  IF round(v_inv.subtotal + v_inv.fee_amount, 2) <> round(v_inv.total, 2) THEN
    RAISE EXCEPTION 'Invoice totals do not balance' USING HINT = 'LEDGER_UNBALANCED';
  END IF;
  IF p_payer_email IS NOT NULL AND lower(trim(coalesce(v_inv.client_email, ''))) <> lower(trim(p_payer_email)) THEN
    RAISE EXCEPTION 'Not your invoice' USING HINT = 'FORBIDDEN';
  END IF;

  IF p_method = 'wallet' THEN
    SELECT * INTO v_wallet FROM public.wf_wallets
    WHERE owner_email = lower(trim(v_inv.client_email)) AND currency = v_inv.currency
    FOR UPDATE;
    IF NOT FOUND OR v_wallet.balance < v_inv.total THEN
      RAISE EXCEPTION 'Wallet balance too low — top up first' USING HINT = 'INSUFFICIENT_WALLET';
    END IF;
    UPDATE public.wf_wallets SET balance = balance - v_inv.total, updated_at = now() WHERE id = v_wallet.id;
    INSERT INTO public.wf_wallet_txns (wallet_id, kind, amount, currency, invoice_id, memo)
    VALUES (v_wallet.id, 'spend', v_inv.total, v_inv.currency, v_inv.id, 'Pay ' || v_inv.invoice_number)
    RETURNING id INTO v_txn;
    v_ref := coalesce(v_ref, 'wallet_' || v_txn::text);
  END IF;

  UPDATE public.wf_invoices
  SET status = 'paid', paid_at = now(), updated_at = now(),
      payment_provider = p_method, provider_ref = coalesce(v_ref, 'manual_' || left(v_inv.id::text, 8))
  WHERE id = v_inv.id
  RETURNING * INTO v_inv;

  PERFORM public.wf_post_ledger(CASE WHEN p_method = 'wallet' THEN 'client_prepaid' ELSE 'cash' END,
    v_inv.total, 0, v_inv.currency, 'invoice', v_inv.id, 'Paid ' || v_inv.invoice_number);
  PERFORM public.wf_post_ledger('talent_payable', 0, v_inv.subtotal, v_inv.currency, 'invoice', v_inv.id, 'Paid ' || v_inv.invoice_number);
  PERFORM public.wf_post_ledger('byg_fee_revenue', 0, v_inv.fee_amount, v_inv.currency, 'invoice', v_inv.id, 'Paid ' || v_inv.invoice_number);

  IF v_inv.subtotal > 0 THEN
    SELECT talent_email INTO v_talent_email FROM public.wf_engagements WHERE id = v_inv.engagement_id;
    SELECT id INTO v_account FROM public.wf_payment_accounts
    WHERE owner_type = 'talent' AND lower(owner_email) = lower(v_talent_email) AND status = 'verified'
    ORDER BY updated_at DESC LIMIT 1;
    INSERT INTO public.wf_payouts (engagement_id, invoice_id, payment_account_id, amount, currency, status)
    VALUES (v_inv.engagement_id, v_inv.id, v_account, v_inv.subtotal, v_inv.currency, 'pending')
    ON CONFLICT (invoice_id) WHERE status <> 'cancelled' AND invoice_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_payout;
  END IF;

  INSERT INTO public.wf_audit_events (actor_email, action, entity_type, entity_id, meta)
  VALUES (p_actor, 'invoice.paid', 'invoice', v_inv.id,
          jsonb_build_object('total', v_inv.total, 'method', p_method, 'providerRef', v_inv.provider_ref));

  RETURN jsonb_build_object('invoice', to_jsonb(v_inv), 'payoutId', v_payout, 'walletTxnId', v_txn, 'duplicate', false);
END
$$;

-- Apply a CAPTURED Tap charge exactly once. Amount/currency must match what we created.
-- If the invoice was already paid another way, the money is credited to the client wallet.
CREATE OR REPLACE FUNCTION public.wf_fulfill_tap_charge(
  p_charge_id text, p_amount numeric, p_currency text, p_actor text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_charge public.wf_tap_charges%ROWTYPE;
  v_inv_status text;
  v_result jsonb;
BEGIN
  SELECT * INTO v_charge FROM public.wf_tap_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown Tap charge' USING HINT = 'UNKNOWN_CHARGE';
  END IF;
  IF v_charge.status = 'captured' THEN
    RETURN jsonb_build_object('duplicate', true, 'purpose', v_charge.purpose, 'invoiceId', v_charge.invoice_id);
  END IF;
  IF round(p_amount, 2) <> round(v_charge.amount, 2) OR upper(p_currency) <> upper(v_charge.currency) THEN
    RAISE EXCEPTION 'Tap charge amount mismatch (got % %, expected % %)',
      p_amount, p_currency, v_charge.amount, v_charge.currency USING HINT = 'AMOUNT_MISMATCH';
  END IF;

  IF v_charge.purpose = 'invoice_pay' THEN
    SELECT status INTO v_inv_status FROM public.wf_invoices WHERE id = v_charge.invoice_id FOR UPDATE;
    IF v_inv_status = 'paid' OR v_inv_status = 'void' OR v_inv_status IS NULL THEN
      v_result := public.wf_wallet_credit(v_charge.owner_email, v_charge.currency, v_charge.amount,
        'Card payment ' || v_charge.id || ' credited to wallet (invoice already settled)', v_charge.id, p_actor);
      v_result := v_result || jsonb_build_object('creditedToWallet', true);
    ELSE
      v_result := public.wf_pay_invoice(v_charge.invoice_id, 'tap', v_charge.id, NULL, p_actor);
    END IF;
  ELSIF v_charge.purpose = 'wallet_topup' THEN
    v_result := public.wf_wallet_credit(v_charge.owner_email, v_charge.currency, v_charge.amount,
      'Tap top-up ' || v_charge.id, v_charge.id, p_actor);
  ELSE
    RAISE EXCEPTION 'Unknown Tap purpose %', v_charge.purpose USING HINT = 'INVALID_CHARGE';
  END IF;

  UPDATE public.wf_tap_charges SET status = 'captured', captured_at = now() WHERE id = v_charge.id;
  RETURN v_result || jsonb_build_object('purpose', v_charge.purpose, 'invoiceId', v_charge.invoice_id, 'duplicate', false);
END
$$;

-- Mark a pending payout as sent (after the bank / Wise / Payoneer transfer is made).
CREATE OR REPLACE FUNCTION public.wf_release_payout(
  p_payout_id uuid, p_reference text DEFAULT NULL, p_actor text DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_payout public.wf_payouts%ROWTYPE;
BEGIN
  SELECT * INTO v_payout FROM public.wf_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout not found' USING HINT = 'NOT_FOUND';
  END IF;
  IF v_payout.status <> 'pending' THEN
    RAISE EXCEPTION 'Payout is not pending' USING HINT = 'NOT_PENDING';
  END IF;

  UPDATE public.wf_payouts
  SET status = 'sent', sent_at = now(),
      provider_ref = coalesce(nullif(trim(p_reference), ''), 'manual_' || left(id::text, 8)),
      notes = nullif(trim(p_notes), ''), released_by = p_actor
  WHERE id = v_payout.id
  RETURNING * INTO v_payout;

  PERFORM public.wf_post_ledger('talent_payable', v_payout.amount, 0, v_payout.currency, 'payout', v_payout.id, 'Talent payout released');
  PERFORM public.wf_post_ledger('cash', 0, v_payout.amount, v_payout.currency, 'payout', v_payout.id, 'Talent payout released');

  INSERT INTO public.wf_audit_events (actor_email, action, entity_type, entity_id, meta)
  VALUES (p_actor, 'payout.sent', 'payout', v_payout.id, jsonb_build_object('amount', v_payout.amount, 'reference', v_payout.provider_ref));

  RETURN jsonb_build_object('payout', to_jsonb(v_payout));
END
$$;

-- ─── 5. Lock down: backend (service_role) only ──────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'wf\_%' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END
$$;

REVOKE EXECUTE ON FUNCTION public.wf_post_ledger(text, numeric, numeric, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wf_wallet_credit(text, text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wf_pay_invoice(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wf_fulfill_tap_charge(text, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wf_release_payout(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.wf_post_ledger(text, numeric, numeric, text, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wf_wallet_credit(text, text, numeric, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wf_pay_invoice(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wf_fulfill_tap_charge(text, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wf_release_payout(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wf_period_start(date, text, integer) TO service_role;

-- Refresh PostgREST so the new functions are callable immediately.
NOTIFY pgrst, 'reload schema';

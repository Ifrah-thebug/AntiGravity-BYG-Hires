/**
 * Supabase persistence for Workforce HRIS.
 * Requires workforce_hris.sql, workforce_contract_v2.sql, workforce_tap_wallet.sql
 * and workforce_v3_production.sql. Money movements run inside the row-locked SQL
 * functions from v3 (wf_pay_invoice, wf_fulfill_tap_charge, wf_wallet_credit,
 * wf_release_payout) so concurrent webhooks / clicks cannot double-apply.
 */
const crypto = require('crypto');
const { supabaseAdmin } = require('../../middleware/requireAdmin');
const {
  normalizeEmail,
  roundMoney,
  assertSignerAllowed,
  validateEngagementInput,
  buildPeriodInvoice,
  newInvoiceNumber,
  OPEN_ENGAGEMENT,
  ENGAGEMENT_STATUSES,
} = require('./engine');
const {
  BYG_CONTRACT_HTML,
  BYG_CONTRACT_REQUIRED_FIELDS,
  renderContractHtml,
  normalizeSignatureData,
  buildFilledFields,
  stampSignaturesOnHtml,
  isFullySigned,
} = require('./bygContractTemplate');
const { reviewContractContent } = require('./aiContractReview');
const { isIsoDate, todayIso, duePeriodIndexes } = require('./periods');

function assert(condition, code, message) {
  if (!condition) {
    const err = new Error(message);
    err.code = code;
    throw err;
  }
}

function isMissingSchema(err) {
  const msg = String(err?.message || err?.details || '');
  return err?.code === '42P01' || err?.code === 'PGRST202' || /does not exist|schema cache|Could not find the (table|function)/i.test(msg);
}

/** Turn a PostgREST / Postgres error into one with a stable `code` for routes. */
function dbError(error) {
  if (isMissingSchema(error)) {
    const err = new Error('Workforce database is not migrated — run supabase/workforce_v3_production.sql.');
    err.code = 'SCHEMA_MISSING';
    return err;
  }
  const err = new Error(error.message || 'Database error');
  err.code = /^[A-Z_]+$/.test(String(error.hint || '')) ? error.hint : 'DB_ERROR';
  err.pgCode = error.code;
  return err;
}

function check(error) {
  if (error) throw dbError(error);
}

async function rpc(name, args) {
  const { data, error } = await supabaseAdmin.rpc(name, args);
  check(error);
  return data;
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function hashDoc(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

const nowIso = () => new Date().toISOString();

// ─── Mappers ────────────────────────────────────────────────────────────────
function mapEngagement(row, salary = null) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientEmail: row.client_email,
    talentUserId: row.talent_user_id,
    talentEmail: row.talent_email,
    talentName: row.talent_name,
    roleTitle: row.role_title,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    endedReason: row.ended_reason || null,
    jobId: row.job_id || null,
    introBookingId: row.intro_booking_id,
    ambassadorPlacementId: row.ambassador_placement_id,
    externalIds: row.external_ids || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    salary,
  };
}

function mapSalary(row) {
  if (!row) return null;
  return {
    id: row.id,
    engagementId: row.engagement_id,
    amount: Number(row.amount),
    currency: row.currency,
    cadence: row.cadence,
    bygFeePercent: Number(row.byg_fee_percent),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    createdAt: row.created_at,
  };
}

function mapContract(row) {
  if (!row) return null;
  return {
    id: row.id,
    engagementId: row.engagement_id,
    templateId: row.template_id,
    filledFields: row.filled_fields || {},
    renderedHtml: row.rendered_html || null,
    status: row.status,
    aiReviewStatus: row.ai_review_status,
    aiFindings: row.ai_findings || [],
    aiRaw: row.ai_raw,
    docHash: row.doc_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSignature(row) {
  return {
    id: row.id,
    contractId: row.contract_id,
    role: row.role,
    signerEmail: row.signer_email,
    signatureData: row.signature_data,
    consent: row.consent,
    signedAt: row.signed_at,
    createdAt: row.created_at,
  };
}

function mapInvoice(row) {
  if (!row) return null;
  return {
    id: row.id,
    engagementId: row.engagement_id,
    payrollItemId: row.payroll_item_id,
    invoiceNumber: row.invoice_number,
    status: row.status,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    feeAmount: Number(row.fee_amount),
    total: Number(row.total),
    dueDate: row.due_date,
    periodIndex: row.period_index ?? null,
    periodStart: row.period_start || null,
    periodEnd: row.period_end || null,
    paidAt: row.paid_at,
    paymentProvider: row.payment_provider || null,
    providerRef: row.provider_ref || null,
    clientName: row.client_name,
    clientEmail: row.client_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWallet(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: normalizeEmail(row.owner_email),
    currency: row.currency,
    balance: Number(row.balance),
    autoPay: Boolean(row.auto_pay),
    updatedAt: row.updated_at,
  };
}

function mapWalletTxn(row) {
  return {
    id: row.id,
    walletId: row.wallet_id,
    kind: row.kind,
    amount: Number(row.amount),
    currency: row.currency,
    tapChargeId: row.tap_charge_id,
    invoiceId: row.invoice_id,
    memo: row.memo,
    createdAt: row.created_at,
  };
}

function mapPayout(row) {
  if (!row) return null;
  return {
    id: row.id,
    engagementId: row.engagement_id,
    invoiceId: row.invoice_id,
    paymentAccountId: row.payment_account_id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    providerRef: row.provider_ref,
    notes: row.notes || null,
    releasedBy: row.released_by || null,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

function mapPaymentAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerEmail: row.owner_email,
    provider: row.provider,
    maskedLabel: row.masked_label,
    details: row.details || {},
    status: row.status,
    verifiedAt: row.verified_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    clientEmail: row.client_email,
    clientName: row.client_name,
    title: row.title,
    description: row.description,
    skills: row.skills || [],
    location: row.location,
    employmentType: row.employment_type,
    budgetMin: row.budget_min == null ? null : Number(row.budget_min),
    budgetMax: row.budget_max == null ? null : Number(row.budget_max),
    currency: row.currency,
    headcount: row.headcount,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

function mapCandidate(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    talentProfileId: row.talent_profile_id,
    talentEmail: row.talent_email,
    talentName: row.talent_name,
    talentTitle: row.talent_title,
    stage: row.stage,
    source: row.source,
    notes: row.notes,
    engagementId: row.engagement_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────
async function audit(action, entityType, entityId, meta = {}, actorEmail = null) {
  const { error } = await supabaseAdmin.from('wf_audit_events').insert({
    actor_email: actorEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    meta,
  });
  if (error) console.warn('[workforce] audit insert failed:', error.message);
}

async function salariesFor(engagementIds) {
  if (!engagementIds.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('wf_salary_schedules')
    .select('*')
    .in('engagement_id', engagementIds)
    .is('effective_to', null);
  check(error);
  return new Map((data || []).map((r) => [r.engagement_id, mapSalary(r)]));
}

async function templateBody(templateId) {
  if (!templateId) return { body_html: BYG_CONTRACT_HTML, required_fields: BYG_CONTRACT_REQUIRED_FIELDS };
  const { data } = await supabaseAdmin
    .from('wf_contract_templates')
    .select('body_html, required_fields')
    .eq('id', templateId)
    .maybeSingle();
  return data || { body_html: BYG_CONTRACT_HTML, required_fields: BYG_CONTRACT_REQUIRED_FIELDS };
}

async function withRenderedHtml(contract) {
  if (!contract || contract.renderedHtml) return contract;
  const t = await templateBody(contract.templateId);
  return { ...contract, renderedHtml: renderContractHtml(t.body_html, contract.filledFields) };
}

function chunk(arr, size = 200) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function ledgerBalance(code) {
  const { data: acc, error } = await supabaseAdmin.from('wf_ledger_accounts').select('*').eq('code', code).maybeSingle();
  check(error);
  if (!acc) return 0;
  const { data, error: eErr } = await supabaseAdmin.from('wf_ledger_entries').select('debit, credit').eq('account_id', acc.id);
  check(eErr);
  const debit = (data || []).reduce((s, r) => s + Number(r.debit), 0);
  const credit = (data || []).reduce((s, r) => s + Number(r.credit), 0);
  return acc.kind === 'asset' || acc.kind === 'expense' ? roundMoney(debit - credit) : roundMoney(credit - debit);
}

// ─── Store ──────────────────────────────────────────────────────────────────
const supabaseStore = {
  isReady() {
    return Boolean(supabaseAdmin);
  },

  /** Throws SCHEMA_MISSING unless every migration (incl. v3) is applied. */
  async ping() {
    assert(supabaseAdmin, 'DB_MISSING', 'Supabase not configured');
    for (const table of ['wf_engagements', 'wf_wallets', 'wf_jobs']) {
      const { error } = await supabaseAdmin.from(table).select('id').limit(1);
      check(error);
    }
    const { error } = await supabaseAdmin.from('wf_invoices').select('period_index').limit(1);
    check(error);
    return true;
  },

  // ── Engagements ──
  async createEngagement(input, actorEmail = null) {
    const v = validateEngagementInput(input);

    let q = supabaseAdmin
      .from('wf_engagements')
      .select('*')
      .eq('talent_email', v.talentEmail)
      .in('status', OPEN_ENGAGEMENT)
      .limit(1);
    q = v.clientEmail ? q.eq('client_email', v.clientEmail) : q.ilike('client_name', v.clientName.replace(/[%_]/g, '\\$&'));
    const { data: existingRows, error: exErr } = await q;
    check(exErr);
    if (existingRows?.[0]) {
      const salary = (await salariesFor([existingRows[0].id])).get(existingRows[0].id) || null;
      return { engagement: mapEngagement(existingRows[0], salary), salary, created: false };
    }

    const { data: eng, error } = await supabaseAdmin
      .from('wf_engagements')
      .insert({
        client_id: input.clientId || null,
        client_name: v.clientName,
        client_email: v.clientEmail,
        talent_user_id: input.talentUserId || null,
        talent_email: v.talentEmail,
        talent_name: input.talentName || null,
        role_title: v.roleTitle,
        status: 'offered',
        start_date: v.startDate,
        job_id: input.jobId || null,
        intro_booking_id: input.introBookingId || null,
        ambassador_placement_id: input.ambassadorPlacementId || null,
        external_ids: input.externalIds || {},
      })
      .select('*')
      .single();
    check(error);

    const { data: salaryRow, error: sErr } = await supabaseAdmin
      .from('wf_salary_schedules')
      .insert({
        engagement_id: eng.id,
        amount: v.amount,
        currency: v.currency,
        cadence: v.cadence,
        byg_fee_percent: v.fee,
        effective_from: v.startDate,
      })
      .select('*')
      .single();
    check(sErr);

    await audit('engagement.created', 'engagement', eng.id, { talentEmail: v.talentEmail, amount: v.amount }, actorEmail);
    const salary = mapSalary(salaryRow);

    let contract = null;
    try {
      contract = await this.createContractFromTemplate(eng.id, actorEmail);
      contract = await this.reviewContract(contract.id, actorEmail);
    } catch (cErr) {
      console.warn('[workforce] auto-contract:', cErr?.message || cErr);
    }
    const fresh = await this.getEngagement(eng.id);
    return { engagement: fresh, salary, contract, created: true };
  },

  async listEngagements(filter = {}) {
    let q = supabaseAdmin.from('wf_engagements').select('*').order('created_at', { ascending: false });
    if (filter.talentEmail) q = q.eq('talent_email', normalizeEmail(filter.talentEmail));
    if (filter.clientEmail) q = q.eq('client_email', normalizeEmail(filter.clientEmail));
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.jobId) q = q.eq('job_id', filter.jobId);
    const { data, error } = await q;
    check(error);
    const rows = data || [];
    const salaries = await salariesFor(rows.map((r) => r.id));
    return rows.map((r) => mapEngagement(r, salaries.get(r.id) || null));
  },

  /**
   * Profile ids for talents with an open workforce hire (offered → paused).
   * Used by the public directory to blur cards and hide rates — no PII returned.
   */
  async listHiredDirectoryProfileIds() {
    const { data: rows, error } = await supabaseAdmin
      .from('wf_engagements')
      .select('talent_user_id, talent_email')
      .in('status', OPEN_ENGAGEMENT);
    check(error);

    const userIds = [...new Set((rows || []).map((r) => r.talent_user_id).filter(Boolean))];
    const emails = [
      ...new Set(
        (rows || [])
          .map((r) => normalizeEmail(r.talent_email))
          .filter(Boolean)
      ),
    ];

    const ids = new Set();

    if (userIds.length) {
      const { data, error: uErr } = await supabaseAdmin.from('profiles').select('id').in('user_id', userIds);
      check(uErr);
      for (const p of data || []) if (p?.id) ids.add(p.id);
    }

    if (emails.length) {
      const { data, error: eErr } = await supabaseAdmin.from('profiles').select('id').in('email', emails);
      if (eErr) {
        console.warn('[workforce] hired profile email lookup:', eErr.message || eErr);
      } else {
        for (const p of data || []) if (p?.id) ids.add(p.id);
      }
    }

    return [...ids];
  },

  async getEngagement(id) {
    const { data, error } = await supabaseAdmin.from('wf_engagements').select('*').eq('id', id).maybeSingle();
    check(error);
    assert(data, 'NOT_FOUND', 'Engagement not found');
    return mapEngagement(data, (await salariesFor([id])).get(id) || null);
  },

  async updateEngagementStatus(id, status, { reason = null, endDate = null } = {}, actorEmail = null) {
    assert(ENGAGEMENT_STATUSES.includes(status), 'INVALID_STATUS', 'Invalid engagement status');
    const eng = await this.getEngagement(id);
    assert(eng.status !== 'ended', 'ENGAGEMENT_ENDED', 'Engagement has already ended');
    if (status === 'active') {
      const { data: signed } = await supabaseAdmin
        .from('wf_contracts')
        .select('id')
        .eq('engagement_id', id)
        .eq('status', 'signed')
        .limit(1);
      assert(signed?.length, 'CONTRACT_REQUIRED', 'Cannot activate engagement without a signed contract');
    }
    const patch = { status, updated_at: nowIso() };
    if (status === 'ended') {
      const end = endDate || todayIso();
      assert(isIsoDate(end), 'INVALID_DATE', 'End date must be YYYY-MM-DD');
      patch.end_date = end;
      patch.ended_reason = reason ? String(reason).slice(0, 500) : null;
    }
    const { error } = await supabaseAdmin.from('wf_engagements').update(patch).eq('id', id);
    check(error);
    await audit('engagement.status', 'engagement', id, { prev: eng.status, status, reason }, actorEmail);
    return this.getEngagement(id);
  },

  // ── Contracts ──
  async createContractFromTemplate(engagementId, actorEmail = null) {
    const eng = await this.getEngagement(engagementId);
    assert(eng.salary, 'NO_SALARY', 'Engagement has no salary schedule');

    const { data: open } = await supabaseAdmin
      .from('wf_contracts')
      .select('*')
      .eq('engagement_id', engagementId)
      .not('status', 'in', '("void","signed")')
      .limit(1);
    if (open?.[0]) return withRenderedHtml(mapContract(open[0]));

    const { data: template } = await supabaseAdmin
      .from('wf_contract_templates')
      .select('*')
      .eq('active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    assert(template, 'NO_TEMPLATE', 'No active contract template — run workforce_contract_v2.sql');

    const filled = buildFilledFields(eng, eng.salary);
    const { data: contract, error } = await supabaseAdmin
      .from('wf_contracts')
      .insert({
        engagement_id: engagementId,
        template_id: template.id,
        filled_fields: filled,
        rendered_html: renderContractHtml(template.body_html || BYG_CONTRACT_HTML, filled),
        status: 'draft',
      })
      .select('*')
      .single();
    check(error);

    if (eng.status === 'offered') {
      await supabaseAdmin.from('wf_engagements').update({ status: 'contracted', updated_at: nowIso() }).eq('id', engagementId);
    }
    await audit('contract.created', 'contract', contract.id, {}, actorEmail);
    return mapContract(contract);
  },

  async listContracts(filter = {}) {
    let q = supabaseAdmin.from('wf_contracts').select('*').order('created_at', { ascending: false });
    if (filter.engagementId) q = q.eq('engagement_id', filter.engagementId);
    if (filter.engagementIds) {
      if (!filter.engagementIds.length) return [];
      q = q.in('engagement_id', filter.engagementIds);
    }
    if (filter.status) q = q.eq('status', filter.status);
    const { data, error } = await q;
    check(error);
    return Promise.all((data || []).map((r) => withRenderedHtml(mapContract(r))));
  },

  async getContract(id) {
    const { data, error } = await supabaseAdmin.from('wf_contracts').select('*').eq('id', id).maybeSingle();
    check(error);
    assert(data, 'NOT_FOUND', 'Contract not found');
    return withRenderedHtml(mapContract(data));
  },

  async fillContract(contractId, fields, actorEmail = null) {
    const contract = await this.getContract(contractId);
    assert(
      ['draft', 'needs_fixes', 'pending_ai', 'ready_to_sign'].includes(contract.status),
      'CONTRACT_LOCKED',
      'Contract cannot be edited in current status'
    );
    const filled = { ...contract.filledFields, ...fields };
    const t = await templateBody(contract.templateId);
    const { data, error } = await supabaseAdmin
      .from('wf_contracts')
      .update({
        filled_fields: filled,
        rendered_html: renderContractHtml(t.body_html, filled),
        status: 'draft',
        ai_review_status: null,
        ai_findings: [],
        updated_at: nowIso(),
      })
      .eq('id', contractId)
      .select('*')
      .single();
    check(error);
    await audit('contract.filled', 'contract', contractId, { keys: Object.keys(fields || {}) }, actorEmail);
    return mapContract(data);
  },

  async reviewContract(contractId, actorEmail = null) {
    const contract = await this.getContract(contractId);
    const eng = await this.getEngagement(contract.engagementId);
    const t = await templateBody(contract.templateId);

    const result = await reviewContractContent({
      filledFields: contract.filledFields,
      salary: eng.salary,
      requiredFields: t.required_fields || BYG_CONTRACT_REQUIRED_FIELDS,
      templateHtml: t.body_html || BYG_CONTRACT_HTML,
    });
    const nextStatus =
      result.status === 'pass' ? 'ready_to_sign' : result.status === 'escalate' ? 'pending_ai' : 'needs_fixes';

    const { data, error } = await supabaseAdmin
      .from('wf_contracts')
      .update({
        rendered_html: result.renderedHtml,
        ai_review_status: result.status,
        ai_findings: result.findings,
        ai_raw: JSON.stringify({
          reviewedAt: nowIso(),
          source: result.source,
          summary: result.summary || null,
          findings: result.findings,
        }),
        status: nextStatus,
        updated_at: nowIso(),
      })
      .eq('id', contractId)
      .select('*')
      .single();
    check(error);
    await audit(
      'contract.ai_review',
      'contract',
      contractId,
      { status: result.status, count: result.findings.length, source: result.source },
      actorEmail
    );
    return mapContract(data);
  },

  /**
   * Move the start date before the contract is fully signed. The document changes,
   * so signatures already given are cleared and those parties sign again.
   */
  async changeStartDate(contractId, startDate, actorEmail = null) {
    assert(isIsoDate(startDate), 'INVALID_DATE', 'Start date must be YYYY-MM-DD');
    const contract = await this.getContract(contractId);
    assert(!['signed', 'void'].includes(contract.status), 'CONTRACT_LOCKED', 'A fully signed contract cannot be changed');

    const { data: removed, error: sErr } = await supabaseAdmin
      .from('wf_signatures')
      .delete()
      .eq('contract_id', contractId)
      .select('role, signed_at');
    check(sErr);
    const clearedRoles = (removed || []).filter((s) => s.signed_at).map((s) => s.role);

    const { error: eErr } = await supabaseAdmin
      .from('wf_engagements')
      .update({ start_date: startDate, updated_at: nowIso() })
      .eq('id', contract.engagementId);
    check(eErr);
    const { error: salErr } = await supabaseAdmin
      .from('wf_salary_schedules')
      .update({ effective_from: startDate })
      .eq('engagement_id', contract.engagementId)
      .is('effective_to', null);
    check(salErr);
    const { error: cErr } = await supabaseAdmin
      .from('wf_contracts')
      .update({ status: 'draft', doc_hash: null, updated_at: nowIso() })
      .eq('id', contractId);
    check(cErr);

    await this.fillContract(contractId, { start_date: startDate }, actorEmail);
    const reviewed = await this.reviewContract(contractId, actorEmail);
    await audit('contract.start_date_changed', 'contract', contractId, { startDate, clearedRoles }, actorEmail);
    return { contract: reviewed, clearedRoles };
  },

  async requestSignatureOtp(contractId, role, signerEmail) {
    assert(['client', 'talent'].includes(role), 'INVALID_ROLE', 'Invalid signer role');
    const contract = await this.getContract(contractId);
    assert(['ready_to_sign', 'partially_signed'].includes(contract.status), 'NOT_READY', 'Contract is not ready to sign');
    assert(contract.aiReviewStatus === 'pass', 'AI_BLOCK', 'AI review must pass before signing');
    assertSignerAllowed(await this.getEngagement(contract.engagementId), role, signerEmail);

    const email = normalizeEmail(signerEmail);
    const otp = String(crypto.randomInt(100000, 1000000));
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from('wf_signatures')
      .select('*')
      .eq('contract_id', contractId)
      .eq('role', role)
      .maybeSingle();
    assert(!existing?.signed_at, 'ALREADY_SIGNED', `${role} already signed`);

    const { data, error } = await supabaseAdmin
      .from('wf_signatures')
      .upsert(
        { contract_id: contractId, role, signer_email: email, otp_hash: hashOtp(otp), otp_expires_at: expires },
        { onConflict: 'contract_id,role' }
      )
      .select('id')
      .single();
    check(error);
    return { signatureId: data.id, otp, expiresAt: expires };
  },

  async signContract(contractId, role, { otp, signatureData, consent, ip, signerEmail }) {
    const contract = await this.getContract(contractId);
    const eng = await this.getEngagement(contract.engagementId);
    assertSignerAllowed(eng, role, signerEmail);
    assert(consent === true, 'CONSENT_REQUIRED', 'Consent is required to sign');
    const cleanSig = normalizeSignatureData(signatureData);
    assert(cleanSig, 'SIGNATURE_REQUIRED', 'Type your full name or draw a signature');
    assert(['ready_to_sign', 'partially_signed'].includes(contract.status), 'NOT_READY', 'Contract is not ready to sign');
    assert(contract.aiReviewStatus === 'pass', 'AI_BLOCK', 'AI review must pass before signing');

    const email = normalizeEmail(signerEmail);
    let { data: sig } = await supabaseAdmin
      .from('wf_signatures')
      .select('*')
      .eq('contract_id', contractId)
      .eq('role', role)
      .maybeSingle();
    if (!sig) {
      const { data: created, error: cErr } = await supabaseAdmin
        .from('wf_signatures')
        .insert({ contract_id: contractId, role, signer_email: email })
        .select('*')
        .single();
      check(cErr);
      sig = created;
    }
    assert(!sig.signed_at, 'ALREADY_SIGNED', `${role} already signed`);
    if (sig.otp_hash) {
      assert(sig.otp_expires_at && new Date(sig.otp_expires_at) > new Date(), 'OTP_EXPIRED', 'OTP expired');
      assert(sig.otp_hash === hashOtp(otp), 'OTP_INVALID', 'Invalid OTP');
    }

    const docHash =
      contract.docHash ||
      hashDoc({ engagementId: contract.engagementId, filledFields: contract.filledFields, templateId: contract.templateId });

    // Conditional update: only the first concurrent request for this role wins.
    const { data: signedRow, error: sErr } = await supabaseAdmin
      .from('wf_signatures')
      .update({
        signature_data: cleanSig,
        consent: true,
        ip: ip || null,
        signed_at: nowIso(),
        doc_hash: docHash,
        signer_email: email || sig.signer_email,
      })
      .eq('id', sig.id)
      .is('signed_at', null)
      .select('id')
      .maybeSingle();
    check(sErr);
    assert(signedRow, 'ALREADY_SIGNED', `${role} already signed`);

    const signatures = await this.listSignatures(contractId);
    const signed = signatures.filter((s) => s.signedAt);
    const signedRoles = signed.map((s) => s.role);
    const complete = isFullySigned(signedRoles);

    const { data: updated, error } = await supabaseAdmin
      .from('wf_contracts')
      .update({
        status: complete ? 'signed' : 'partially_signed',
        rendered_html: stampSignaturesOnHtml(contract.renderedHtml, signed),
        doc_hash: docHash,
        updated_at: nowIso(),
      })
      .eq('id', contractId)
      .select('*')
      .single();
    check(error);

    let invoice = null;
    if (complete) {
      await supabaseAdmin
        .from('wf_engagements')
        .update({ status: 'active', updated_at: nowIso() })
        .eq('id', contract.engagementId)
        .neq('status', 'ended');
      invoice = (await this.issueInvoiceForPeriod(contract.engagementId, 0, email)).invoice;
      await this.markCandidateHired(contract.engagementId);
    }

    await audit('contract.signed', 'contract', contractId, { role, complete, roles: signedRoles }, email);
    return { ...mapContract(updated), signatures, complete, signedRoles, invoice };
  },

  async listSignatures(contractId) {
    const { data, error } = await supabaseAdmin.from('wf_signatures').select('*').eq('contract_id', contractId);
    check(error);
    return (data || []).map(mapSignature);
  },

  async listSignaturesFor(contractIds) {
    const out = new Map(contractIds.map((id) => [id, []]));
    for (const ids of chunk(contractIds)) {
      const { data, error } = await supabaseAdmin.from('wf_signatures').select('*').in('contract_id', ids);
      check(error);
      for (const row of data || []) out.get(row.contract_id)?.push(mapSignature(row));
    }
    return out;
  },

  // ── Invoices / billing ──
  async issueInvoiceForPeriod(engagementId, index, actorEmail = null) {
    const findExisting = async () => {
      const { data } = await supabaseAdmin
        .from('wf_invoices')
        .select('*')
        .eq('engagement_id', engagementId)
        .eq('period_index', index)
        .neq('status', 'void')
        .maybeSingle();
      return data ? mapInvoice(data) : null;
    };
    const existing = await findExisting();
    if (existing) return { invoice: existing, created: false };

    const eng = await this.getEngagement(engagementId);
    assert(eng.salary, 'NO_SALARY', 'No salary schedule');
    const draft = buildPeriodInvoice(eng, eng.salary, index);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data: invoice, error } = await supabaseAdmin
        .from('wf_invoices')
        .insert({
          engagement_id: engagementId,
          invoice_number: newInvoiceNumber(),
          status: 'sent',
          currency: draft.currency,
          subtotal: draft.subtotal,
          fee_amount: draft.feeAmount,
          total: draft.total,
          due_date: draft.dueDate,
          period_index: index,
          period_start: draft.bounds.start,
          period_end: draft.bounds.end,
          client_name: eng.clientName,
          client_email: eng.clientEmail,
        })
        .select('*')
        .single();
      if (error?.code === '23505') {
        // Period already billed by a concurrent request, or invoice number collision → retry.
        const raced = await findExisting();
        if (raced) return { invoice: raced, created: false };
        continue;
      }
      check(error);
      const { error: lErr } = await supabaseAdmin
        .from('wf_invoice_line_items')
        .insert(draft.lines.map((l, i) => ({ invoice_id: invoice.id, description: l.description, amount: l.amount, sort_order: i + 1 })));
      check(lErr);
      await audit('invoice.issued', 'invoice', invoice.id, { engagementId, periodIndex: index }, actorEmail);
      return { invoice: mapInvoice(invoice), created: true };
    }
    assert(false, 'INVOICE_NUMBER', 'Could not allocate an invoice number');
  },

  async issueDueInvoices({ asOf = todayIso(), leadDays = 7 } = {}, actorEmail = null) {
    assert(isIsoDate(asOf), 'INVALID_DATE', 'asOf must be YYYY-MM-DD');
    const active = await this.listEngagements({ status: 'active' });
    const maxIndex = new Map();
    for (const ids of chunk(active.map((e) => e.id))) {
      const { data, error } = await supabaseAdmin
        .from('wf_invoices')
        .select('engagement_id, period_index')
        .in('engagement_id', ids)
        .neq('status', 'void')
        .not('period_index', 'is', null);
      check(error);
      for (const r of data || []) {
        maxIndex.set(r.engagement_id, Math.max(maxIndex.get(r.engagement_id) ?? -1, r.period_index));
      }
    }

    const issued = [];
    for (const eng of active) {
      if (!eng.salary || !eng.startDate) continue;
      const indexes = duePeriodIndexes({
        anchor: eng.startDate,
        cadence: eng.salary.cadence,
        nextIndex: (maxIndex.get(eng.id) ?? -1) + 1,
        asOf,
        leadDays,
        endDate: eng.endDate,
      });
      for (const index of indexes) {
        const { invoice, created } = await this.issueInvoiceForPeriod(eng.id, index, actorEmail);
        if (created) issued.push(invoice);
      }
    }
    return { asOf, issued };
  },

  async listInvoices(filter = {}) {
    let q = supabaseAdmin.from('wf_invoices').select('*').order('created_at', { ascending: false });
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.clientEmail) q = q.eq('client_email', normalizeEmail(filter.clientEmail));
    if (filter.engagementId) q = q.eq('engagement_id', filter.engagementId);
    const { data, error } = await q;
    check(error);
    return (data || []).map(mapInvoice);
  },

  async getInvoice(invoiceId) {
    const { data, error } = await supabaseAdmin.from('wf_invoices').select('*').eq('id', invoiceId).maybeSingle();
    check(error);
    assert(data, 'NOT_FOUND', 'Invoice not found');
    return mapInvoice(data);
  },

  async getInvoiceDocument(invoiceId, { actorEmail = null, asAdmin = false } = {}) {
    const { renderInvoiceHtml, wrapInvoicePrintDocument } = require('./bygInvoiceTemplate');
    const invoice = await this.getInvoice(invoiceId);
    if (!asAdmin) {
      assert(actorEmail, 'FORBIDDEN', 'Sign in required');
      assert(
        normalizeEmail(invoice.clientEmail) === normalizeEmail(actorEmail),
        'FORBIDDEN',
        'Invoices are only visible to the billing client and BYG admin'
      );
    }
    const { data: lines } = await supabaseAdmin
      .from('wf_invoice_line_items')
      .select('description, amount, sort_order')
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true });
    let eng = null;
    try {
      eng = await this.getEngagement(invoice.engagementId);
    } catch (_e) {
      /* optional */
    }
    const mappedLines = (lines || []).map((l) => ({ description: l.description, amount: Number(l.amount) }));
    const renderedHtml = renderInvoiceHtml(invoice, eng, mappedLines);
    return {
      invoice,
      lines: mappedLines,
      renderedHtml,
      printHtml: wrapInvoicePrintDocument(renderedHtml, `Invoice ${invoice.invoiceNumber}`),
      viewerOnly: 'client_and_admin',
    };
  },

  async voidInvoice(invoiceId, actorEmail = null) {
    const { data, error } = await supabaseAdmin
      .from('wf_invoices')
      .update({ status: 'void', updated_at: nowIso() })
      .eq('id', invoiceId)
      .not('status', 'in', '("paid","void")')
      .select('*')
      .maybeSingle();
    check(error);
    if (!data) {
      const inv = await this.getInvoice(invoiceId);
      assert(inv.status !== 'paid', 'ALREADY_PAID', 'Paid invoices cannot be voided');
      assert(false, 'VOID', 'Invoice is already void');
    }
    await audit('invoice.void', 'invoice', invoiceId, {}, actorEmail);
    return mapInvoice(data);
  },

  async payInvoice(invoiceId, { method, providerRef = null, payerEmail = null } = {}, actorEmail = null) {
    const result = await rpc('wf_pay_invoice', {
      p_invoice_id: invoiceId,
      p_method: method,
      p_provider_ref: providerRef,
      p_payer_email: payerEmail ? normalizeEmail(payerEmail) : null,
      p_actor: actorEmail,
    });
    return {
      invoice: mapInvoice(result.invoice),
      payoutId: result.payoutId || null,
      walletTxnId: result.walletTxnId || null,
      duplicate: Boolean(result.duplicate),
    };
  },

  // ── Wallets / Tap ──
  async listWallets(ownerEmail) {
    const { data, error } = await supabaseAdmin
      .from('wf_wallets')
      .select('*')
      .eq('owner_email', normalizeEmail(ownerEmail))
      .order('currency', { ascending: true });
    check(error);
    return (data || []).map(mapWallet);
  },

  async listWalletTxns(ownerEmail, limit = 50) {
    const wallets = await this.listWallets(ownerEmail);
    if (!wallets.length) return [];
    const { data, error } = await supabaseAdmin
      .from('wf_wallet_txns')
      .select('*')
      .in('wallet_id', wallets.map((w) => w.id))
      .order('created_at', { ascending: false })
      .limit(limit);
    check(error);
    return (data || []).map(mapWalletTxn);
  },

  async getOrCreateWallet(ownerEmail, currency = 'USD') {
    const email = normalizeEmail(ownerEmail);
    const cur = String(currency || 'USD').toUpperCase();
    const { error } = await supabaseAdmin
      .from('wf_wallets')
      .upsert({ owner_email: email, currency: cur, balance: 0 }, { onConflict: 'owner_email,currency', ignoreDuplicates: true });
    check(error);
    const { data, error: gErr } = await supabaseAdmin
      .from('wf_wallets')
      .select('*')
      .eq('owner_email', email)
      .eq('currency', cur)
      .single();
    check(gErr);
    return mapWallet(data);
  },

  async setWalletAutoPay(ownerEmail, currency, autoPay) {
    const wallet = await this.getOrCreateWallet(ownerEmail, currency);
    const { data, error } = await supabaseAdmin
      .from('wf_wallets')
      .update({ auto_pay: Boolean(autoPay), updated_at: nowIso() })
      .eq('id', wallet.id)
      .select('*')
      .single();
    check(error);
    return mapWallet(data);
  },

  async walletCredit({ ownerEmail, currency, amount, memo = null, tapChargeId = null }, actorEmail = null) {
    const result = await rpc('wf_wallet_credit', {
      p_owner_email: normalizeEmail(ownerEmail),
      p_currency: String(currency || 'USD').toUpperCase(),
      p_amount: roundMoney(amount),
      p_memo: memo,
      p_tap_charge_id: tapChargeId,
      p_actor: actorEmail,
    });
    return { wallet: mapWallet(result.wallet), txnId: result.txnId };
  },

  async recordTapCharge({ id, purpose, ownerEmail, invoiceId, amount, currency, redirectUrl, meta }) {
    const { data, error } = await supabaseAdmin
      .from('wf_tap_charges')
      .insert({
        id,
        purpose,
        owner_email: normalizeEmail(ownerEmail),
        invoice_id: invoiceId || null,
        amount: roundMoney(amount),
        currency: String(currency).toUpperCase(),
        status: 'initiated',
        redirect_url: redirectUrl || null,
        meta: meta || {},
      })
      .select('*')
      .single();
    check(error);
    return data;
  },

  async getTapCharge(chargeId) {
    const { data, error } = await supabaseAdmin.from('wf_tap_charges').select('*').eq('id', chargeId).maybeSingle();
    check(error);
    return data
      ? {
          id: data.id,
          purpose: data.purpose,
          ownerEmail: data.owner_email,
          invoiceId: data.invoice_id,
          amount: Number(data.amount),
          currency: data.currency,
          status: data.status,
        }
      : null;
  },

  /** Record a terminal non-captured Tap status (FAILED, ABANDONED…). */
  async markTapCharge(chargeId, status) {
    const { error } = await supabaseAdmin
      .from('wf_tap_charges')
      .update({ status })
      .eq('id', chargeId)
      .eq('status', 'initiated');
    check(error);
  },

  async fulfillTapCharge(chargeId, amount, currency, actorEmail = null) {
    const result = await rpc('wf_fulfill_tap_charge', {
      p_charge_id: chargeId,
      p_amount: roundMoney(amount),
      p_currency: String(currency || '').toUpperCase(),
      p_actor: actorEmail,
    });
    return {
      ...result,
      invoice: result.invoice ? mapInvoice(result.invoice) : undefined,
      wallet: result.wallet ? mapWallet(result.wallet) : undefined,
    };
  },

  // ── Payouts / payout accounts ──
  async listPayouts(filter = {}) {
    let q = supabaseAdmin.from('wf_payouts').select('*').order('created_at', { ascending: false });
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.talentEmail) {
      const engs = await this.listEngagements({ talentEmail: filter.talentEmail });
      if (!engs.length) return [];
      q = q.in('engagement_id', engs.map((e) => e.id));
    }
    const { data, error } = await q;
    check(error);
    return (data || []).map(mapPayout);
  },

  async releasePayout(payoutId, { reference = null, notes = null } = {}, actorEmail = null) {
    const result = await rpc('wf_release_payout', {
      p_payout_id: payoutId,
      p_reference: reference,
      p_actor: actorEmail,
      p_notes: notes,
    });
    return mapPayout(result.payout);
  },

  async getPayoutAccount(ownerEmail) {
    const { data, error } = await supabaseAdmin
      .from('wf_payment_accounts')
      .select('*')
      .eq('owner_type', 'talent')
      .eq('owner_email', normalizeEmail(ownerEmail))
      .eq('provider', 'manual')
      .maybeSingle();
    check(error);
    return mapPaymentAccount(data);
  },

  async savePayoutAccount(ownerEmail, { details, maskedLabel }) {
    const email = normalizeEmail(ownerEmail);
    assert(email.includes('@'), 'INVALID_EMAIL', 'Valid email required');
    const { data, error } = await supabaseAdmin
      .from('wf_payment_accounts')
      .upsert(
        {
          owner_type: 'talent',
          owner_email: email,
          provider: 'manual',
          details,
          masked_label: maskedLabel,
          status: 'pending',
          verified_at: null,
          verified_by: null,
          updated_at: nowIso(),
        },
        { onConflict: 'owner_type,owner_email,provider' }
      )
      .select('*')
      .single();
    check(error);
    return mapPaymentAccount(data);
  },

  async verifyPaymentAccount(accountId, actorEmail = null) {
    const { data, error } = await supabaseAdmin
      .from('wf_payment_accounts')
      .update({ status: 'verified', verified_at: nowIso(), verified_by: actorEmail, updated_at: nowIso() })
      .eq('id', accountId)
      .select('*')
      .maybeSingle();
    check(error);
    assert(data, 'NOT_FOUND', 'Payment account not found');
    const engs = await this.listEngagements({ talentEmail: data.owner_email });
    if (engs.length) {
      await supabaseAdmin
        .from('wf_payouts')
        .update({ payment_account_id: data.id })
        .eq('status', 'pending')
        .in('engagement_id', engs.map((e) => e.id));
    }
    await audit('payment_account.verified', 'payment_account', accountId, {}, actorEmail);
    return mapPaymentAccount(data);
  },

  async listPaymentAccounts(filter = {}) {
    let q = supabaseAdmin.from('wf_payment_accounts').select('*').eq('owner_type', 'talent');
    if (filter.status) q = q.eq('status', filter.status);
    const { data, error } = await q.order('updated_at', { ascending: false });
    check(error);
    return (data || []).map(mapPaymentAccount);
  },

  // ── Directory / clients ──
  async getTalentProfile(profileId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, email, name, job_title, directory_status, monthly_fee_usd')
      .eq('id', profileId)
      .maybeSingle();
    if (error && !/invalid input syntax/i.test(error.message || '')) check(error);
    assert(data && data.email && data.directory_status === 'approved', 'TALENT_NOT_FOUND', 'Talent not found in the directory');
    return {
      id: data.id,
      userId: data.user_id,
      email: normalizeEmail(data.email),
      name: data.name || null,
      jobTitle: data.job_title || null,
      suggestedSalary: data.monthly_fee_usd != null ? Number(data.monthly_fee_usd) : null,
    };
  },

  async getClientForUser(user) {
    if (!user) return null;
    const select = 'id, email, name, company, user_id, account_confirmed_at';
    let data = null;
    let error = null;
    if (user.id) {
      ({ data, error } = await supabaseAdmin.from('clients').select(select).eq('user_id', user.id).maybeSingle());
      check(error);
    }
    if (!data && user.email) {
      ({ data, error } = await supabaseAdmin
        .from('clients')
        .select(select)
        .ilike('email', normalizeEmail(user.email).replace(/[%_\\]/g, '\\$&'))
        .limit(1)
        .maybeSingle());
      check(error);
    }
    if (!data) return null;
    return {
      id: data.id,
      email: normalizeEmail(data.email),
      name: data.company || data.name || data.email,
      contactName: data.name || null,
      userId: data.user_id || null,
      activated: Boolean(data.account_confirmed_at),
    };
  },

  async listTalentOptions() {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, email, name, job_title, monthly_fee_usd')
      .eq('directory_status', 'approved')
      .order('name', { ascending: true })
      .limit(2000);
    check(error);
    return (data || [])
      .filter((r) => r.email)
      .map((r) => ({
        id: r.id,
        userId: r.user_id,
        email: normalizeEmail(r.email),
        name: r.name || null,
        jobTitle: r.job_title || null,
        suggestedSalary: r.monthly_fee_usd != null ? Number(r.monthly_fee_usd) : null,
      }));
  },

  async listClientOptions() {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('id, email, name, company, user_id')
      .order('created_at', { ascending: false })
      .limit(2000);
    check(error);
    return (data || []).map((c) => ({
      id: c.id,
      email: normalizeEmail(c.email),
      name: c.company || c.name || c.email,
      contactName: c.name || null,
      userId: c.user_id || null,
    }));
  },

  // ── Jobs ──
  async createJob(client, fields, actorEmail = null) {
    const { data, error } = await supabaseAdmin
      .from('wf_jobs')
      .insert({
        client_id: client.id || null,
        client_email: normalizeEmail(client.email),
        client_name: client.name || null,
        title: fields.title,
        description: fields.description,
        skills: fields.skills,
        location: fields.location,
        employment_type: fields.employmentType,
        budget_min: fields.budgetMin,
        budget_max: fields.budgetMax,
        currency: fields.currency,
        headcount: fields.headcount,
        status: fields.status || 'open',
        created_by: actorEmail,
      })
      .select('*')
      .single();
    check(error);
    await audit('job.created', 'job', data.id, { title: data.title }, actorEmail);
    return { ...mapJob(data), candidates: [] };
  },

  async getJob(jobId) {
    const { data, error } = await supabaseAdmin.from('wf_jobs').select('*').eq('id', jobId).maybeSingle();
    check(error);
    assert(data, 'NOT_FOUND', 'Job not found');
    const { data: cands, error: cErr } = await supabaseAdmin
      .from('wf_job_candidates')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    check(cErr);
    return { ...mapJob(data), candidates: (cands || []).map(mapCandidate) };
  },

  async listJobs(filter = {}) {
    let q = supabaseAdmin.from('wf_jobs').select('*').order('created_at', { ascending: false });
    if (filter.clientEmail) q = q.eq('client_email', normalizeEmail(filter.clientEmail));
    if (filter.status) q = q.eq('status', filter.status);
    const { data, error } = await q;
    check(error);
    const jobs = (data || []).map((r) => ({ ...mapJob(r), candidates: [] }));
    const byId = new Map(jobs.map((j) => [j.id, j]));
    for (const ids of chunk(jobs.map((j) => j.id))) {
      const { data: cands, error: cErr } = await supabaseAdmin
        .from('wf_job_candidates')
        .select('*')
        .in('job_id', ids)
        .order('created_at', { ascending: true });
      check(cErr);
      for (const c of cands || []) byId.get(c.job_id)?.candidates.push(mapCandidate(c));
    }
    return jobs;
  },

  async updateJob(jobId, fields, actorEmail = null) {
    const patch = { updated_at: nowIso() };
    const map = {
      title: 'title',
      description: 'description',
      skills: 'skills',
      location: 'location',
      employmentType: 'employment_type',
      budgetMin: 'budget_min',
      budgetMax: 'budget_max',
      currency: 'currency',
      headcount: 'headcount',
      status: 'status',
    };
    for (const [k, col] of Object.entries(map)) if (k in fields) patch[col] = fields[k];
    if (fields.status === 'closed' || fields.status === 'filled') patch.closed_at = nowIso();
    if (fields.status === 'open' || fields.status === 'on_hold') patch.closed_at = null;
    const { error } = await supabaseAdmin.from('wf_jobs').update(patch).eq('id', jobId);
    check(error);
    await audit('job.updated', 'job', jobId, { keys: Object.keys(fields) }, actorEmail);
    return this.getJob(jobId);
  },

  async addJobCandidate(jobId, talent, { source = 'byg', notes = null } = {}, actorEmail = null) {
    const { data, error } = await supabaseAdmin
      .from('wf_job_candidates')
      .insert({
        job_id: jobId,
        talent_profile_id: talent.id != null ? String(talent.id) : null,
        talent_email: normalizeEmail(talent.email),
        talent_name: talent.name || null,
        talent_title: talent.jobTitle || null,
        stage: 'shortlisted',
        source,
        notes,
        added_by: actorEmail,
      })
      .select('*')
      .single();
    if (error?.code === '23505') assert(false, 'ALREADY_IN_PIPELINE', 'This talent is already in the pipeline for this job');
    check(error);
    await audit('job.candidate_added', 'job', jobId, { candidateId: data.id, source }, actorEmail);
    return mapCandidate(data);
  },

  async getJobCandidate(candidateId) {
    const { data, error } = await supabaseAdmin.from('wf_job_candidates').select('*').eq('id', candidateId).maybeSingle();
    check(error);
    assert(data, 'NOT_FOUND', 'Candidate not found');
    return mapCandidate(data);
  },

  async updateJobCandidate(candidateId, { stage, notes } = {}, actorEmail = null) {
    const patch = { updated_at: nowIso() };
    if (stage) patch.stage = stage;
    if (notes !== undefined) patch.notes = notes ? String(notes).slice(0, 2000) : null;
    const { data, error } = await supabaseAdmin
      .from('wf_job_candidates')
      .update(patch)
      .eq('id', candidateId)
      .select('*')
      .single();
    check(error);
    await audit('job.candidate_updated', 'job', data.job_id, { candidateId, stage }, actorEmail);
    return mapCandidate(data);
  },

  /** Hire from a job: candidate moves to `offer` and is linked to the engagement. */
  async linkCandidateEngagement(jobId, talent, engagementId, actorEmail = null) {
    const email = normalizeEmail(talent.email);
    const { data: existing } = await supabaseAdmin
      .from('wf_job_candidates')
      .select('id')
      .eq('job_id', jobId)
      .eq('talent_email', email)
      .maybeSingle();
    if (!existing) {
      try {
        await this.addJobCandidate(jobId, talent, { source: 'client' }, actorEmail);
      } catch (err) {
        if (err.code !== 'ALREADY_IN_PIPELINE') throw err;
      }
    }
    const { error } = await supabaseAdmin
      .from('wf_job_candidates')
      .update({ stage: 'offer', engagement_id: engagementId, updated_at: nowIso() })
      .eq('job_id', jobId)
      .eq('talent_email', email)
      .neq('stage', 'hired');
    check(error);
  },

  /** Called when all three parties sign: candidate → hired; job → filled at headcount. */
  async markCandidateHired(engagementId) {
    const { data: cands, error } = await supabaseAdmin
      .from('wf_job_candidates')
      .update({ stage: 'hired', updated_at: nowIso() })
      .eq('engagement_id', engagementId)
      .select('job_id');
    check(error);
    for (const jobId of new Set((cands || []).map((c) => c.job_id))) {
      const job = await this.getJob(jobId);
      const hired = job.candidates.filter((c) => c.stage === 'hired').length;
      if (hired >= job.headcount && job.status === 'open') {
        await this.updateJob(jobId, { status: 'filled' }, 'system');
      }
    }
  },

  async snapshot() {
    const [engagements, contracts, invoices, payouts, paymentAccounts] = await Promise.all([
      this.listEngagements(),
      this.listContracts(),
      this.listInvoices(),
      this.listPayouts(),
      this.listPaymentAccounts(),
    ]);
    const sigs = await this.listSignaturesFor(contracts.map((c) => c.id));
    return {
      engagements,
      contracts: contracts.map((c) => ({ ...c, signatures: sigs.get(c.id) || [] })),
      invoices,
      payouts,
      paymentAccounts,
      ledger: {
        cash: await ledgerBalance('cash'),
        talentPayable: await ledgerBalance('talent_payable'),
        feeRevenue: await ledgerBalance('byg_fee_revenue'),
        clientPrepaid: await ledgerBalance('client_prepaid'),
      },
      store: 'supabase',
    };
  },
};

module.exports = supabaseStore;

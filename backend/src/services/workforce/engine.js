/**
 * BYG Workforce HRIS — pure in-memory engine.
 * Used by tests and WORKFORCE_STORE=memory. Production uses ./db.js (Supabase),
 * whose money paths run in the SQL functions from workforce_v3_production.sql —
 * keep the two in step.
 */

const crypto = require('crypto');
const {
  BYG_CONTRACT_NAME,
  BYG_CONTRACT_HTML,
  BYG_CONTRACT_REQUIRED_FIELDS,
  renderContractHtml,
  normalizeSignatureData,
  buildFilledFields,
  stampSignaturesOnHtml,
  isFullySigned,
} = require('./bygContractTemplate');
const { deterministicReview } = require('./aiContractReview');
const { CADENCES, isIsoDate, todayIso, addDays, periodBounds, duePeriodIndexes } = require('./periods');

const ENGAGEMENT_STATUSES = ['offered', 'contracted', 'active', 'paused', 'ended'];
const OPEN_ENGAGEMENT = ['offered', 'contracted', 'active', 'paused'];

function uid() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function assert(condition, code, message) {
  if (!condition) {
    const err = new Error(message);
    err.code = code;
    throw err;
  }
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function hashDoc(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function newInvoiceNumber() {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  return `WF-${ym}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Client/talent may only sign for themselves; BYG signs from admin routes. */
function assertSignerAllowed(eng, role, signerEmail) {
  assert(['client', 'talent', 'byg'].includes(role), 'INVALID_ROLE', 'Invalid signer role');
  if (role === 'byg') return;
  const email = normalizeEmail(signerEmail);
  const expected = normalizeEmail(role === 'client' ? eng.clientEmail : eng.talentEmail);
  assert(expected && email === expected, 'FORBIDDEN', `Only the ${role} on this engagement can sign as ${role}`);
}

/** Shared input validation for engagement creation (both stores). */
function validateEngagementInput(input) {
  const talentEmail = normalizeEmail(input.talentEmail);
  assert(talentEmail.includes('@'), 'INVALID_EMAIL', 'Valid talent email required');
  const clientName = String(input.clientName || '').trim();
  assert(clientName, 'CLIENT_REQUIRED', 'Client name required');
  const amount = Number(input.salaryAmount);
  assert(Number.isFinite(amount) && amount > 0 && amount <= 1_000_000, 'INVALID_SALARY', 'Salary must be greater than 0');
  const cadence = input.cadence || 'monthly';
  assert(CADENCES.includes(cadence), 'INVALID_CADENCE', 'Invalid salary cadence');
  const envFee = Number(process.env.WORKFORCE_DEFAULT_FEE_PERCENT);
  const fallbackFee = Number.isFinite(envFee) && envFee >= 0 && envFee <= 100 ? envFee : 0;
  const fee = input.bygFeePercent == null || input.bygFeePercent === '' ? fallbackFee : Number(input.bygFeePercent);
  assert(Number.isFinite(fee) && fee >= 0 && fee <= 100, 'INVALID_FEE', 'BYG fee percent must be 0–100');
  const startDate = input.startDate || todayIso();
  assert(isIsoDate(startDate), 'INVALID_DATE', 'Start date must be YYYY-MM-DD');
  const roleTitle = String(input.roleTitle || 'Remote contractor').trim().slice(0, 140) || 'Remote contractor';
  return {
    talentEmail,
    clientName: clientName.slice(0, 200),
    clientEmail: normalizeEmail(input.clientEmail) || null,
    amount: roundMoney(amount),
    currency: String(input.currency || 'USD').toUpperCase(),
    cadence,
    fee,
    startDate,
    roleTitle,
  };
}

/** Invoice amounts + lines for one billing period. */
function buildPeriodInvoice(eng, salary, index) {
  const bounds = periodBounds(eng.startDate, salary.cadence, index);
  const fee = roundMoney((salary.amount * salary.bygFeePercent) / 100);
  const today = todayIso();
  const minDue = addDays(today, 7);
  return {
    bounds,
    subtotal: salary.amount,
    feeAmount: fee,
    total: roundMoney(salary.amount + fee),
    currency: salary.currency,
    dueDate: bounds.start > minDue ? bounds.start : minDue,
    lines: [
      {
        description: `Contractor pay — ${eng.talentName || eng.talentEmail} (${bounds.start} → ${bounds.end})`,
        amount: salary.amount,
      },
      { description: `BYG Hires platform fee (${salary.bygFeePercent}%)`, amount: fee },
    ],
  };
}

function createMemoryStore() {
  return {
    engagements: [],
    salarySchedules: [],
    templates: [
      {
        id: uid(),
        name: BYG_CONTRACT_NAME,
        version: 2,
        bodyHtml: BYG_CONTRACT_HTML,
        requiredFields: BYG_CONTRACT_REQUIRED_FIELDS,
        active: true,
      },
    ],
    contracts: [],
    signatures: [],
    invoices: [],
    invoiceLines: [],
    ledgerAccounts: [
      { id: uid(), code: 'cash', name: 'Platform cash', kind: 'asset' },
      { id: uid(), code: 'talent_payable', name: 'Talent payable', kind: 'liability' },
      { id: uid(), code: 'byg_fee_revenue', name: 'BYG fee revenue', kind: 'revenue' },
      { id: uid(), code: 'client_prepaid', name: 'Client prepaid wallet', kind: 'liability' },
    ],
    ledgerEntries: [],
    paymentAccounts: [],
    payouts: [],
    audit: [],
    wallets: [],
    tapCharges: [],
    walletTxns: [],
    // Test fixtures for directory / client lookups
    talentProfiles: [],
    clients: [],
  };
}

function createWorkforceEngine(seedStore) {
  const db = seedStore || createMemoryStore();

  function audit(action, entityType, entityId, meta = {}, actorEmail = null) {
    db.audit.push({ id: uid(), actorEmail, action, entityType, entityId, meta, createdAt: nowIso() });
  }

  function getAccount(code) {
    const a = db.ledgerAccounts.find((x) => x.code === code);
    assert(a, 'LEDGER_ACCOUNT_MISSING', `Ledger account ${code} missing`);
    return a;
  }

  /** Same contract as wf_post_ledger: zero lines are skipped. */
  function postLedger(code, debit, credit, currency, refType, refId, memo) {
    if (!debit && !credit) return;
    db.ledgerEntries.push({
      id: uid(),
      accountId: getAccount(code).id,
      accountCode: code,
      debit: roundMoney(debit || 0),
      credit: roundMoney(credit || 0),
      currency,
      refType,
      refId,
      memo,
      createdAt: nowIso(),
    });
  }

  function getOpenSalary(engagementId) {
    return db.salarySchedules.find((s) => s.engagementId === engagementId && !s.effectiveTo) || null;
  }

  function engRow(id) {
    const eng = db.engagements.find((e) => e.id === id);
    assert(eng, 'NOT_FOUND', 'Engagement not found');
    return eng;
  }

  function getEngagement(id) {
    const eng = engRow(id);
    return { ...eng, salary: getOpenSalary(eng.id) };
  }

  function createEngagement(input, actorEmail = null) {
    const v = validateEngagementInput(input);

    const existing = db.engagements.find(
      (e) =>
        normalizeEmail(e.talentEmail) === v.talentEmail &&
        OPEN_ENGAGEMENT.includes(e.status) &&
        (v.clientEmail
          ? normalizeEmail(e.clientEmail) === v.clientEmail
          : String(e.clientName).trim().toLowerCase() === v.clientName.toLowerCase())
    );
    if (existing) {
      return { engagement: getEngagement(existing.id), salary: getOpenSalary(existing.id), created: false };
    }

    const engagement = {
      id: uid(),
      clientId: input.clientId || null,
      clientName: v.clientName,
      clientEmail: v.clientEmail,
      talentUserId: input.talentUserId || null,
      talentEmail: v.talentEmail,
      talentName: input.talentName || null,
      roleTitle: v.roleTitle,
      status: 'offered',
      startDate: v.startDate,
      endDate: null,
      endedReason: null,
      jobId: input.jobId || null,
      introBookingId: input.introBookingId || null,
      ambassadorPlacementId: input.ambassadorPlacementId || null,
      externalIds: input.externalIds || {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.engagements.push(engagement);
    db.salarySchedules.push({
      id: uid(),
      engagementId: engagement.id,
      amount: v.amount,
      currency: v.currency,
      cadence: v.cadence,
      bygFeePercent: v.fee,
      effectiveFrom: v.startDate,
      effectiveTo: null,
      createdAt: nowIso(),
    });
    audit('engagement.created', 'engagement', engagement.id, { talentEmail: v.talentEmail, amount: v.amount }, actorEmail);

    let contract = null;
    try {
      contract = createContractFromTemplate(engagement.id, actorEmail);
      contract = reviewContract(contract.id, actorEmail);
    } catch (_e) {
      /* keep draft if review fails */
    }
    return { engagement: getEngagement(engagement.id), salary: getOpenSalary(engagement.id), contract, created: true };
  }

  function listEngagements(filter = {}) {
    let rows = [...db.engagements];
    if (filter.talentEmail) rows = rows.filter((x) => normalizeEmail(x.talentEmail) === normalizeEmail(filter.talentEmail));
    if (filter.clientEmail) rows = rows.filter((x) => normalizeEmail(x.clientEmail) === normalizeEmail(filter.clientEmail));
    if (filter.status) rows = rows.filter((x) => x.status === filter.status);
    return rows
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((eng) => ({ ...eng, salary: getOpenSalary(eng.id) }));
  }

  /** Memory store: open hires keyed by talentUserId (tests have no profiles table). */
  function listHiredDirectoryProfileIds() {
    return [
      ...new Set(
        listEngagements()
          .filter((e) => OPEN_ENGAGEMENT.includes(e.status))
          .map((e) => e.talentUserId)
          .filter(Boolean)
      ),
    ];
  }

  function updateEngagementStatus(id, status, { reason = null, endDate = null } = {}, actorEmail = null) {
    assert(ENGAGEMENT_STATUSES.includes(status), 'INVALID_STATUS', 'Invalid engagement status');
    const eng = engRow(id);
    assert(eng.status !== 'ended', 'ENGAGEMENT_ENDED', 'Engagement has already ended');
    const prev = eng.status;
    if (status === 'active') {
      const signed = db.contracts.find((c) => c.engagementId === id && c.status === 'signed');
      assert(signed, 'CONTRACT_REQUIRED', 'Cannot activate engagement without a signed contract');
    }
    if (status === 'ended') {
      const end = endDate || todayIso();
      assert(isIsoDate(end), 'INVALID_DATE', 'End date must be YYYY-MM-DD');
      eng.endDate = end;
      eng.endedReason = reason ? String(reason).slice(0, 500) : null;
    }
    eng.status = status;
    eng.updatedAt = nowIso();
    audit('engagement.status', 'engagement', id, { prev, status, reason }, actorEmail);
    return getEngagement(id);
  }

  function createContractFromTemplate(engagementId, actorEmail = null) {
    const engView = getEngagement(engagementId);
    const template = db.templates.find((t) => t.active) || db.templates[0];
    assert(template, 'NO_TEMPLATE', 'No active contract template');
    assert(engView.salary, 'NO_SALARY', 'Engagement has no salary schedule');

    const existing = db.contracts.find((c) => c.engagementId === engagementId && !['void', 'signed'].includes(c.status));
    if (existing) return existing;

    const filled = buildFilledFields(engView, engView.salary);
    const contract = {
      id: uid(),
      engagementId,
      templateId: template.id,
      filledFields: filled,
      renderedHtml: renderContractHtml(template.bodyHtml || BYG_CONTRACT_HTML, filled),
      status: 'draft',
      aiReviewStatus: null,
      aiFindings: [],
      aiRaw: null,
      docHash: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.contracts.push(contract);
    const row = engRow(engagementId);
    if (row.status === 'offered') {
      row.status = 'contracted';
      row.updatedAt = nowIso();
    }
    audit('contract.created', 'contract', contract.id, {}, actorEmail);
    return contract;
  }

  function getContract(id) {
    const c = db.contracts.find((x) => x.id === id);
    assert(c, 'NOT_FOUND', 'Contract not found');
    return c;
  }

  function listContracts(filter = {}) {
    let rows = [...db.contracts];
    if (filter.engagementId) rows = rows.filter((c) => c.engagementId === filter.engagementId);
    if (filter.engagementIds) rows = rows.filter((c) => filter.engagementIds.includes(c.engagementId));
    return rows;
  }

  function fillContract(contractId, fields, actorEmail = null) {
    const contract = getContract(contractId);
    assert(
      ['draft', 'needs_fixes', 'pending_ai', 'ready_to_sign'].includes(contract.status),
      'CONTRACT_LOCKED',
      'Contract cannot be edited in current status'
    );
    contract.filledFields = { ...contract.filledFields, ...fields };
    const template = db.templates.find((t) => t.id === contract.templateId);
    contract.renderedHtml = renderContractHtml(template?.bodyHtml || BYG_CONTRACT_HTML, contract.filledFields);
    contract.status = 'draft';
    contract.aiReviewStatus = null;
    contract.aiFindings = [];
    contract.updatedAt = nowIso();
    audit('contract.filled', 'contract', contractId, { keys: Object.keys(fields || {}) }, actorEmail);
    return contract;
  }

  function reviewContract(contractId, actorEmail = null) {
    const contract = getContract(contractId);
    const eng = getEngagement(contract.engagementId);
    const template = db.templates.find((t) => t.id === contract.templateId);
    const result = deterministicReview({
      filledFields: contract.filledFields,
      salary: eng.salary,
      requiredFields: template?.requiredFields || BYG_CONTRACT_REQUIRED_FIELDS,
    });
    contract.aiReviewStatus = result.status;
    contract.aiFindings = result.findings;
    contract.aiRaw = JSON.stringify({ reviewedAt: nowIso(), source: result.source, findings: result.findings });
    contract.renderedHtml = renderContractHtml(template?.bodyHtml || BYG_CONTRACT_HTML, contract.filledFields);
    contract.status =
      result.status === 'pass' ? 'ready_to_sign' : result.status === 'escalate' ? 'pending_ai' : 'needs_fixes';
    contract.updatedAt = nowIso();
    audit('contract.ai_review', 'contract', contractId, { status: result.status, count: result.findings.length }, actorEmail);
    return contract;
  }

  /** Mirrors db.changeStartDate: allowed until fully signed; clears signatures given so far. */
  function changeStartDate(contractId, startDate, actorEmail = null) {
    return updateContractTerms(contractId, { startDate }, actorEmail);
  }

  /**
   * Update start date and/or pay terms before the contract is fully signed.
   * Regenerates the document and clears any signatures already collected.
   */
  function updateContractTerms(contractId, patch = {}, actorEmail = null) {
    const contract = getContract(contractId);
    assert(!['signed', 'void'].includes(contract.status), 'CONTRACT_LOCKED', 'A fully signed contract cannot be changed');

    const eng = engRow(contract.engagementId);
    const salary = getOpenSalary(contract.engagementId);
    assert(salary, 'NO_SALARY', 'No salary schedule');

    const next = {};
    if (patch.startDate != null && patch.startDate !== '') {
      assert(isIsoDate(patch.startDate), 'INVALID_DATE', 'Start date must be YYYY-MM-DD');
      next.startDate = patch.startDate;
    }
    if (patch.salaryAmount != null && patch.salaryAmount !== '') {
      const amount = Number(patch.salaryAmount);
      assert(Number.isFinite(amount) && amount > 0 && amount <= 1_000_000, 'INVALID_SALARY', 'Salary must be greater than 0');
      next.salaryAmount = roundMoney(amount);
    }
    if (patch.bygFeePercent != null && patch.bygFeePercent !== '') {
      const fee = Number(patch.bygFeePercent);
      assert(Number.isFinite(fee) && fee >= 0 && fee <= 100, 'INVALID_FEE', 'BYG fee percent must be 0–100');
      next.bygFeePercent = fee;
    }
    if (patch.currency != null && patch.currency !== '') {
      next.currency = String(patch.currency).toUpperCase();
    }
    if (patch.cadence != null && patch.cadence !== '') {
      assert(CADENCES.includes(patch.cadence), 'INVALID_CADENCE', 'Invalid salary cadence');
      next.cadence = patch.cadence;
    }
    assert(Object.keys(next).length, 'NO_FIELDS', 'Provide startDate, salaryAmount, bygFeePercent, currency, and/or cadence');

    const clearedRoles = db.signatures.filter((s) => s.contractId === contractId && s.signedAt).map((s) => s.role);
    db.signatures = db.signatures.filter((s) => s.contractId !== contractId);

    if (next.startDate) {
      eng.startDate = next.startDate;
      salary.effectiveFrom = next.startDate;
    }
    if (next.salaryAmount != null) salary.amount = next.salaryAmount;
    if (next.bygFeePercent != null) salary.bygFeePercent = next.bygFeePercent;
    if (next.currency) salary.currency = next.currency;
    if (next.cadence) salary.cadence = next.cadence;

    contract.status = 'draft';
    contract.docHash = null;
    fillContract(
      contractId,
      {
        ...(next.startDate ? { start_date: next.startDate } : {}),
        ...(next.salaryAmount != null ? { salary_amount: String(next.salaryAmount) } : {}),
        ...(next.bygFeePercent != null ? { byg_fee_percent: String(next.bygFeePercent) } : {}),
        ...(next.currency ? { currency: next.currency } : {}),
        ...(next.cadence ? { cadence: next.cadence } : {}),
      },
      actorEmail
    );
    const reviewed = reviewContract(contractId, actorEmail);
    audit('contract.terms_updated', 'contract', contractId, { ...next, clearedRoles }, actorEmail);
    return { contract: reviewed, clearedRoles, terms: next };
  }

  function findSignature(contractId, role) {
    return db.signatures.find((s) => s.contractId === contractId && s.role === role) || null;
  }

  function newSignature(contractId, role, signerEmail) {
    const sig = {
      id: uid(),
      contractId,
      role,
      signerEmail: normalizeEmail(signerEmail),
      otpHash: null,
      otpExpiresAt: null,
      signatureData: null,
      consent: false,
      ip: null,
      signedAt: null,
      docHash: null,
      createdAt: nowIso(),
    };
    db.signatures.push(sig);
    return sig;
  }

  function assertSignable(contract) {
    assert(['ready_to_sign', 'partially_signed'].includes(contract.status), 'NOT_READY', 'Contract is not ready to sign');
    assert(contract.aiReviewStatus === 'pass', 'AI_BLOCK', 'AI review must pass before signing');
  }

  function requestSignatureOtp(contractId, role, signerEmail) {
    assert(['client', 'talent'].includes(role), 'INVALID_ROLE', 'Invalid signer role');
    const contract = getContract(contractId);
    assertSignable(contract);
    assertSignerAllowed(getEngagement(contract.engagementId), role, signerEmail);
    const otp = String(crypto.randomInt(100000, 1000000));
    const sig = findSignature(contractId, role) || newSignature(contractId, role, signerEmail);
    assert(!sig.signedAt, 'ALREADY_SIGNED', `${role} already signed`);
    sig.signerEmail = normalizeEmail(signerEmail);
    sig.otpHash = hashOtp(otp);
    sig.otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    return { signatureId: sig.id, otp, expiresAt: sig.otpExpiresAt };
  }

  function signContract(contractId, role, { otp, signatureData, consent, ip, signerEmail }) {
    const contract = getContract(contractId);
    const eng = getEngagement(contract.engagementId);
    assertSignerAllowed(eng, role, signerEmail);
    assert(consent === true, 'CONSENT_REQUIRED', 'Consent is required to sign');
    const cleanSig = normalizeSignatureData(signatureData);
    assert(cleanSig, 'SIGNATURE_REQUIRED', 'Type your full name or draw a signature');
    assertSignable(contract);

    const sig = findSignature(contractId, role) || newSignature(contractId, role, signerEmail);
    assert(!sig.signedAt, 'ALREADY_SIGNED', `${role} already signed`);
    if (sig.otpHash) {
      assert(sig.otpExpiresAt && new Date(sig.otpExpiresAt) > new Date(), 'OTP_EXPIRED', 'OTP expired');
      assert(sig.otpHash === hashOtp(otp), 'OTP_INVALID', 'Invalid OTP');
    }
    if (!contract.docHash) {
      contract.docHash = hashDoc({
        engagementId: contract.engagementId,
        filledFields: contract.filledFields,
        templateId: contract.templateId,
      });
    }
    Object.assign(sig, {
      signatureData: cleanSig,
      consent: true,
      ip: ip || null,
      signedAt: nowIso(),
      docHash: contract.docHash,
      signerEmail: normalizeEmail(signerEmail) || sig.signerEmail,
    });

    const signedList = db.signatures.filter((s) => s.contractId === contractId && s.signedAt);
    const signedRoles = signedList.map((s) => s.role);
    const complete = isFullySigned(signedRoles);
    contract.renderedHtml = stampSignaturesOnHtml(contract.renderedHtml, signedList);
    contract.status = complete ? 'signed' : 'partially_signed';
    contract.updatedAt = nowIso();

    let invoice = null;
    if (complete) {
      const row = engRow(contract.engagementId);
      if (row.status !== 'ended') {
        row.status = 'active';
        row.updatedAt = nowIso();
      }
      invoice = issueInvoiceForPeriod(contract.engagementId, 0, normalizeEmail(signerEmail)).invoice;
    }
    audit('contract.signed', 'contract', contractId, { role, complete, roles: signedRoles }, normalizeEmail(signerEmail));
    return { ...contract, signatures: signedList, complete, signedRoles, invoice };
  }

  function listSignatures(contractId) {
    return db.signatures.filter((s) => s.contractId === contractId);
  }

  function listSignaturesFor(contractIds) {
    return new Map(contractIds.map((id) => [id, listSignatures(id)]));
  }

  /** Create the invoice for one billing period; returns existing one if already issued. */
  function issueInvoiceForPeriod(engagementId, index, actorEmail = null) {
    const eng = getEngagement(engagementId);
    assert(eng.salary, 'NO_SALARY', 'No salary schedule');
    const existing = db.invoices.find((i) => i.engagementId === engagementId && i.periodIndex === index && i.status !== 'void');
    if (existing) return { invoice: existing, created: false };

    const draft = buildPeriodInvoice(eng, eng.salary, index);
    const invoice = {
      id: uid(),
      engagementId,
      payrollItemId: null,
      invoiceNumber: newInvoiceNumber(),
      status: 'sent',
      currency: draft.currency,
      subtotal: draft.subtotal,
      feeAmount: draft.feeAmount,
      total: draft.total,
      dueDate: draft.dueDate,
      periodIndex: index,
      periodStart: draft.bounds.start,
      periodEnd: draft.bounds.end,
      paidAt: null,
      paymentProvider: null,
      providerRef: null,
      clientName: eng.clientName,
      clientEmail: eng.clientEmail,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.invoices.push(invoice);
    draft.lines.forEach((l, i) => db.invoiceLines.push({ id: uid(), invoiceId: invoice.id, ...l, sortOrder: i + 1 }));
    audit('invoice.issued', 'invoice', invoice.id, { engagementId, periodIndex: index }, actorEmail);
    return { invoice, created: true };
  }

  /** Recurring billing: invoice every active engagement up to asOf + leadDays. */
  function issueDueInvoices({ asOf = todayIso(), leadDays = 7 } = {}, actorEmail = null) {
    const issued = [];
    for (const eng of listEngagements({ status: 'active' })) {
      if (!eng.salary) continue;
      const indexes = db.invoices
        .filter((i) => i.engagementId === eng.id && i.status !== 'void' && i.periodIndex != null)
        .map((i) => i.periodIndex);
      const nextIndex = indexes.length ? Math.max(...indexes) + 1 : 0;
      for (const index of duePeriodIndexes({
        anchor: eng.startDate,
        cadence: eng.salary.cadence,
        nextIndex,
        asOf,
        leadDays,
        endDate: eng.endDate,
      })) {
        const { invoice, created } = issueInvoiceForPeriod(eng.id, index, actorEmail);
        if (created) issued.push(invoice);
      }
    }
    return { asOf, issued };
  }

  function listInvoices(filter = {}) {
    let rows = [...db.invoices];
    if (filter.status) rows = rows.filter((i) => i.status === filter.status);
    if (filter.clientEmail) rows = rows.filter((i) => normalizeEmail(i.clientEmail) === normalizeEmail(filter.clientEmail));
    if (filter.engagementId) rows = rows.filter((i) => i.engagementId === filter.engagementId);
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  function getInvoice(invoiceId) {
    const invoice = db.invoices.find((i) => i.id === invoiceId);
    assert(invoice, 'NOT_FOUND', 'Invoice not found');
    return invoice;
  }

  function getInvoiceDocument(invoiceId, { actorEmail = null, asAdmin = false } = {}) {
    const { renderInvoiceHtml, wrapInvoicePrintDocument } = require('./bygInvoiceTemplate');
    const invoice = getInvoice(invoiceId);
    if (!asAdmin) {
      assert(actorEmail, 'FORBIDDEN', 'Sign in required');
      assert(
        normalizeEmail(invoice.clientEmail) === normalizeEmail(actorEmail),
        'FORBIDDEN',
        'Invoices are only visible to the billing client and BYG admin'
      );
    }
    const lines = db.invoiceLines
      .filter((l) => l.invoiceId === invoiceId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({ description: l.description, amount: l.amount }));
    let eng = null;
    try {
      eng = getEngagement(invoice.engagementId);
    } catch (_e) {
      /* optional */
    }
    const renderedHtml = renderInvoiceHtml(invoice, eng, lines);
    return {
      invoice,
      lines,
      renderedHtml,
      printHtml: wrapInvoicePrintDocument(renderedHtml, `Invoice ${invoice.invoiceNumber}`),
      viewerOnly: 'client_and_admin',
    };
  }

  function voidInvoice(invoiceId, actorEmail = null) {
    const invoice = getInvoice(invoiceId);
    assert(invoice.status !== 'paid', 'ALREADY_PAID', 'Paid invoices cannot be voided');
    assert(invoice.status !== 'void', 'VOID', 'Invoice is already void');
    invoice.status = 'void';
    invoice.updatedAt = nowIso();
    audit('invoice.void', 'invoice', invoiceId, {}, actorEmail);
    return invoice;
  }

  function findWallet(email, currency) {
    return db.wallets.find((w) => w.ownerEmail === normalizeEmail(email) && w.currency === String(currency).toUpperCase());
  }

  function getOrCreateWallet(ownerEmail, currency = 'USD') {
    let w = findWallet(ownerEmail, currency);
    if (!w) {
      w = {
        id: uid(),
        ownerEmail: normalizeEmail(ownerEmail),
        currency: String(currency || 'USD').toUpperCase(),
        balance: 0,
        autoPay: false,
        updatedAt: nowIso(),
      };
      db.wallets.push(w);
    }
    return w;
  }

  function listWallets(ownerEmail) {
    return db.wallets.filter((w) => w.ownerEmail === normalizeEmail(ownerEmail));
  }

  function listWalletTxns(ownerEmail, limit = 50) {
    const ids = new Set(listWallets(ownerEmail).map((w) => w.id));
    return db.walletTxns
      .filter((t) => ids.has(t.walletId))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }

  function setWalletAutoPay(ownerEmail, currency, autoPay) {
    const w = getOrCreateWallet(ownerEmail, currency);
    w.autoPay = Boolean(autoPay);
    w.updatedAt = nowIso();
    return w;
  }

  /** Mirrors wf_wallet_credit. */
  function walletCredit({ ownerEmail, currency, amount, memo = null, tapChargeId = null }, actorEmail = null) {
    const email = normalizeEmail(ownerEmail);
    assert(email.includes('@'), 'INVALID_EMAIL', 'Valid wallet owner email required');
    const amt = roundMoney(amount);
    assert(amt > 0, 'INVALID_AMOUNT', 'Credit amount must be positive');
    const wallet = getOrCreateWallet(email, currency);
    wallet.balance = roundMoney(wallet.balance + amt);
    wallet.updatedAt = nowIso();
    const txn = {
      id: uid(),
      walletId: wallet.id,
      kind: 'topup',
      amount: amt,
      currency: wallet.currency,
      tapChargeId,
      invoiceId: null,
      memo: memo || 'Wallet top-up',
      createdAt: nowIso(),
    };
    db.walletTxns.push(txn);
    postLedger('cash', amt, 0, wallet.currency, 'wallet_topup', txn.id, txn.memo);
    postLedger('client_prepaid', 0, amt, wallet.currency, 'wallet_topup', txn.id, txn.memo);
    audit('wallet.credited', 'wallet', wallet.id, { amount: amt, tapChargeId, memo }, actorEmail);
    return { wallet, txnId: txn.id };
  }

  /** Mirrors wf_pay_invoice. method: manual | tap | wallet. */
  function payInvoice(invoiceId, { method, providerRef = null, payerEmail = null } = {}, actorEmail = null) {
    assert(['manual', 'tap', 'wallet'].includes(method), 'INVALID_METHOD', 'Invalid payment method');
    const invoice = getInvoice(invoiceId);
    assert(invoice.status !== 'void', 'VOID', 'Cannot pay a void invoice');
    if (invoice.status === 'paid') {
      if (providerRef && invoice.providerRef === providerRef) return { invoice, duplicate: true };
      assert(false, 'ALREADY_PAID', 'Invoice already paid');
    }
    assert(invoice.total > 0, 'ZERO_INVOICE', 'Cannot pay zero-total invoice');
    assert(roundMoney(invoice.subtotal + invoice.feeAmount) === roundMoney(invoice.total), 'LEDGER_UNBALANCED', 'Invoice totals do not balance');
    if (payerEmail) {
      assert(normalizeEmail(invoice.clientEmail) === normalizeEmail(payerEmail), 'FORBIDDEN', 'Not your invoice');
    }

    let ref = providerRef;
    let walletTxnId = null;
    if (method === 'wallet') {
      const wallet = findWallet(invoice.clientEmail, invoice.currency);
      assert(wallet && wallet.balance >= invoice.total, 'INSUFFICIENT_WALLET', 'Wallet balance too low — top up first');
      wallet.balance = roundMoney(wallet.balance - invoice.total);
      wallet.updatedAt = nowIso();
      walletTxnId = uid();
      db.walletTxns.push({
        id: walletTxnId,
        walletId: wallet.id,
        kind: 'spend',
        amount: invoice.total,
        currency: invoice.currency,
        tapChargeId: null,
        invoiceId: invoice.id,
        memo: `Pay ${invoice.invoiceNumber}`,
        createdAt: nowIso(),
      });
      ref = ref || `wallet_${walletTxnId}`;
    }

    Object.assign(invoice, {
      status: 'paid',
      paidAt: nowIso(),
      updatedAt: nowIso(),
      paymentProvider: method,
      providerRef: ref || `manual_${invoice.id.slice(0, 8)}`,
    });
    const memo = `Paid ${invoice.invoiceNumber}`;
    postLedger(method === 'wallet' ? 'client_prepaid' : 'cash', invoice.total, 0, invoice.currency, 'invoice', invoice.id, memo);
    postLedger('talent_payable', 0, invoice.subtotal, invoice.currency, 'invoice', invoice.id, memo);
    postLedger('byg_fee_revenue', 0, invoice.feeAmount, invoice.currency, 'invoice', invoice.id, memo);

    let payoutId = null;
    if (invoice.subtotal > 0 && !db.payouts.some((p) => p.invoiceId === invoice.id && p.status !== 'cancelled')) {
      const eng = getEngagement(invoice.engagementId);
      const account = db.paymentAccounts.find(
        (a) => a.ownerType === 'talent' && a.ownerEmail === normalizeEmail(eng.talentEmail) && a.status === 'verified'
      );
      payoutId = uid();
      db.payouts.push({
        id: payoutId,
        engagementId: eng.id,
        invoiceId: invoice.id,
        paymentAccountId: account?.id || null,
        amount: invoice.subtotal,
        currency: invoice.currency,
        status: 'pending',
        providerRef: null,
        notes: null,
        createdAt: nowIso(),
        sentAt: null,
      });
    }
    audit('invoice.paid', 'invoice', invoice.id, { total: invoice.total, method }, actorEmail);
    return { invoice, payoutId, walletTxnId, duplicate: false };
  }

  function recordTapCharge({ id, purpose, ownerEmail, invoiceId, amount, currency, redirectUrl, meta }) {
    const row = {
      id,
      purpose,
      ownerEmail: normalizeEmail(ownerEmail),
      invoiceId: invoiceId || null,
      amount: roundMoney(amount),
      currency: String(currency).toUpperCase(),
      status: 'initiated',
      redirectUrl: redirectUrl || null,
      meta: meta || {},
      createdAt: nowIso(),
      capturedAt: null,
    };
    const idx = db.tapCharges.findIndex((c) => c.id === id);
    if (idx >= 0) db.tapCharges[idx] = row;
    else db.tapCharges.push(row);
    return row;
  }

  function markTapCharge(chargeId, status) {
    const charge = db.tapCharges.find((c) => c.id === chargeId);
    if (charge && charge.status === 'initiated') charge.status = status;
    return charge || null;
  }

  /** Mirrors wf_fulfill_tap_charge. */
  function fulfillTapCharge(chargeId, amount, currency, actorEmail = null) {
    const charge = db.tapCharges.find((c) => c.id === chargeId);
    assert(charge, 'UNKNOWN_CHARGE', 'Unknown Tap charge');
    if (charge.status === 'captured') return { duplicate: true, purpose: charge.purpose, invoiceId: charge.invoiceId };
    assert(
      roundMoney(amount) === charge.amount && String(currency).toUpperCase() === charge.currency,
      'AMOUNT_MISMATCH',
      'Tap charge amount mismatch'
    );
    let result;
    if (charge.purpose === 'invoice_pay') {
      const inv = db.invoices.find((i) => i.id === charge.invoiceId);
      if (!inv || inv.status === 'paid' || inv.status === 'void') {
        result = {
          ...walletCredit(
            {
              ownerEmail: charge.ownerEmail,
              currency: charge.currency,
              amount: charge.amount,
              memo: `Card payment ${charge.id} credited to wallet (invoice already settled)`,
              tapChargeId: charge.id,
            },
            actorEmail
          ),
          creditedToWallet: true,
        };
      } else {
        result = payInvoice(charge.invoiceId, { method: 'tap', providerRef: charge.id }, actorEmail);
      }
    } else if (charge.purpose === 'wallet_topup') {
      result = walletCredit(
        {
          ownerEmail: charge.ownerEmail,
          currency: charge.currency,
          amount: charge.amount,
          memo: `Tap top-up ${charge.id}`,
          tapChargeId: charge.id,
        },
        actorEmail
      );
    } else {
      assert(false, 'INVALID_CHARGE', `Unknown Tap purpose ${charge.purpose}`);
    }
    charge.status = 'captured';
    charge.capturedAt = nowIso();
    return { ...result, purpose: charge.purpose, invoiceId: charge.invoiceId, duplicate: false };
  }

  function getTapCharge(chargeId) {
    return db.tapCharges.find((c) => c.id === chargeId) || null;
  }

  function listPayouts(filter = {}) {
    let rows = [...db.payouts];
    if (filter.status) rows = rows.filter((p) => p.status === filter.status);
    if (filter.talentEmail) {
      const ids = new Set(listEngagements({ talentEmail: filter.talentEmail }).map((e) => e.id));
      rows = rows.filter((p) => ids.has(p.engagementId));
    }
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  /** Mirrors wf_release_payout. */
  function releasePayout(payoutId, { reference = null, notes = null } = {}, actorEmail = null) {
    const payout = db.payouts.find((p) => p.id === payoutId);
    assert(payout, 'NOT_FOUND', 'Payout not found');
    assert(payout.status === 'pending', 'NOT_PENDING', 'Payout is not pending');
    Object.assign(payout, {
      status: 'sent',
      sentAt: nowIso(),
      providerRef: String(reference || '').trim() || `manual_${payout.id.slice(0, 8)}`,
      notes: String(notes || '').trim() || null,
      releasedBy: actorEmail,
    });
    postLedger('talent_payable', payout.amount, 0, payout.currency, 'payout', payout.id, 'Talent payout released');
    postLedger('cash', 0, payout.amount, payout.currency, 'payout', payout.id, 'Talent payout released');
    audit('payout.sent', 'payout', payoutId, { reference: payout.providerRef }, actorEmail);
    return payout;
  }

  function getPayoutAccount(ownerEmail) {
    return db.paymentAccounts.find((a) => a.ownerType === 'talent' && a.ownerEmail === normalizeEmail(ownerEmail)) || null;
  }

  /** Talent saves payout details → pending until an admin verifies them. */
  function savePayoutAccount(ownerEmail, { details, maskedLabel }) {
    const email = normalizeEmail(ownerEmail);
    assert(email.includes('@'), 'INVALID_EMAIL', 'Valid email required');
    let row = getPayoutAccount(email);
    if (!row) {
      row = { id: uid(), ownerType: 'talent', ownerEmail: email, provider: 'manual', createdAt: nowIso() };
      db.paymentAccounts.push(row);
    }
    Object.assign(row, { details, maskedLabel, status: 'pending', verifiedAt: null, updatedAt: nowIso() });
    return row;
  }

  function verifyPaymentAccount(accountId, actorEmail = null) {
    const row = db.paymentAccounts.find((a) => a.id === accountId);
    assert(row, 'NOT_FOUND', 'Payment account not found');
    Object.assign(row, { status: 'verified', verifiedAt: nowIso(), verifiedBy: actorEmail, updatedAt: nowIso() });
    const engIds = new Set(listEngagements({ talentEmail: row.ownerEmail }).map((e) => e.id));
    db.payouts
      .filter((p) => p.status === 'pending' && engIds.has(p.engagementId))
      .forEach((p) => {
        p.paymentAccountId = row.id;
      });
    return row;
  }

  function listPaymentAccounts(filter = {}) {
    let rows = [...db.paymentAccounts];
    if (filter.status) rows = rows.filter((a) => a.status === filter.status);
    return rows;
  }

  function getTalentProfile(profileId) {
    const p = db.talentProfiles.find((t) => String(t.id) === String(profileId));
    assert(p, 'TALENT_NOT_FOUND', 'Talent not found in the directory');
    return p;
  }

  function getClientForUser(user) {
    const email = normalizeEmail(user?.email);
    return db.clients.find((c) => (user?.id && c.userId === user.id) || c.email === email) || null;
  }

  function listTalentOptions() {
    return [...db.talentProfiles];
  }

  function listClientOptions() {
    return db.clients.map((c) => ({ id: c.id, email: c.email, name: c.name, userId: c.userId }));
  }

  function ledgerBalance(code) {
    const account = getAccount(code);
    const rows = db.ledgerEntries.filter((e) => e.accountId === account.id);
    const debit = rows.reduce((s, r) => s + r.debit, 0);
    const credit = rows.reduce((s, r) => s + r.credit, 0);
    if (account.kind === 'asset' || account.kind === 'expense') return roundMoney(debit - credit);
    return roundMoney(credit - debit);
  }

  function snapshot() {
    return {
      engagements: listEngagements(),
      contracts: db.contracts.map((c) => ({ ...c, signatures: listSignatures(c.id) })),
      invoices: listInvoices(),
      payouts: listPayouts(),
      paymentAccounts: listPaymentAccounts(),
      ledger: {
        cash: ledgerBalance('cash'),
        talentPayable: ledgerBalance('talent_payable'),
        feeRevenue: ledgerBalance('byg_fee_revenue'),
        clientPrepaid: ledgerBalance('client_prepaid'),
      },
      audit: [...db.audit],
    };
  }

  let platformFee = (() => {
    const n = Number(process.env.WORKFORCE_DEFAULT_FEE_PERCENT);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 0;
  })();

  function getPlatformSettings() {
    return { defaultFeePercent: platformFee };
  }

  function setPlatformSettings({ defaultFeePercent }, actorEmail = null) {
    const fee = Number(defaultFeePercent);
    assert(Number.isFinite(fee) && fee >= 0 && fee <= 100, 'INVALID_FEE', 'BYG fee percent must be 0–100');
    platformFee = fee;
    audit('settings.platform_updated', 'settings', null, { key: 'platform', defaultFeePercent: fee }, actorEmail);
    return { defaultFeePercent: fee };
  }

  return {
    db,
    createEngagement,
    listEngagements,
    listHiredDirectoryProfileIds,
    getEngagement,
    updateEngagementStatus,
    createContractFromTemplate,
    getContract,
    listContracts,
    fillContract,
    reviewContract,
    changeStartDate,
    updateContractTerms,
    requestSignatureOtp,
    signContract,
    listSignatures,
    listSignaturesFor,
    issueInvoiceForPeriod,
    issueDueInvoices,
    listInvoices,
    getInvoice,
    getInvoiceDocument,
    voidInvoice,
    payInvoice,
    listWallets,
    listWalletTxns,
    getOrCreateWallet,
    setWalletAutoPay,
    walletCredit,
    recordTapCharge,
    markTapCharge,
    getTapCharge,
    fulfillTapCharge,
    listPayouts,
    releasePayout,
    getPayoutAccount,
    savePayoutAccount,
    verifyPaymentAccount,
    listPaymentAccounts,
    getTalentProfile,
    getClientForUser,
    listTalentOptions,
    listClientOptions,
    ledgerBalance,
    getPlatformSettings,
    setPlatformSettings,
    snapshot,
  };
}

module.exports = {
  createWorkforceEngine,
  createMemoryStore,
  normalizeEmail,
  roundMoney,
  assertSignerAllowed,
  validateEngagementInput,
  buildPeriodInvoice,
  newInvoiceNumber,
  OPEN_ENGAGEMENT,
  ENGAGEMENT_STATUSES,
};

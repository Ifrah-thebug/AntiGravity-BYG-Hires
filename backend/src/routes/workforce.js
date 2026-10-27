const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAdmin } = require('../middleware/requireAdmin');
const { requireUser } = require('../middleware/requireUser');
const workforce = require('../services/workforceService');
const notify = require('../services/workforce/notify');
const { normalizeJobInput, assertStageChange, SUPPORTED_CURRENCIES } = require('../services/workforce/jobRules');
const { isIsoDate, addDays, todayIso } = require('../services/workforce/periods');

const router = express.Router();

const STATUS_BY_CODE = {
  NOT_FOUND: 404,
  TALENT_NOT_FOUND: 404,
  UNKNOWN_CHARGE: 404,
  WORKFORCE_DISABLED: 503,
  SCHEMA_MISSING: 503,
  DB_MISSING: 503,
  FORBIDDEN: 403,
  CLIENT_ACCOUNT_REQUIRED: 403,
  CLIENT_ACTIVATION_REQUIRED: 403,
  ALREADY_PAID: 409,
  ALREADY_SIGNED: 409,
  ALREADY_IN_PIPELINE: 409,
  CONTRACT_LOCKED: 409,
  STAGE_LOCKED: 409,
  ENGAGEMENT_ENDED: 409,
  NOT_PENDING: 409,
  VOID: 409,
  AMOUNT_MISMATCH: 409,
  INSUFFICIENT_WALLET: 402,
  TAP_NOT_CONFIGURED: 402,
  TAP_API_ERROR: 502,
  NOT_SUPPORTED: 501,
  DB_ERROR: 500,
  ERROR: 500,
};

function handleErr(res, err) {
  const code = err?.code || 'ERROR';
  const status = STATUS_BY_CODE[code] || 400;
  if (status >= 500) console.error('[workforce]', code, err?.message || err);
  const message = status >= 500 && code !== 'SCHEMA_MISSING' && code !== 'WORKFORCE_DISABLED' && code !== 'TAP_API_ERROR'
    ? 'Something went wrong — please try again.'
    : err.message || 'Request failed';
  return res.status(status).json({ error: message, code });
}

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (err) {
    handleErr(res, err);
  }
};

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  throw err;
}

const actor = (req) => String(req.adminUser?.email || req.user?.email || '').trim().toLowerCase() || null;
const userEmail = (req) => String(req.user?.email || '').trim().toLowerCase();

router.use((req, res, next) => {
  if (!workforce.isEnabled()) {
    return res.status(503).json({ error: 'Workforce HRIS is disabled.', code: 'WORKFORCE_DISABLED' });
  }
  return next();
});

/** Per signed-in user (runs after requireUser), so a shared office IP doesn't throttle a whole team. */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.email ? `user:${String(req.user.email).toLowerCase()}` : req.ip),
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests — slow down and try again in a minute.', code: 'RATE_LIMITED' },
});

/** Activated hiring client for this session → req.client. */
const loadClient = wrap(async (req, res, next) => {
  const client = await workforce.getClientForUser(req.user);
  if (!client) fail('CLIENT_ACCOUNT_REQUIRED', 'Only hiring clients can use this. Book a discovery call to get a client account.');
  if (!client.activated) fail('CLIENT_ACTIVATION_REQUIRED', 'Activate your client account from the link in your email first.');
  req.client = client;
  next();
});

const clientOnly = [requireUser, loadClient];

// ─── Public ─────────────────────────────────────────────────────────────────
router.get(
  '/status',
  wrap(async (_req, res) => {
    res.json({ enabled: true, module: 'workforce', ...(await workforce.backendInfo()) });
  })
);

/**
 * Public directory: which approved talents currently have an open hire.
 * Returns profile ids only (no emails, salaries, or client names).
 */
router.get(
  '/directory-hired',
  wrap(async (_req, res) => {
    const profileIds = await workforce.listHiredDirectoryProfileIds();
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ profileIds });
  })
);

/** Tap redirect return — no auth (browser comes back from Tap). Query: tap_id=chg_... */
router.get('/payments/tap/return', async (req, res) => {
  const tap = require('../services/tapPayments');
  const tapCheckout = require('../services/workforceTapCheckout');
  const front = `${tap.frontendBase()}/client/workforce`;
  const chargeId = String(req.query.tap_id || req.query.charge_id || '').trim();
  try {
    if (!chargeId) return res.redirect(`${front}?tap=missing`);
    const result = await tapCheckout.handleTapReturnOrWebhook(chargeId);
    const tab = result.purpose === 'wallet_topup' ? 'wallet' : 'invoices';
    if (result.ok) return res.redirect(`${front}?tap=success&tab=${tab}`);
    const failed = ['FAILED', 'DECLINED', 'CANCELLED', 'ABANDONED', 'VOID', 'RESTRICTED', 'TIMEDOUT'].includes(result.status);
    return res.redirect(`${front}?tap=${failed ? 'failed' : 'pending'}&tab=${tab}`);
  } catch (err) {
    console.warn('[tap] return handler:', err?.code, err?.message || err);
    return res.redirect(`${front}?tap=failed`);
  }
});

/** Tap server-to-server post URL. The body is only used for the charge id. */
router.post('/webhooks/tap', async (req, res) => {
  const tapCheckout = require('../services/workforceTapCheckout');
  const chargeId = req.body?.id || req.body?.charge_id;
  try {
    const result = await tapCheckout.handleTapReturnOrWebhook(chargeId);
    res.json({ received: true, ok: result.ok, status: result.status });
  } catch (err) {
    console.warn('[tap] webhook:', err?.code, err?.message || err);
    // Unknown / invalid charges are acknowledged so Tap stops retrying; real failures get 500 → retry.
    if (['UNKNOWN_CHARGE', 'INVALID_CHARGE', 'AMOUNT_MISMATCH'].includes(err?.code)) {
      return res.json({ received: true, ignored: err.code });
    }
    return res.status(500).json({ received: false });
  }
});

// ─── Admin ──────────────────────────────────────────────────────────────────
router.get('/admin/snapshot', requireAdmin, wrap(async (_req, res) => res.json(await workforce.snapshot())));

router.get('/admin/engagements', requireAdmin, wrap(async (req, res) => {
  const { status, talentEmail, clientEmail } = req.query;
  res.json({ engagements: await workforce.listEngagements({ status, talentEmail, clientEmail }) });
}));

router.get('/admin/talent-options', requireAdmin, wrap(async (_req, res) => {
  res.json({ talent: await workforce.listTalentOptions() });
}));

/**
 * HR dossier for a directory talent (admin). Matched via ERP work/personal email.
 * Never exposed on the public talent directory.
 */
router.get('/admin/talent/:talentId/hr-details', requireAdmin, wrap(async (req, res) => {
  const hr = require('../services/hrDirectoryService');
  const talent = await workforce.getTalentProfile(req.params.talentId);
  const result = await hr.lookupByEmail(talent.email);
  res.json({
    talent: { id: talent.id, name: talent.name, email: talent.email, jobTitle: talent.jobTitle },
    configured: hr.isConfigured(),
    ...result,
  });
}));

router.get('/admin/hr-details', requireAdmin, wrap(async (req, res) => {
  const hr = require('../services/hrDirectoryService');
  const email = String(req.query.email || '').trim();
  if (!email) fail('INVALID_EMAIL', 'email query required');
  const result = await hr.lookupByEmail(email);
  res.json({ configured: hr.isConfigured(), email, ...result });
}));

router.get('/admin/client-options', requireAdmin, wrap(async (_req, res) => {
  res.json({ clients: await workforce.listClientOptions() });
}));

/** Admin hire: any client + talent, fee may be overridden. */
router.post('/admin/engagements', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  let job = null;
  let talent = null;
  if (b.jobId) {
    job = await workforce.getJob(b.jobId);
    talent = { id: b.talentProfileId || null, email: b.talentEmail, name: b.talentName, jobTitle: b.roleTitle };
  }
  const result = await workforce.hire(
    {
      talentEmail: b.talentEmail,
      talentName: b.talentName,
      talentUserId: b.talentUserId || null,
      clientId: b.clientId || null,
      clientName: b.clientName,
      clientEmail: b.clientEmail,
      roleTitle: b.roleTitle,
      salaryAmount: b.salaryAmount,
      currency: b.currency,
      cadence: b.cadence,
      bygFeePercent: b.bygFeePercent ?? (await workforce.defaultFeePercent()),
      startDate: b.startDate,
      jobId: job?.id || null,
    },
    actor(req),
    { job, talent }
  );
  res.status(result.created ? 201 : 200).json(result);
}));

router.get('/admin/engagements/:id', requireAdmin, wrap(async (req, res) => {
  const engagement = await workforce.getEngagement(req.params.id);
  const contracts = await workforce.listContracts({ engagementId: req.params.id });
  const invoices = await workforce.listInvoices({ engagementId: req.params.id });
  res.json({ engagement, contracts, invoices });
}));

router.post('/admin/engagements/:id/status', requireAdmin, wrap(async (req, res) => {
  const { status, reason, endDate } = req.body || {};
  if (!['active', 'paused', 'ended'].includes(status)) fail('INVALID_STATUS', 'Status must be active, paused or ended');
  res.json({ engagement: await workforce.updateEngagementStatus(req.params.id, status, { reason, endDate }, actor(req)) });
}));

router.post('/admin/engagements/:id/contract', requireAdmin, wrap(async (req, res) => {
  res.status(201).json({ contract: await workforce.createContractFromTemplate(req.params.id, actor(req)) });
}));

const FILLABLE_FIELDS = ['role_title', 'talent_name', 'client_name'];

router.patch('/admin/contracts/:id/fill', requireAdmin, wrap(async (req, res) => {
  const input = req.body?.fields || {};
  const fields = {};
  for (const key of FILLABLE_FIELDS) {
    if (input[key] != null) fields[key] = String(input[key]).trim().slice(0, 200);
  }
  if (!Object.keys(fields).length) fail('NO_FIELDS', `Editable fields: ${FILLABLE_FIELDS.join(', ')} (use /start-date for dates)`);
  await workforce.fillContract(req.params.id, fields, actor(req));
  res.json({ contract: await workforce.reviewContract(req.params.id, actor(req)) });
}));

/** Global platform fee default (applies to new client hires). */
router.get('/admin/settings', requireAdmin, wrap(async (_req, res) => {
  res.json({ defaultFeePercent: await workforce.defaultFeePercent() });
}));

router.patch('/admin/settings', requireAdmin, wrap(async (req, res) => {
  res.json(await workforce.setDefaultFeePercent(req.body?.defaultFeePercent, actor(req)));
}));

/** Start date also moves the engagement + billing anchor, so it has its own endpoint. */
router.patch('/admin/contracts/:id/start-date', requireAdmin, wrap(async (req, res) => {
  res.json(await workforce.changeStartDate(req.params.id, req.body?.startDate, actor(req)));
}));

/** Edit pay terms / start date before fully signed — regenerates contract live. */
router.patch('/admin/contracts/:id/terms', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  res.json(
    await workforce.updateContractTerms(
      req.params.id,
      {
        startDate: b.startDate,
        salaryAmount: b.salaryAmount,
        bygFeePercent: b.bygFeePercent,
        currency: b.currency,
        cadence: b.cadence,
      },
      actor(req)
    )
  );
}));

router.post('/admin/contracts/:id/review', requireAdmin, wrap(async (req, res) => {
  res.json({ contract: await workforce.reviewContract(req.params.id, actor(req)) });
}));

/** BYG Hires countersignature (third party on the ICA). */
router.post('/admin/contracts/:id/sign', requireAdmin, wrap(async (req, res) => {
  const { invoice, ...contract } = await workforce.sign(req.params.id, 'byg', {
    signatureData: req.body?.signatureData,
    consent: req.body?.consent,
    ip: req.ip,
    signerEmail: actor(req),
  });
  res.json({ contract, invoice: invoice || null });
}));

/** Issue invoices for every active engagement whose next period is due. */
router.post('/admin/billing/run', requireAdmin, wrap(async (req, res) => {
  const asOf = req.body?.asOf;
  if (asOf && !isIsoDate(asOf)) fail('INVALID_DATE', 'asOf must be YYYY-MM-DD');
  res.json(await workforce.runBilling({ asOf }, actor(req)));
}));

router.get('/admin/invoices', requireAdmin, wrap(async (req, res) => {
  const { status, clientEmail, engagementId } = req.query;
  res.json({ invoices: await workforce.listInvoices({ status, clientEmail, engagementId }) });
}));

router.get('/admin/invoices/:id', requireAdmin, wrap(async (req, res) => {
  res.json(await workforce.getInvoiceDocument(req.params.id, { asAdmin: true }));
}));

/** Record an off-platform payment (bank transfer etc.). */
router.post('/admin/invoices/:id/mark-paid', requireAdmin, wrap(async (req, res) => {
  const reference = String(req.body?.reference || '').trim().slice(0, 120) || null;
  res.json(await workforce.payInvoice(req.params.id, { method: 'manual', providerRef: reference }, actor(req)));
}));

router.post('/admin/invoices/:id/void', requireAdmin, wrap(async (req, res) => {
  res.json({ invoice: await workforce.voidInvoice(req.params.id, actor(req)) });
}));

router.get('/admin/payouts', requireAdmin, wrap(async (req, res) => {
  const [payouts, engagements, accounts] = await Promise.all([
    workforce.listPayouts({ status: req.query.status }),
    workforce.listEngagements(),
    workforce.listPaymentAccounts(),
  ]);
  const engById = new Map(engagements.map((e) => [e.id, e]));
  const acctByEmail = new Map(accounts.map((a) => [a.ownerEmail, a]));
  res.json({
    payouts: payouts.map((p) => {
      const eng = engById.get(p.engagementId) || null;
      return {
        ...p,
        talentName: eng?.talentName || null,
        talentEmail: eng?.talentEmail || null,
        clientName: eng?.clientName || null,
        account: eng ? acctByEmail.get(eng.talentEmail) || null : null,
      };
    }),
  });
}));

router.post('/admin/payouts/:id/release', requireAdmin, wrap(async (req, res) => {
  const reference = String(req.body?.reference || '').trim().slice(0, 120);
  if (!reference) fail('REFERENCE_REQUIRED', 'Enter the transfer reference so the talent can trace the payment');
  const notes = String(req.body?.notes || '').trim().slice(0, 500) || null;
  res.json({ payout: await workforce.releasePayout(req.params.id, { reference, notes }, actor(req)) });
}));

router.post('/admin/payment-accounts/:id/verify', requireAdmin, wrap(async (req, res) => {
  res.json({ account: await workforce.verifyPaymentAccount(req.params.id, actor(req)) });
}));

/** Client paid BYG by bank transfer → credit their wallet. */
router.post('/admin/wallets/credit', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const currency = String(b.currency || 'USD').toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(currency)) fail('INVALID_CURRENCY', 'Unsupported currency');
  const reference = String(b.reference || '').trim().slice(0, 120);
  if (!reference) fail('REFERENCE_REQUIRED', 'Enter the bank transfer reference');
  const clients = await workforce.listClientOptions();
  const client = clients.find((c) => c.email === String(b.clientEmail || '').trim().toLowerCase());
  if (!client) fail('NOT_FOUND', 'Client not found');
  const result = await workforce.walletCredit(
    { ownerEmail: client.email, currency, amount: b.amount, memo: `Bank transfer ${reference}` },
    actor(req)
  );
  res.json(result);
}));

router.get('/admin/jobs', requireAdmin, wrap(async (req, res) => {
  res.json({ jobs: await workforce.listJobs({ status: req.query.status }) });
}));

router.patch('/admin/jobs/:id', requireAdmin, wrap(async (req, res) => {
  const fields = normalizeJobInput(req.body || {}, { partial: true });
  res.json({ job: await workforce.updateJob(req.params.id, fields, actor(req)) });
}));

router.post('/admin/jobs/:id/candidates', requireAdmin, wrap(async (req, res) => {
  const job = await workforce.getJob(req.params.id);
  const ids = (Array.isArray(req.body?.talentIds) ? req.body.talentIds : [req.body?.talentId]).filter(Boolean).slice(0, 25);
  if (!ids.length) fail('TALENT_REQUIRED', 'Pick at least one talent');
  const added = [];
  const skipped = [];
  for (const id of ids) {
    try {
      const talent = await workforce.getTalentProfile(id);
      added.push(await workforce.addJobCandidate(job.id, talent, { source: 'byg', notes: req.body?.notes || null }, actor(req)));
    } catch (err) {
      if (!['ALREADY_IN_PIPELINE', 'TALENT_NOT_FOUND'].includes(err.code)) throw err;
      skipped.push({ id, code: err.code });
    }
  }
  if (added.length) await notify.candidatesShortlisted(job, added.map((c) => c.talentName || 'a candidate'));
  res.status(201).json({ added, skipped, job: await workforce.getJob(job.id) });
}));

router.patch('/admin/jobs/:id/candidates/:cid', requireAdmin, wrap(async (req, res) => {
  const cand = await workforce.getJobCandidate(req.params.cid);
  if (cand.jobId !== req.params.id) fail('NOT_FOUND', 'Candidate not found');
  if (req.body?.stage) assertStageChange({ from: cand.stage, to: req.body.stage, actor: 'admin' });
  await workforce.updateJobCandidate(cand.id, { stage: req.body?.stage, notes: req.body?.notes }, actor(req));
  res.json({ job: await workforce.getJob(req.params.id) });
}));

// ─── Any signed-in party (client or talent) ─────────────────────────────────
router.get('/me/engagements', requireUser, wrap(async (req, res) => {
  const email = userEmail(req);
  const [asTalent, asClient] = await Promise.all([
    workforce.listEngagements({ talentEmail: email }),
    workforce.listEngagements({ clientEmail: email }),
  ]);
  const engagements = [...new Map([...asTalent, ...asClient].map((e) => [e.id, e])).values()];
  const contracts = await workforce.listContracts({ engagementIds: engagements.map((e) => e.id) });
  const sigs = await workforce.listSignaturesFor(contracts.map((c) => c.id));
  res.json({
    engagements,
    contracts: contracts.map((c) => ({ ...c, signatures: (sigs.get(c.id) || []).map(({ signatureData, ...s }) => s) })),
  });
}));

router.post('/contracts/:id/otp', requireUser, sensitiveLimiter, wrap(async (req, res) => {
  const result = await workforce.requestSignatureOtp(req.params.id, req.body?.role, userEmail(req));
  await notify.signatureOtp(userEmail(req), result.otp);
  const payload = { signatureId: result.signatureId, expiresAt: result.expiresAt, delivered: true };
  if (process.env.NODE_ENV !== 'production' && process.env.WORKFORCE_EXPOSE_OTP === 'true') payload.otp = result.otp;
  res.json(payload);
}));

router.post('/contracts/:id/sign', requireUser, sensitiveLimiter, wrap(async (req, res) => {
  const role = req.body?.role;
  if (!['client', 'talent'].includes(role)) fail('INVALID_ROLE', 'Only client or talent can sign here; BYG signs from admin.');
  const result = await workforce.sign(req.params.id, role, {
    otp: req.body?.otp,
    signatureData: req.body?.signatureData,
    consent: req.body?.consent,
    ip: req.ip,
    signerEmail: userEmail(req),
  });
  const { invoice, ...contract } = result;
  // Billing invoices are for the client and BYG only.
  res.json({ contract, invoice: role === 'client' ? invoice || null : null });
}));

// ─── Talent ─────────────────────────────────────────────────────────────────
const PAYOUT_METHODS = ['bank', 'wise', 'payoneer', 'paypal'];

function maskTail(value, keep = 4) {
  const s = String(value || '').replace(/\s+/g, '');
  return s.length <= keep ? s : `•••• ${s.slice(-keep)}`;
}

function normalizePayoutDetails(body = {}) {
  const method = String(body.method || '').toLowerCase();
  if (!PAYOUT_METHODS.includes(method)) fail('INVALID_METHOD', 'Choose bank transfer, Wise, Payoneer or PayPal');
  const clean = (k, max = 120) => String(body[k] ?? '').trim().slice(0, max);
  const details = { method, accountHolder: clean('accountHolder'), country: clean('country', 80) };
  if (!details.accountHolder) fail('HOLDER_REQUIRED', 'Account holder name is required');
  if (method === 'bank') {
    Object.assign(details, {
      bankName: clean('bankName'),
      iban: clean('iban', 64).toUpperCase(),
      accountNumber: clean('accountNumber', 64),
      swift: clean('swift', 20).toUpperCase(),
    });
    if (!details.bankName || !(details.iban || details.accountNumber)) fail('BANK_REQUIRED', 'Bank name and IBAN or account number are required');
    return { details, maskedLabel: `${details.bankName} ${maskTail(details.iban || details.accountNumber)}` };
  }
  details.email = clean('email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) fail('EMAIL_REQUIRED', 'Enter the email on your payout account');
  const [user, domain] = details.email.split('@');
  return { details, maskedLabel: `${method[0].toUpperCase()}${method.slice(1)} · ${user.slice(0, 2)}•••@${domain}` };
}

router.get('/me/payout-account', requireUser, wrap(async (req, res) => {
  res.json({ account: await workforce.getPayoutAccount(userEmail(req)) });
}));

router.put('/me/payout-account', requireUser, sensitiveLimiter, wrap(async (req, res) => {
  const engagements = await workforce.listEngagements({ talentEmail: userEmail(req) });
  if (!engagements.length) fail('FORBIDDEN', 'Payout details are available once you have a BYG engagement');
  res.json({ account: await workforce.savePayoutAccount(userEmail(req), normalizePayoutDetails(req.body)) });
}));

router.get('/me/payouts', requireUser, wrap(async (req, res) => {
  res.json({ payouts: await workforce.listPayouts({ talentEmail: userEmail(req) }) });
}));

// ─── Client ─────────────────────────────────────────────────────────────────
router.get('/me/client', ...clientOnly, wrap(async (req, res) => {
  const info = await workforce.backendInfo();
  res.json({
    client: req.client,
    defaultFeePercent: await workforce.defaultFeePercent(),
    tapConfigured: info.tapConfigured,
    currencies: SUPPORTED_CURRENCIES,
  });
}));

router.get('/me/invoices', ...clientOnly, wrap(async (req, res) => {
  res.json({ invoices: await workforce.listInvoices({ clientEmail: req.client.email }) });
}));

router.get('/me/invoices/:id', ...clientOnly, wrap(async (req, res) => {
  res.json(await workforce.getInvoiceDocument(req.params.id, { actorEmail: req.client.email }));
}));

router.post('/me/invoices/:id/pay-tap', ...clientOnly, sensitiveLimiter, wrap(async (req, res) => {
  res.json(await require('../services/workforceTapCheckout').startInvoiceTapPay(req.params.id, req.client));
}));

router.post('/me/invoices/:id/pay-wallet', ...clientOnly, sensitiveLimiter, wrap(async (req, res) => {
  res.json(await workforce.payInvoice(req.params.id, { method: 'wallet', payerEmail: req.client.email }, req.client.email));
}));

/**
 * Client offline / test payment — marks invoice paid and emails BYG admins
 * so they can release the talent payout from Admin → Workforce.
 */
router.post('/me/invoices/:id/pay-manual', ...clientOnly, sensitiveLimiter, wrap(async (req, res) => {
  const reference = String(req.body?.reference || '').trim().slice(0, 120) || null;
  const note = String(req.body?.note || '').trim().slice(0, 500) || null;
  res.json(await workforce.clientManualPay(req.params.id, { reference, note }, req.client.email));
}));

router.get('/me/wallet', ...clientOnly, wrap(async (req, res) => {
  const [wallets, transactions] = await Promise.all([
    workforce.listWallets(req.client.email),
    workforce.listWalletTxns(req.client.email).catch(() => []),
  ]);
  res.json({ wallets, transactions });
}));

router.post('/me/wallet/topup', ...clientOnly, sensitiveLimiter, wrap(async (req, res) => {
  res.json(
    await require('../services/workforceTapCheckout').startWalletTopup({
      amount: req.body?.amount,
      currency: req.body?.currency,
      client: req.client,
    })
  );
}));

router.post('/me/wallet/auto-pay', ...clientOnly, wrap(async (req, res) => {
  const currency = String(req.body?.currency || 'USD').toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(currency)) fail('INVALID_CURRENCY', 'Unsupported currency');
  res.json({ wallet: await workforce.setWalletAutoPay(req.client.email, currency, req.body?.autoPay === true) });
}));

/** Directory talent for the hire picker — no contact details. */
router.get('/me/talent-options', ...clientOnly, wrap(async (_req, res) => {
  const talent = await workforce.listTalentOptions();
  res.json({ talent: talent.map(({ id, name, jobTitle, suggestedSalary }) => ({ id, name, jobTitle, suggestedSalary })) });
}));

/**
 * HR dossier before hire (logged-in client only).
 * Public directory APIs never return these fields.
 */
router.get('/me/talent/:talentId/hr-details', ...clientOnly, wrap(async (req, res) => {
  const hr = require('../services/hrDirectoryService');
  const talent = await workforce.getTalentProfile(req.params.talentId);
  const result = await hr.lookupByEmail(talent.email);
  res.json({
    talent: { id: talent.id, name: talent.name, jobTitle: talent.jobTitle },
    configured: hr.isConfigured(),
    ...result,
  });
}));

async function clientHireInput(req, talent) {
  const b = req.body || {};
  const currency = String(b.currency || 'USD').toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(currency)) fail('INVALID_CURRENCY', 'Unsupported currency');
  if (b.startDate && !isIsoDate(b.startDate)) fail('INVALID_DATE', 'Start date must be YYYY-MM-DD');
  return {
    talentEmail: talent.email,
    talentName: talent.name,
    talentUserId: talent.userId || null,
    clientId: req.client.id,
    clientName: req.client.name,
    clientEmail: req.client.email,
    roleTitle: b.roleTitle || talent.jobTitle || 'Remote contractor',
    salaryAmount: b.salaryAmount,
    currency,
    cadence: b.cadence || 'monthly',
    bygFeePercent: await workforce.defaultFeePercent(),
    startDate: b.startDate,
  };
}

/** Draft ICA preview before hiring (no DB write). */
router.post('/me/contract-preview', ...clientOnly, wrap(async (req, res) => {
  const { BYG_CONTRACT_HTML, renderContractHtml, buildFilledFields } = require('../services/workforce/bygContractTemplate');
  const { validateEngagementInput } = require('../services/workforce/engine');
  const talent = await workforce.getTalentProfile(req.body?.talentId);
  const v = validateEngagementInput(await clientHireInput(req, talent));
  const filledFields = buildFilledFields(
    { ...v, talentName: talent.name },
    { amount: v.amount, currency: v.currency, cadence: v.cadence, bygFeePercent: v.fee }
  );
  res.json({ filledFields, renderedHtml: renderContractHtml(BYG_CONTRACT_HTML, filledFields), feePercent: v.fee });
}));

/** Client hires a particular talent from the directory (optionally for one of their jobs). */
router.post('/me/hire', ...clientOnly, sensitiveLimiter, wrap(async (req, res) => {
  const talent = await workforce.getTalentProfile(req.body?.talentId);
  let job = null;
  if (req.body?.jobId) {
    job = await workforce.getJob(req.body.jobId);
    if (job.clientEmail !== req.client.email) fail('NOT_FOUND', 'Job not found');
  }
  const result = await workforce.hire({ ...(await clientHireInput(req, talent)), jobId: job?.id || null }, req.client.email, { job, talent });
  res.status(result.created ? 201 : 200).json(result);
}));

/** Client moves the start date before the contract is fully signed (past dates allowed). */
router.patch('/me/contracts/:id/start-date', ...clientOnly, wrap(async (req, res) => {
  const startDate = req.body?.startDate;
  if (!isIsoDate(startDate)) fail('INVALID_DATE', 'Start date must be YYYY-MM-DD');
  const contract = await workforce.getContract(req.params.id);
  const eng = await workforce.getEngagement(contract.engagementId);
  if (eng.clientEmail !== req.client.email) fail('NOT_FOUND', 'Contract not found');
  res.json(await workforce.changeStartDate(contract.id, startDate, req.client.email));
}));

/**
 * Client can update start date + contractor pay before full signature.
 * Platform fee stays server-controlled (defaultFeePercent / admin override).
 */
router.patch('/me/contracts/:id/terms', ...clientOnly, wrap(async (req, res) => {
  const b = req.body || {};
  if (b.startDate != null && b.startDate !== '' && !isIsoDate(b.startDate)) {
    fail('INVALID_DATE', 'Start date must be YYYY-MM-DD');
  }
  const contract = await workforce.getContract(req.params.id);
  const eng = await workforce.getEngagement(contract.engagementId);
  if (eng.clientEmail !== req.client.email) fail('NOT_FOUND', 'Contract not found');
  res.json(
    await workforce.updateContractTerms(
      contract.id,
      {
        startDate: b.startDate,
        salaryAmount: b.salaryAmount,
        currency: b.currency,
        cadence: b.cadence,
      },
      req.client.email
    )
  );
}));

// Jobs — clients see their own pipeline without talent contact details.
function clientJobView(job) {
  return {
    ...job,
    candidates: job.candidates.map(({ talentEmail, ...c }) => c),
  };
}

async function ownJob(req) {
  const job = await workforce.getJob(req.params.id);
  if (job.clientEmail !== req.client.email) fail('NOT_FOUND', 'Job not found');
  return job;
}

router.get('/me/jobs', ...clientOnly, wrap(async (req, res) => {
  const jobs = await workforce.listJobs({ clientEmail: req.client.email });
  res.json({ jobs: jobs.map(clientJobView) });
}));

router.post('/me/jobs', ...clientOnly, sensitiveLimiter, wrap(async (req, res) => {
  const fields = normalizeJobInput(req.body || {});
  const job = await workforce.createJob(req.client, { ...fields, status: 'open' }, req.client.email);
  await notify.jobPosted(job);
  res.status(201).json({ job: clientJobView(job) });
}));

router.patch('/me/jobs/:id', ...clientOnly, wrap(async (req, res) => {
  await ownJob(req);
  const fields = normalizeJobInput(req.body || {}, { partial: true });
  res.json({ job: clientJobView(await workforce.updateJob(req.params.id, fields, req.client.email)) });
}));

router.post('/me/jobs/:id/candidates', ...clientOnly, wrap(async (req, res) => {
  const job = await ownJob(req);
  const talent = await workforce.getTalentProfile(req.body?.talentId);
  await workforce.addJobCandidate(job.id, talent, { source: 'client' }, req.client.email);
  res.status(201).json({ job: clientJobView(await workforce.getJob(job.id)) });
}));

router.patch('/me/jobs/:id/candidates/:cid', ...clientOnly, wrap(async (req, res) => {
  await ownJob(req);
  const cand = await workforce.getJobCandidate(req.params.cid);
  if (cand.jobId !== req.params.id) fail('NOT_FOUND', 'Candidate not found');
  if (req.body?.stage) assertStageChange({ from: cand.stage, to: req.body.stage, actor: 'client' });
  await workforce.updateJobCandidate(cand.id, { stage: req.body?.stage, notes: req.body?.notes }, req.client.email);
  res.json({ job: clientJobView(await workforce.getJob(req.params.id)) });
}));

module.exports = router;

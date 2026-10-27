/**
 * BYG Workforce HRIS service — same pattern as profileReview / ambassadors:
 * talks to Supabase via supabaseAdmin (see workforce/db.js).
 *
 * Memory engine is ONLY for unit tests / WORKFORCE_STORE=memory.
 * Production: run the supabase/workforce_*.sql migrations (v3 last).
 *
 * Store methods are passed straight through; the orchestrated flows below
 * (hire, sign, billing, payouts) add auto-pay and notifications on top.
 */

const { createWorkforceEngine } = require('./workforce/engine');
const db = require('./workforce/db');
const notify = require('./workforce/notify');

const ENABLED = String(process.env.WORKFORCE_ENABLED || 'true').toLowerCase() !== 'false';

function useMemory() {
  return process.env.WORKFORCE_STORE === 'memory' || process.env.NODE_ENV === 'test';
}

let memoryEngine = null;
let memoryApiCache = null;

/** Async facade over the sync memory engine (every engine function becomes awaitable). */
function memoryApi() {
  if (!memoryEngine) memoryEngine = createWorkforceEngine();
  if (memoryApiCache) return memoryApiCache;
  const api = { ping: async () => true };
  for (const [name, fn] of Object.entries(memoryEngine)) {
    if (typeof fn === 'function') api[name] = async (...args) => fn(...args);
  }
  api.snapshot = async () => ({ ...memoryEngine.snapshot(), store: 'memory' });
  memoryApiCache = api;
  return api;
}

/** Test hook: fresh in-memory store. */
function resetMemoryStore(seed) {
  memoryEngine = createWorkforceEngine(seed);
  memoryApiCache = null;
  return memoryEngine;
}

function api() {
  return useMemory() ? memoryApi() : db;
}

function isEnabled() {
  return ENABLED;
}

function requireEnabled() {
  if (!ENABLED) {
    const err = new Error('Workforce HRIS is disabled.');
    err.code = 'WORKFORCE_DISABLED';
    throw err;
  }
}

async function call(method, ...args) {
  requireEnabled();
  const backend = api();
  if (typeof backend[method] !== 'function') {
    const err = new Error(`Workforce feature "${method}" is not available in this store`);
    err.code = 'NOT_SUPPORTED';
    throw err;
  }
  return backend[method](...args);
}

/** Platform fee for client-initiated hires. Admins can override per engagement. */
function defaultFeePercent() {
  const n = Number(process.env.WORKFORCE_DEFAULT_FEE_PERCENT);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 10;
}

async function backendInfo() {
  requireEnabled();
  const tap = require('./tapPayments');
  const base = {
    tapConfigured: tap.isConfigured(),
    payments: tap.isConfigured() ? 'tap' : 'manual',
    defaultFeePercent: defaultFeePercent(),
  };
  if (useMemory()) {
    return { ...base, store: 'memory', schemaReady: true, note: 'Test/memory mode — data resets on restart.' };
  }
  try {
    await db.ping();
    return {
      ...base,
      store: 'supabase',
      schemaReady: true,
      note: tap.isConfigured() ? 'Tap enabled for invoice pay + wallet top-up.' : 'Set TAP_SECRET_KEY for card payments; manual mark-paid still works.',
    };
  } catch (err) {
    return { ...base, store: 'supabase', schemaReady: false, note: err.message, code: err.code || 'SCHEMA_MISSING' };
  }
}

// ─── Orchestrated flows ─────────────────────────────────────────────────────

/** Pay a freshly issued invoice from the client wallet when auto-pay is on. */
async function autoPayIfEnabled(invoice) {
  if (!invoice?.clientEmail || invoice.status !== 'sent') return null;
  try {
    const wallets = await call('listWallets', invoice.clientEmail);
    const wallet = wallets.find((w) => w.currency === invoice.currency);
    if (!wallet?.autoPay || wallet.balance < invoice.total) return null;
    const res = await call('payInvoice', invoice.id, { method: 'wallet', payerEmail: invoice.clientEmail }, 'system:auto-pay');
    return res.invoice;
  } catch (err) {
    console.warn('[workforce] auto-pay skipped:', err?.code || err?.message || err);
    return null;
  }
}

async function afterInvoiceIssued(invoice, eng = null) {
  const paid = await autoPayIfEnabled(invoice);
  let engagement = eng;
  if (!engagement) {
    try {
      engagement = await call('getEngagement', invoice.engagementId);
    } catch (_e) {
      engagement = null;
    }
  }
  await notify.invoiceIssued(paid || invoice, engagement, { autoPaid: Boolean(paid) });
  return paid || invoice;
}

async function hire(input, actorEmail = null, { job = null, talent = null } = {}) {
  const result = await call('createEngagement', input, actorEmail);
  if (result.created) {
    if (job && talent) {
      try {
        await call('linkCandidateEngagement', job.id, talent, result.engagement.id, actorEmail);
      } catch (err) {
        console.warn('[workforce] job link failed:', err?.message || err);
      }
    }
    await notify.contractReady(result.engagement);
  }
  return result;
}

async function sign(contractId, role, opts) {
  const result = await call('signContract', contractId, role, opts);
  const eng = await call('getEngagement', result.engagementId);
  if (result.complete) {
    await notify.engagementActive(eng);
    if (result.invoice) result.invoice = await afterInvoiceIssued(result.invoice, eng);
  } else if (result.signedRoles?.includes('client') && result.signedRoles?.includes('talent')) {
    await notify.awaitingBygSignature(eng);
  }
  return result;
}

async function changeStartDate(contractId, startDate, actorEmail) {
  const result = await call('changeStartDate', contractId, startDate, actorEmail);
  const eng = await call('getEngagement', result.contract.engagementId);
  await notify.contractUpdated(eng, { clearedRoles: result.clearedRoles, actorEmail });
  return { ...result, engagement: eng };
}

/** Recurring billing (cron + admin "Run billing"). */
async function runBilling({ asOf, leadDays } = {}, actorEmail = 'system:billing') {
  const lead = leadDays != null ? Number(leadDays) : Number(process.env.WORKFORCE_BILLING_LEAD_DAYS || 7);
  const { issued, asOf: date } = await call('issueDueInvoices', { asOf, leadDays: Number.isFinite(lead) ? lead : 7 }, actorEmail);
  const out = [];
  for (const invoice of issued) out.push(await afterInvoiceIssued(invoice));
  return { asOf: date, issued: out.length, autoPaid: out.filter((i) => i.status === 'paid').length, invoices: out };
}

/**
 * Client offline/manual pay (test phase + bank transfers).
 * Marks invoice paid, queues talent payout, emails BYG admins.
 */
async function clientManualPay(invoiceId, { reference = null, note = null } = {}, clientEmail) {
  requireEnabled();
  const result = await call(
    'payInvoice',
    invoiceId,
    {
      method: 'manual',
      providerRef: reference || `client_manual_${String(invoiceId).slice(0, 8)}`,
      payerEmail: clientEmail,
    },
    clientEmail
  );
  let eng = null;
  try {
    eng = await call('getEngagement', result.invoice.engagementId);
  } catch (_e) {
    eng = null;
  }
  await notify.manualPaymentByClient(result.invoice, eng, { note, payoutId: result.payoutId });
  return result;
}

async function releasePayout(payoutId, opts, actorEmail) {
  const payout = await call('releasePayout', payoutId, opts, actorEmail);
  try {
    await notify.payoutSent(payout, await call('getEngagement', payout.engagementId));
  } catch (err) {
    console.warn('[workforce] payout notify:', err?.message || err);
  }
  return payout;
}

/**
 * Soft hire bridge — only when a real salary is provided.
 * Does not break ambassador hire if Workforce fails.
 */
async function tryCreateEngagementFromHire(placement, meta = {}) {
  if (!ENABLED) return null;
  const salaryAmount = Number(meta.salaryAmount);
  if (!Number.isFinite(salaryAmount) || salaryAmount <= 0) return null;
  try {
    return await call(
      'createEngagement',
      {
        talentEmail: placement.talentEmail || meta.talentEmail,
        talentName: placement.talentName || meta.talentName,
        talentUserId: placement.talentUserId || meta.talentUserId,
        clientName: meta.clientName || 'Client',
        clientEmail: meta.clientEmail || null,
        roleTitle: meta.roleTitle || 'Remote contractor',
        salaryAmount,
        currency: meta.currency || 'USD',
        cadence: meta.cadence || 'monthly',
        bygFeePercent: meta.bygFeePercent != null ? meta.bygFeePercent : defaultFeePercent(),
        startDate: meta.startDate,
        ambassadorPlacementId: placement.id || null,
      },
      meta.actorEmail || null
    );
  } catch (err) {
    console.warn('[workforce] hire bridge skipped:', err?.code || err?.message || err);
    return null;
  }
}

const PASS_THROUGH = [
  'createEngagement',
  'listEngagements',
  'listHiredDirectoryProfileIds',
  'getEngagement',
  'updateEngagementStatus',
  'createContractFromTemplate',
  'listContracts',
  'getContract',
  'fillContract',
  'reviewContract',
  'requestSignatureOtp',
  'listSignatures',
  'listSignaturesFor',
  'listInvoices',
  'getInvoice',
  'getInvoiceDocument',
  'voidInvoice',
  'payInvoice',
  'listWallets',
  'listWalletTxns',
  'getOrCreateWallet',
  'setWalletAutoPay',
  'walletCredit',
  'recordTapCharge',
  'markTapCharge',
  'getTapCharge',
  'fulfillTapCharge',
  'listPayouts',
  'getPayoutAccount',
  'savePayoutAccount',
  'verifyPaymentAccount',
  'listPaymentAccounts',
  'getTalentProfile',
  'getClientForUser',
  'listTalentOptions',
  'listClientOptions',
  'createJob',
  'getJob',
  'listJobs',
  'updateJob',
  'addJobCandidate',
  'getJobCandidate',
  'updateJobCandidate',
  'snapshot',
];

module.exports = {
  isEnabled,
  requireEnabled,
  backendInfo,
  defaultFeePercent,
  tryCreateEngagementFromHire,
  hire,
  sign,
  changeStartDate,
  runBilling,
  clientManualPay,
  releasePayout,
  resetMemoryStore,
  ...Object.fromEntries(PASS_THROUGH.map((m) => [m, (...a) => call(m, ...a)])),
};

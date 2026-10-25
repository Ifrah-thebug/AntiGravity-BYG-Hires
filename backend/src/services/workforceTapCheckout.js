/**
 * Start Tap checkout for invoice pay or wallet top-up, and apply Tap results.
 * Callers (routes) have already resolved `client` from the session.
 */
const tap = require('./tapPayments');
const workforce = require('./workforceService');
const { SUPPORTED_CURRENCIES } = require('./workforce/jobRules');

const MAX_TOPUP = 250_000;

/** Tap charge statuses that will never become CAPTURED. */
const TERMINAL_FAILED = new Set(['FAILED', 'DECLINED', 'CANCELLED', 'VOID', 'RESTRICTED', 'TIMEDOUT', 'UNKNOWN']);

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  throw err;
}

function ensureTap() {
  if (!tap.isConfigured()) fail('TAP_NOT_CONFIGURED', 'Card payments are not configured yet — please contact BYG Hires.');
}

function returnUrls() {
  const backend = tap.backendBase();
  return {
    redirectUrl: `${backend}/api/workforce/payments/tap/return`,
    postUrl: /localhost|127\.0\.0\.1/i.test(backend) ? undefined : `${backend}/api/workforce/webhooks/tap`,
  };
}

async function startInvoiceTapPay(invoiceId, client) {
  ensureTap();
  const invoice = await workforce.getInvoice(invoiceId);
  if (invoice.clientEmail !== client.email) fail('NOT_FOUND', 'Invoice not found');
  if (invoice.status === 'paid') fail('ALREADY_PAID', 'Invoice already paid');
  if (invoice.status === 'void') fail('VOID', 'Invoice was voided');

  const charge = await tap.createCharge({
    amount: invoice.total,
    currency: invoice.currency,
    customerEmail: client.email,
    customerName: client.contactName || client.name || client.email,
    description: `BYG Hires invoice ${invoice.invoiceNumber}`,
    metadata: { udf1: 'invoice_pay', udf2: client.email, udf3: invoice.id },
    reference: { transaction: `inv_${invoice.id.slice(0, 8)}_${Date.now()}`, order: invoice.invoiceNumber },
    ...returnUrls(),
  });
  const url = tap.checkoutUrl(charge);
  if (!url) fail('TAP_API_ERROR', 'Tap did not return a checkout URL');

  await workforce.recordTapCharge({
    id: charge.id,
    purpose: 'invoice_pay',
    ownerEmail: client.email,
    invoiceId: invoice.id,
    amount: invoice.total,
    currency: invoice.currency,
    redirectUrl: url,
    meta: { invoiceNumber: invoice.invoiceNumber },
  });
  return { chargeId: charge.id, redirectUrl: url, purpose: 'invoice_pay', invoiceId: invoice.id };
}

async function startWalletTopup({ amount, currency, client }) {
  ensureTap();
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(amt) || amt <= 0) fail('INVALID_AMOUNT', 'Top-up amount must be positive');
  if (amt > MAX_TOPUP) fail('INVALID_AMOUNT', `Top-ups above ${MAX_TOPUP.toLocaleString()} must be sent by bank transfer`);
  const cur = String(currency || tap.defaultCurrency()).toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(cur)) fail('INVALID_CURRENCY', 'Unsupported currency');

  const charge = await tap.createCharge({
    amount: amt,
    currency: cur,
    customerEmail: client.email,
    customerName: client.contactName || client.name || client.email,
    description: `BYG Hires wallet top-up ${amt} ${cur}`,
    metadata: { udf1: 'wallet_topup', udf2: client.email, udf3: '' },
    reference: { transaction: `wal_${Date.now()}`, order: `wallet_${client.id || client.email.slice(0, 12)}` },
    ...returnUrls(),
  });
  const url = tap.checkoutUrl(charge);
  if (!url) fail('TAP_API_ERROR', 'Tap did not return a checkout URL');

  await workforce.recordTapCharge({
    id: charge.id,
    purpose: 'wallet_topup',
    ownerEmail: client.email,
    invoiceId: null,
    amount: amt,
    currency: cur,
    redirectUrl: url,
    meta: {},
  });
  return { chargeId: charge.id, redirectUrl: url, purpose: 'wallet_topup', amount: amt, currency: cur };
}

/**
 * Redirect return + webhook share this path. We never trust the posted body:
 * the charge is always re-fetched from Tap with our secret key.
 */
async function handleTapReturnOrWebhook(chargeId) {
  const id = String(chargeId || '').trim();
  if (!/^chg_[A-Za-z0-9_]+$/.test(id)) fail('INVALID_CHARGE', 'Missing or invalid Tap charge id');
  const known = await workforce.getTapCharge(id);
  if (!known) fail('UNKNOWN_CHARGE', 'Unknown Tap charge');

  const charge = await tap.retrieveCharge(id);
  const status = String(charge.status || '').toUpperCase();
  if (status === 'CAPTURED') {
    const result = await workforce.fulfillTapCharge(id, charge.amount, charge.currency, known.ownerEmail);
    return { ok: true, status, ...result, purpose: known.purpose };
  }
  if (TERMINAL_FAILED.has(status)) await workforce.markTapCharge(id, 'failed');
  if (status === 'ABANDONED') await workforce.markTapCharge(id, 'abandoned');
  return { ok: false, status, purpose: known.purpose, chargeId: id };
}

module.exports = {
  startInvoiceTapPay,
  startWalletTopup,
  handleTapReturnOrWebhook,
};

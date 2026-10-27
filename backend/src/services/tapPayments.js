/**
 * Tap Payments (GoSell) — server-side charges only.
 * Docs: https://developers.tap.company/reference/create-a-charge
 */

const TAP_API = 'https://api.tap.company/v2';

function secretKey() {
  return String(process.env.TAP_SECRET_KEY || '').trim();
}

function isConfigured() {
  return Boolean(secretKey());
}

function defaultCurrency() {
  return String(process.env.TAP_CURRENCY || 'USD')
    .trim()
    .toUpperCase() || 'USD';
}

function frontendBase() {
  return String(process.env.CLIENT_URI || process.env.FRONTEND_URL || 'http://localhost:5173').replace(
    /\/$/,
    ''
  );
}

function backendBase() {
  const port = process.env.PORT || 5001;
  return String(process.env.BACKEND_URL || process.env.API_URL || `http://localhost:${port}`).replace(
    /\/$/,
    ''
  );
}

function splitName(fullName) {
  const parts = String(fullName || 'Client')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] || 'Client',
    lastName: parts.slice(1).join(' ') || 'BYG',
  };
}

function defaultPhone() {
  const raw = String(process.env.TAP_DEFAULT_PHONE || '96550000000').replace(/\D/g, '');
  // first 3 digits country, rest number (Tap Kuwait default for test)
  if (raw.length >= 8) {
    return { country_code: raw.slice(0, 3), number: raw.slice(3) };
  }
  return { country_code: '965', number: '50000000' };
}

async function tapFetch(path, { method = 'GET', body } = {}) {
  if (!isConfigured()) {
    const err = new Error('Tap is not configured. Set TAP_SECRET_KEY in .env');
    err.code = 'TAP_NOT_CONFIGURED';
    throw err;
  }
  const res = await fetch(`${TAP_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.description ||
      data?.message ||
      data?.response?.message ||
      `Tap API ${res.status}`;
    const err = new Error(msg);
    err.code = 'TAP_API_ERROR';
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

/**
 * Create a hosted checkout charge. Returns Tap charge object (status INITIATED + transaction.url).
 */
async function createCharge({
  amount,
  currency,
  customerEmail,
  customerName,
  description,
  metadata = {},
  reference = {},
  redirectUrl,
  postUrl,
}) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    const err = new Error('Charge amount must be positive');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  const { firstName, lastName } = splitName(customerName);
  const cur = String(currency || defaultCurrency()).toUpperCase();

  const payload = {
    amount: amt,
    currency: cur,
    customer_initiated: true,
    threeDSecure: true,
    save_card: false,
    description: description || 'BYG Hires payment',
    metadata,
    reference: {
      transaction: reference.transaction || `byg_${Date.now()}`,
      order: reference.order || reference.transaction || `ord_${Date.now()}`,
    },
    receipt: { email: true, sms: false },
    customer: {
      first_name: firstName,
      last_name: lastName,
      email: String(customerEmail || '').trim().toLowerCase(),
      phone: defaultPhone(),
    },
    source: { id: 'src_all' },
    redirect: { url: redirectUrl },
  };
  if (postUrl) payload.post = { url: postUrl };

  return tapFetch('/charges', { method: 'POST', body: payload });
}

async function retrieveCharge(chargeId) {
  const id = String(chargeId || '').trim();
  if (!id) {
    const err = new Error('Charge id required');
    err.code = 'INVALID_CHARGE';
    throw err;
  }
  return tapFetch(`/charges/${encodeURIComponent(id)}`);
}

function checkoutUrl(charge) {
  return charge?.transaction?.url || null;
}

function isCaptured(charge) {
  return String(charge?.status || '').toUpperCase() === 'CAPTURED';
}

module.exports = {
  isConfigured,
  defaultCurrency,
  frontendBase,
  backendBase,
  createCharge,
  retrieveCharge,
  checkoutUrl,
  isCaptured,
};

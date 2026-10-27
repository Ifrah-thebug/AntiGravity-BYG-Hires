import { supabase } from './supabase';

/**
 * In Vite dev, prefer same-origin `/api` (proxied to :5001) to avoid CORS "Failed to fetch".
 * Production builds still use VITE_BACKEND_URL when set.
 */
function apiRoot() {
  const configured = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
  if (import.meta.env.DEV) return '';
  return configured;
}

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const err = new Error('Sign in required.');
    err.code = 'SIGN_IN_REQUIRED';
    throw err;
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch(path, options = {}) {
  const url = `${apiRoot()}${path}`;
  let resp;
  try {
    resp = await fetch(url, options);
  } catch (err) {
    const hint = import.meta.env.DEV
      ? 'Is the backend running? (cd backend && npm run dev — port 5001)'
      : `Cannot reach API (${url}).`;
    throw new Error(err?.message === 'Failed to fetch' ? `Failed to fetch — ${hint}` : err.message || 'Network error');
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || data.code || 'Request failed');
    err.code = data.code;
    err.status = resp.status;
    throw err;
  }
  return data;
}

async function authFetch(path, options = {}) {
  const headers = await authHeaders();
  return apiFetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
}

const post = (path, body) => authFetch(path, { method: 'POST', body: JSON.stringify(body || {}) });
const patch = (path, body) => authFetch(path, { method: 'PATCH', body: JSON.stringify(body || {}) });
const put = (path, body) => authFetch(path, { method: 'PUT', body: JSON.stringify(body || {}) });

export const workforceStatus = () => apiFetch('/api/workforce/status');

// ─── Admin ──────────────────────────────────────────────────────────────────
export const fetchWorkforceSnapshot = () => authFetch('/api/workforce/admin/snapshot');
export const fetchWorkforceTalentOptions = () => authFetch('/api/workforce/admin/talent-options');
export const fetchWorkforceClientOptions = () => authFetch('/api/workforce/admin/client-options');
export const createWorkforceEngagement = (body) => post('/api/workforce/admin/engagements', body);
export const fetchWorkforceSettings = () => authFetch('/api/workforce/admin/settings');
export const saveWorkforceSettings = (body) => patch('/api/workforce/admin/settings', body);
export const setEngagementStatus = (id, body) => post(`/api/workforce/admin/engagements/${id}/status`, body);
export const adminChangeContractStartDate = (contractId, startDate) =>
  patch(`/api/workforce/admin/contracts/${contractId}/start-date`, { startDate });
export const adminUpdateContractTerms = (contractId, terms) =>
  patch(`/api/workforce/admin/contracts/${contractId}/terms`, terms);
export const reviewWorkforceContract = (contractId) => post(`/api/workforce/admin/contracts/${contractId}/review`);
export const adminSignWorkforceContract = (contractId, payload) => post(`/api/workforce/admin/contracts/${contractId}/sign`, payload);
export const runBilling = (asOf) => post('/api/workforce/admin/billing/run', asOf ? { asOf } : {});
export const fetchAdminInvoiceDocument = (invoiceId) => authFetch(`/api/workforce/admin/invoices/${invoiceId}`);
export const markInvoicePaid = (invoiceId, reference) => post(`/api/workforce/admin/invoices/${invoiceId}/mark-paid`, { reference });
export const voidInvoice = (invoiceId) => post(`/api/workforce/admin/invoices/${invoiceId}/void`);
export const fetchAdminPayouts = () => authFetch('/api/workforce/admin/payouts');
export const releasePayout = (payoutId, reference, notes) => post(`/api/workforce/admin/payouts/${payoutId}/release`, { reference, notes });
export const verifyPaymentAccount = (accountId) => post(`/api/workforce/admin/payment-accounts/${accountId}/verify`);
export const creditClientWallet = (body) => post('/api/workforce/admin/wallets/credit', body);
export const fetchAdminJobs = () => authFetch('/api/workforce/admin/jobs');
export const adminUpdateJob = (jobId, body) => patch(`/api/workforce/admin/jobs/${jobId}`, body);
export const adminShortlist = (jobId, talentIds, notes) => post(`/api/workforce/admin/jobs/${jobId}/candidates`, { talentIds, notes });
export const adminUpdateCandidate = (jobId, candidateId, body) => patch(`/api/workforce/admin/jobs/${jobId}/candidates/${candidateId}`, body);

// ─── Any party ──────────────────────────────────────────────────────────────
export const fetchMyWorkforceEngagements = () => authFetch('/api/workforce/me/engagements');
export const signWorkforceContract = (contractId, payload) => post(`/api/workforce/contracts/${contractId}/sign`, payload);

// ─── Talent ─────────────────────────────────────────────────────────────────
export const fetchMyPayoutAccount = () => authFetch('/api/workforce/me/payout-account');
export const saveMyPayoutAccount = (body) => put('/api/workforce/me/payout-account', body);
export const fetchMyPayouts = () => authFetch('/api/workforce/me/payouts');

// ─── Client ─────────────────────────────────────────────────────────────────
export const fetchMyClient = () => authFetch('/api/workforce/me/client');
export const fetchMyWorkforceInvoices = () => authFetch('/api/workforce/me/invoices');
export const fetchMyInvoiceDocument = (invoiceId) => authFetch(`/api/workforce/me/invoices/${invoiceId}`);
export const payInvoiceWithTap = (invoiceId) => post(`/api/workforce/me/invoices/${invoiceId}/pay-tap`);
export const payInvoiceWithWallet = (invoiceId) => post(`/api/workforce/me/invoices/${invoiceId}/pay-wallet`);
/** Offline/test pay — marks invoice paid and emails BYG to release talent payout. */
export const payInvoiceManually = (invoiceId, { reference, note } = {}) =>
  post(`/api/workforce/me/invoices/${invoiceId}/pay-manual`, { reference, note });
export const fetchMyWallet = () => authFetch('/api/workforce/me/wallet');
export const topUpWallet = (amount, currency) => post('/api/workforce/me/wallet/topup', { amount, currency });
export const setWalletAutoPay = (currency, autoPay) => post('/api/workforce/me/wallet/auto-pay', { currency, autoPay });
export const fetchMyTalentOptions = () => authFetch('/api/workforce/me/talent-options');
/** Client/admin hire preview — HR dossier (not public directory). */
export const fetchMyTalentHrDetails = (talentId) =>
  authFetch(`/api/workforce/me/talent/${encodeURIComponent(talentId)}/hr-details`);
export const fetchAdminTalentHrDetails = (talentId) =>
  authFetch(`/api/workforce/admin/talent/${encodeURIComponent(talentId)}/hr-details`);
export const fetchAdminHrDetailsByEmail = (email) =>
  authFetch(`/api/workforce/admin/hr-details?email=${encodeURIComponent(email)}`);
export const previewWorkforceContract = (body) => post('/api/workforce/me/contract-preview', body);
export const clientHireTalent = (body) => post('/api/workforce/me/hire', body);
export const changeContractStartDate = (contractId, startDate) =>
  patch(`/api/workforce/me/contracts/${contractId}/start-date`, { startDate });
export const updateContractTerms = (contractId, terms) =>
  patch(`/api/workforce/me/contracts/${contractId}/terms`, terms);
export const fetchMyJobs = () => authFetch('/api/workforce/me/jobs');
export const createMyJob = (body) => post('/api/workforce/me/jobs', body);
export const updateMyJob = (jobId, body) => patch(`/api/workforce/me/jobs/${jobId}`, body);
export const addMyJobCandidate = (jobId, talentId) => post(`/api/workforce/me/jobs/${jobId}/candidates`, { talentId });
export const updateMyJobCandidate = (jobId, candidateId, body) => patch(`/api/workforce/me/jobs/${jobId}/candidates/${candidateId}`, body);

import { supabase } from '../lib/supabase';

const BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001').replace(/\/$/, '');

function isNetworkError(err) {
  const msg = String(err?.message || err || '');
  return /failed to fetch|networkerror|load failed|network request failed|aborted/i.test(msg);
}

async function fetchWithRetry(url, options, { retries = 2, delayMs = 800 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isNetworkError(err)) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Please log in to continue.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export async function fetchClientPortfolioAccessStatus({ talentId, email }) {
  const params = new URLSearchParams({
    talentId,
    email: String(email || '').trim(),
  });
  const res = await fetch(`${BASE}/api/portfolio-access/client-status?${params}`);
  return parseJson(res);
}

export async function fetchPortfolioViewAccess(talentId, shareToken = '') {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
  const params = new URLSearchParams();
  if (shareToken) params.set('share', shareToken);
  const qs = params.toString();
  const res = await fetch(
    `${BASE}/api/portfolio-access/view/${encodeURIComponent(talentId)}${qs ? `?${qs}` : ''}`,
    { headers }
  );
  return parseJson(res);
}

export async function fetchTalentPortfolioSharing() {
  const res = await fetch(`${BASE}/api/portfolio-access/talent/sharing`, {
    headers: await authHeaders(),
  });
  return parseJson(res);
}

export async function updateTalentPortfolioSharing({ portfolioPublicEnabled }) {
  const res = await fetch(`${BASE}/api/portfolio-access/talent/sharing`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ portfolioPublicEnabled }),
  });
  return parseJson(res);
}

export async function rotateTalentPortfolioShareToken() {
  const res = await fetch(`${BASE}/api/portfolio-access/talent/sharing/rotate-token`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  return parseJson(res);
}

export async function requestPortfolioAccess({ talentId }) {
  const res = await fetchWithRetry(`${BASE}/api/portfolio-access/request`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ talentId }),
  }, { retries: 2 });
  return parseJson(res);
}

export async function fetchTalentPortfolioRequests() {
  const res = await fetchWithRetry(`${BASE}/api/portfolio-access/talent/requests`, {
    headers: await authHeaders(),
  }, { retries: 2 });
  return parseJson(res);
}

export async function approvePortfolioRequest(requestId) {
  const res = await fetchWithRetry(
    `${BASE}/api/portfolio-access/talent/requests/${encodeURIComponent(requestId)}/approve`,
    {
      method: 'POST',
      headers: await authHeaders(),
    },
    { retries: 1 }
  );
  return parseJson(res);
}

export async function declinePortfolioRequest(requestId) {
  const res = await fetchWithRetry(
    `${BASE}/api/portfolio-access/talent/requests/${encodeURIComponent(requestId)}/decline`,
    {
      method: 'POST',
      headers: await authHeaders(),
    },
    { retries: 1 }
  );
  return parseJson(res);
}

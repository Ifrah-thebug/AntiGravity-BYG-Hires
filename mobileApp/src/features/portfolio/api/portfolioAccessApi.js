import { apiUrl, authHeaders, fetchWithRetry, parseJsonOrThrow } from '@/core/api/http';

async function jsonHeaders() {
  return { ...(await authHeaders()), 'Content-Type': 'application/json' };
}

export async function fetchTalentPortfolioSharing() {
  const res = await fetch(apiUrl('/api/portfolio-access/talent/sharing'), { headers: await jsonHeaders() });
  return parseJsonOrThrow(res);
}

export async function updateTalentPortfolioSharing({ portfolioPublicEnabled }) {
  const res = await fetch(apiUrl('/api/portfolio-access/talent/sharing'), {
    method: 'PATCH',
    headers: await jsonHeaders(),
    body: JSON.stringify({ portfolioPublicEnabled }),
  });
  return parseJsonOrThrow(res);
}

export async function rotateTalentPortfolioShareToken() {
  const res = await fetch(apiUrl('/api/portfolio-access/talent/sharing/rotate-token'), {
    method: 'POST',
    headers: await jsonHeaders(),
  });
  return parseJsonOrThrow(res);
}

export async function fetchTalentPortfolioRequests() {
  const res = await fetchWithRetry(
    apiUrl('/api/portfolio-access/talent/requests'),
    { headers: await jsonHeaders() },
    { retries: 2, delayMs: 800 }
  );
  return parseJsonOrThrow(res);
}

export async function approvePortfolioRequest(requestId) {
  const res = await fetchWithRetry(
    apiUrl(`/api/portfolio-access/talent/requests/${encodeURIComponent(requestId)}/approve`),
    { method: 'POST', headers: await jsonHeaders() },
    { retries: 1, delayMs: 800 }
  );
  return parseJsonOrThrow(res);
}

export async function declinePortfolioRequest(requestId) {
  const res = await fetchWithRetry(
    apiUrl(`/api/portfolio-access/talent/requests/${encodeURIComponent(requestId)}/decline`),
    { method: 'POST', headers: await jsonHeaders() },
    { retries: 1, delayMs: 800 }
  );
  return parseJsonOrThrow(res);
}

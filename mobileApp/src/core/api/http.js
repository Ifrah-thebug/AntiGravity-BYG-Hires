import { env } from '@/core/config/env';
import { supabase } from '@/core/api/supabase';

/** Same Express backend the web app uses (VITE_BACKEND_URL). */
export const API_BASE = env.backendUrl;

export function apiUrl(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export function isNetworkError(err) {
  const msg = String(err?.message || err || '');
  return /failed to fetch|networkerror|load failed|network request failed|aborted/i.test(msg);
}

/**
 * Reject after `ms` so a stalled mobile connection can't hang a screen forever.
 * The message matches isNetworkError(), so callers treat it like a dropped connection.
 */
export function withTimeout(promise, ms, message = 'Network request failed (timed out). Check your connection and try again.') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Bearer header from the current Supabase session; throws when signed out. */
export async function authHeaders(message = 'Please log in to continue.') {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error(message);
  return { Authorization: `Bearer ${token}` };
}

/** Bearer header when signed in, empty object otherwise. */
export async function optionalAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** Parse a JSON body without throwing on empty/invalid text. */
export async function readJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Invalid response from server.');
  }
}

/**
 * Parse JSON and throw an Error carrying status/code/retryable when !ok —
 * same error shape the web services expose.
 */
export async function parseJsonOrThrow(resp, fallbackMessage) {
  const data = await readJson(resp).catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || fallbackMessage || `Request failed (${resp.status})`);
    err.status = resp.status;
    err.code = data.code;
    err.retryable = data.retryable !== false;
    throw err;
  }
  return data;
}

export async function fetchWithRetry(url, options, { retries = 1, delayMs = 900 } = {}) {
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

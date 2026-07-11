import { supabase } from './supabase';

const API_BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001').replace(/\/$/, '');

function isNetworkError(err) {
  const msg = String(err?.message || err || '');
  return /failed to fetch|networkerror|load failed|network request failed|aborted/i.test(msg);
}

async function fetchWithRetry(url, options, { retries = 1, delayMs = 900 } = {}) {
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

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in to use BYG Guide.');
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

async function parseJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Invalid response from server.');
  }
}

export async function fetchTalentChatSession(currentPath = '') {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (currentPath) params.set('path', currentPath);
  const qs = params.toString();
  const resp = await fetch(`${API_BASE}/api/talent/chat/session${qs ? `?${qs}` : ''}`, { headers });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not load chat.');
  return data;
}

export async function sendTalentChatMessage(message, currentPath = '') {
  const headers = await getAuthHeaders();
  const resp = await fetchWithRetry(`${API_BASE}/api/talent/chat/message`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, path: currentPath }),
  }, { retries: 1 });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not send message.');
  return data;
}

export const QUICK_PROMPTS = [
  'What should I do next?',
  'Suggest pricing for my profile',
  'Why am I not in the directory yet?',
  'How do I get more client intros?',
];

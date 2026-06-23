import { supabase } from '../lib/supabase';

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

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

export async function fetchVoiceInterviewContext() {
  const res = await fetch(`${BASE}/api/voice-interview/context`, {
    headers: await authHeaders(),
  });
  return parseJson(res);
}

export async function fetchVoiceInterviewStatus() {
  const res = await fetch(`${BASE}/api/voice-interview/status`, {
    headers: await authHeaders(),
  });
  return parseJson(res);
}

export async function requestAiInterview({ talentId }) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/voice-interview/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ talentId }),
  });
  return parseJson(res);
}

export async function fetchClientAiInterviewStatus({ talentId, email }) {
  const params = new URLSearchParams({
    talentId,
    email: String(email || '').trim(),
  });
  const res = await fetch(`${BASE}/api/voice-interview/client-status?${params}`);
  return parseJson(res);
}

export async function fetchPublicAiInterviewBadges(talentIds) {
  if (!talentIds?.length) return {};
  const params = new URLSearchParams({
    talentIds: talentIds.join(','),
  });
  const res = await fetch(`${BASE}/api/voice-interview/public-badges?${params}`);
  const data = await parseJson(res);
  return data.badges || {};
}

import { supabase } from './supabase';

const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

async function parseJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Invalid response from server.');
  }
}

export async function verifyTalentActivationToken(token) {
  const resp = await fetch(
    `${API_BASE}/api/talent-invite/activate/verify?token=${encodeURIComponent(token)}`
  );
  const data = await parseJson(resp);
  return { ok: resp.ok && data.ok, data, status: resp.status };
}

export async function completeTalentActivation({ token, password }) {
  const resp = await fetch(`${API_BASE}/api/talent-invite/activate/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await parseJson(resp);
  if (!resp.ok) {
    const err = new Error(data.error || 'Activation failed.');
    err.code = data.code;
    throw err;
  }
  return data;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in.');
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function fetchInviteSetupStatus() {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE}/api/talent-invite/setup/status`, { headers });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not load setup status.');
  return data;
}

export async function parseInviteCvOnSetup() {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE}/api/talent-invite/setup/parse-cv`, {
    method: 'POST',
    headers,
  });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not parse CV.');
  return data;
}

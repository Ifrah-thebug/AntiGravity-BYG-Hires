const BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001').replace(/\/$/, '');

async function authHeaders() {
  const { supabase } = await import('./supabase');
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.code = data.code;
    throw err;
  }
  return data;
}

export async function verifyAmbassadorCode(code) {
  const res = await fetch(`${BASE}/api/ambassador/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return parseJson(res);
}

export async function claimAmbassadorCode({ code, name, email, password }) {
  const res = await fetch(`${BASE}/api/ambassador/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, name, email, password }),
  });
  return parseJson(res);
}

export async function fetchAmbassadorDashboard() {
  const res = await fetch(`${BASE}/api/ambassador/me`, {
    headers: await authHeaders(),
  });
  return parseJson(res);
}

export async function updateAmbassadorProfile({ name }) {
  const res = await fetch(`${BASE}/api/ambassador/me`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ name }),
  });
  return parseJson(res);
}

export async function updateAmbassadorInviteEmail(inviteId, { email, send = true }) {
  const res = await fetch(`${BASE}/api/ambassador/invites/${inviteId}/email`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ email, send }),
  });
  return parseJson(res);
}

export async function inviteTalentAsAmbassador({ email, name }) {
  const res = await fetch(`${BASE}/api/ambassador/invite`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ email, name }),
  });
  return parseJson(res);
}

export async function uploadTalentCvsAsAmbassador(files, { autoSend = true } = {}) {
  const { supabase } = await import('./supabase');
  const { data: { session } } = await supabase.auth.getSession();
  const form = new FormData();
  for (const file of files) form.append('cvs', file);
  form.append('autoSend', autoSend ? 'true' : 'false');

  const res = await fetch(`${BASE}/api/ambassador/upload-cvs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: form,
  });
  return parseJson(res);
}

export async function fetchIsAmbassador(userId) {
  if (!userId) return false;
  try {
    const res = await fetch(`${BASE}/api/ambassador/is-ambassador`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.isAmbassador);
  } catch {
    return false;
  }
}

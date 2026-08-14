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

export async function updateAmbassadorInvite(inviteId, { email, name, send = true }) {
  const body = { send };
  if (email !== undefined) body.email = email;
  if (name !== undefined) body.name = name;
  const res = await fetch(`${BASE}/api/ambassador/invites/${inviteId}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

/** @deprecated use updateAmbassadorInvite */
export async function updateAmbassadorInviteEmail(inviteId, { email, send = true }) {
  return updateAmbassadorInvite(inviteId, { email, send });
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
    const meta = await fetchAmbassadorMeta();
    return Boolean(meta.isAmbassador);
  } catch {
    return false;
  }
}

export async function fetchAmbassadorMeta() {
  try {
    const res = await fetch(`${BASE}/api/ambassador/is-ambassador`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return { isAmbassador: false, isInternal: false, kind: 'circle' };
    const data = await res.json();
    return {
      isAmbassador: Boolean(data.isAmbassador),
      isInternal: Boolean(data.isInternal),
      kind: data.kind || 'circle',
      code: data.code || null,
    };
  } catch {
    return { isAmbassador: false, isInternal: false, kind: 'circle' };
  }
}

export async function fetchAmbassadorReviews(status = 'pending_review') {
  const qs = new URLSearchParams({ status });
  const res = await fetch(`${BASE}/api/ambassador/reviews?${qs}`, {
    headers: await authHeaders(),
  });
  return parseJson(res);
}

export async function approveAmbassadorReview(profileKey) {
  const res = await fetch(`${BASE}/api/ambassador/reviews/${profileKey}/approve`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  return parseJson(res);
}

export async function requestAmbassadorReviewChanges(profileKey, { issues, notes }) {
  const res = await fetch(`${BASE}/api/ambassador/reviews/${profileKey}/request-changes`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ issues, notes }),
  });
  return parseJson(res);
}

export async function nudgeAmbassadorTalentSlots(profileKey) {
  const res = await fetch(`${BASE}/api/ambassador/reviews/${profileKey}/nudge-slots`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  return parseJson(res);
}

export async function fetchAmbassadorScreens() {
  const res = await fetch(`${BASE}/api/ambassador/screens`, {
    headers: await authHeaders(),
  });
  return parseJson(res);
}

export async function fetchAmbassadorScreenSlots(talentKey) {
  const res = await fetch(`${BASE}/api/ambassador/screens/${talentKey}/slots`, {
    headers: await authHeaders(),
  });
  return parseJson(res);
}

export async function bookAmbassadorScreen(talentKey, slotId) {
  const res = await fetch(`${BASE}/api/ambassador/screens/${talentKey}/book`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ slotId }),
  });
  return parseJson(res);
}

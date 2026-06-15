const API_BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001').replace(/\/$/, '');

async function parseJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Invalid response from server.');
  }
}

export async function requestPasswordReset(email) {
  const resp = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: String(email || '').trim() }),
  });
  const data = await parseJson(resp);
  if (!resp.ok) {
    throw new Error(data.error || 'Could not send reset link.');
  }
  return data;
}

export async function verifyPasswordResetToken(token) {
  const resp = await fetch(
    `${API_BASE}/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`
  );
  const data = await parseJson(resp);
  return { ok: resp.ok && data.ok, data, status: resp.status };
}

export async function completePasswordReset({ token, password }) {
  const resp = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await parseJson(resp);
  if (!resp.ok) {
    const err = new Error(data.error || 'Could not reset password.');
    err.code = data.code;
    throw err;
  }
  return data;
}

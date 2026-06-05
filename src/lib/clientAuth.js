const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

async function parseApiJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    return { error: 'Invalid response from server.' };
  }
}

/** True when this auth user has an activated row in public.clients. */
export async function fetchIsClient(userId) {
  const id = String(userId || '').trim();
  if (!id || !API_BASE) return false;
  try {
    const resp = await fetch(
      `${API_BASE}/api/client/dashboard/overview?userId=${encodeURIComponent(id)}`
    );
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Pre-login hint from email (clients table). Does not prove password ownership.
 * @returns {'client' | 'client_pending' | 'talent' | null}
 */
export async function fetchLoginRoleHint(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em || !em.includes('@') || !API_BASE) return null;
  try {
    const resp = await fetch(
      `${API_BASE}/api/client/role-hint?email=${encodeURIComponent(em)}`
    );
    if (!resp.ok) return null;
    const data = await parseApiJson(resp);
    return data.role || null;
  } catch {
    return null;
  }
}

export function loginHintMessage(role) {
  if (role === 'client') {
    return 'This email is registered as a hiring client. You will go to your client dashboard after sign-in.';
  }
  if (role === 'client_pending') {
    return 'This email has a pending client account. Use the activation link from your intro email before logging in.';
  }
  if (role === 'talent') {
    return 'This email is registered as talent. You will go to your talent portal or profile setup after sign-in.';
  }
  return '';
}

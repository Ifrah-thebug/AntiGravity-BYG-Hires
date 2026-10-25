/** Prefer same-origin /api in Vite so the proxy hits the backend. */
const API_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

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
  if (!id) return false;
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
 * Pre-login hint from email. Does not prove password ownership.
 * @returns {'client' | 'client_pending' | 'talent' | 'talent_pending' | 'unknown' | null}
 */
export async function fetchLoginRoleHint(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em || !em.includes('@')) return null;
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
    return 'This email is registered as a hiring client. After sign-in you’ll go to your client dashboard.';
  }
  if (role === 'client_pending') {
    return 'This email has a pending client account. Use the activation link from your intro email before logging in.';
  }
  if (role === 'talent') {
    return 'This email is registered as talent. After sign-in you’ll go to your talent portal or profile.';
  }
  if (role === 'talent_pending') {
    return 'This email started talent signup but the profile isn’t finished. Log in to continue setup, or use Forgot password if needed.';
  }
  if (role === 'unknown') {
    return 'This email is not registered. Create a talent account, or activate a client account from your intro/discovery email.';
  }
  return '';
}

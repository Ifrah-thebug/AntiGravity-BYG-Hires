import { apiUrl, readJson } from '@/core/api/http';

/**
 * Pre-login hint from email (clients table). Does not prove password ownership.
 * @returns {Promise<'client' | 'client_pending' | 'talent' | null>}
 */
export async function fetchLoginRoleHint(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em || !em.includes('@')) return null;
  try {
    const resp = await fetch(apiUrl(`/api/client/role-hint?email=${encodeURIComponent(em)}`));
    if (!resp.ok) return null;
    const data = await readJson(resp).catch(() => ({}));
    return data.role || null;
  } catch {
    return null;
  }
}

export function loginHintMessage(role) {
  if (role === 'client') {
    return 'This email is registered as a hiring client. Client dashboards are on the BYG Hires website.';
  }
  if (role === 'client_pending') {
    return 'This email has a pending client account. Use the activation link from your intro email before logging in.';
  }
  if (role === 'talent') {
    return 'This email is registered as talent. You will go to your talent portal or profile setup after sign-in.';
  }
  return '';
}

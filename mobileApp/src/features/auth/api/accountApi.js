import { supabase } from '@/core/api/supabase';
import { apiUrl, optionalAuthHeaders } from '@/core/api/http';

/** User-friendly auth / API errors */
export function formatAuthError(err) {
  if (!err) return 'Something went wrong. Please try again.';
  const code = err.code || '';
  const msg = err.message || '';

  if (code === 'user_already_exists' || /already registered/i.test(msg)) {
    return 'This email is already registered. Please log in instead.';
  }
  if (/email not confirmed/i.test(msg)) {
    return 'Please confirm your email first, then log in.';
  }
  if (/invalid login credentials/i.test(msg)) {
    return 'Invalid email or password.';
  }
  if (/row-level security/i.test(msg)) {
    return 'You do not have permission to do that. Please log in again and retry.';
  }
  return msg || 'Something went wrong. Please try again.';
}

/** Profile row or null (no throw on missing row) */
export async function fetchUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchIsAdmin() {
  const { data, error } = await supabase.rpc('is_admin_user');
  if (error) return false;
  return Boolean(data);
}

export async function fetchIsAmbassador(userId) {
  if (!userId) return false;
  try {
    const res = await fetch(apiUrl('/api/ambassador/is-ambassador'), {
      headers: { 'Content-Type': 'application/json', ...(await optionalAuthHeaders()) },
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return Boolean(data.isAmbassador);
  } catch {
    return false;
  }
}

/** True when this auth user has an activated row in public.clients (same check as web). */
export async function fetchIsClient(userId) {
  const id = String(userId || '').trim();
  if (!id) return false;
  try {
    const resp = await fetch(apiUrl(`/api/client/dashboard/overview?userId=${encodeURIComponent(id)}`));
    return resp.ok;
  } catch {
    return false;
  }
}

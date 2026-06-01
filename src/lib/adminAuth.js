import { supabase } from './supabase';
import { formatAuthError } from './talentAuth';

/** Emails allowed to use /admin/signup (keep in sync with admin_signup_allowlist in Supabase) */
export function getAdminSignupEmails() {
  const raw = import.meta.env.VITE_ADMIN_SIGNUP_EMAILS || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function canRegisterAsAdmin(email) {
  if (!email) return false;
  const allowed = getAdminSignupEmails();
  return allowed.length > 0 && allowed.includes(email.trim().toLowerCase());
}

export function adminSignupConfigured() {
  return getAdminSignupEmails().length > 0;
}

function isAlreadyRegisteredError(err) {
  const msg = err?.message || '';
  return /already registered|already exists|user_already_exists/i.test(msg);
}

/** Uses DB RPC so non-admins are not blocked by admins table RLS */
export async function fetchIsAdmin() {
  const { data, error } = await supabase.rpc('is_admin_user');
  if (error) throw error;
  return Boolean(data);
}

/** Create admins row via SECURITY DEFINER RPC (run while signed in) */
export async function registerAdminRecord() {
  const { error } = await supabase.rpc('register_admin_account');
  if (error) throw error;
}

/**
 * Sign up or sign in, then ensure admins row exists.
 * Handles: Auth user exists but admins insert failed earlier.
 */
export async function completeAdminSignup({ email, password, signUp, signIn }) {
  try {
    await signUp(email, password, { role: 'super_admin' });
  } catch (err) {
    if (!isAlreadyRegisteredError(err)) throw err;
    await signIn(email, password);
  }

  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { needsEmailConfirm: true };
  }

  if (!(await fetchIsAdmin())) {
    await registerAdminRecord();
  }

  return {
    needsEmailConfirm: !session,
    ok: true,
  };
}

/** After login: create admins row if allowlisted but missing (recovery path) */
export async function ensureAdminRecordIfAllowlisted(email) {
  if (!canRegisterAsAdmin(email)) return false;
  if (await fetchIsAdmin()) return true;
  await registerAdminRecord();
  return fetchIsAdmin();
}

export async function routeAfterAdminAuth(navigate) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    navigate('/admin/login');
    return;
  }
  const isAdmin = await fetchIsAdmin();
  if (!isAdmin) {
    await supabase.auth.signOut();
    navigate('/admin/login', {
      state: { error: 'This account is not a super admin. Complete signup or contact support.' },
    });
    return;
  }
  navigate('/admin/dashboard');
}

export { formatAuthError };

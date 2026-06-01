import { supabase } from './supabase';
import { loadPendingSetup, clearPendingSetup } from './talentStorage';

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
    return 'Permission denied. Check Supabase Storage and profiles policies.';
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

export function isProfileComplete(profile) {
  return Boolean(profile?.name?.trim() && profile?.job_title?.trim());
}

/**
 * After login: pending setup → setup page; no profile → setup; else portal.
 */
export async function routeAfterAuth(navigate) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    navigate('/talent/login');
    return;
  }

  const pending = loadPendingSetup();
  if (pending) {
    navigate('/talent/setup', {
      state: {
        userId: user.id,
        email: user.email,
        name: pending.name || user.user_metadata?.full_name || '',
        parsed: pending.parsed,
        photoUrl: pending.photoUrl || '',
        cvUrl: pending.cvUrl || '',
        resumeSetup: true,
        uploadWarnings: pending.uploadWarnings,
      },
    });
    return;
  }

  const profile = await fetchUserProfile(user.id);
  if (!isProfileComplete(profile)) {
    navigate('/talent/setup', {
      state: {
        userId: user.id,
        email: user.email,
        name: profile?.name || user.user_metadata?.full_name || '',
        parsed: profile
          ? {
              job_title: profile.job_title,
              about: profile.about,
              skills: profile.skills || [],
              experience_years: profile.experience_years,
            }
          : null,
        photoUrl: profile?.photo_url || '',
        cvUrl: profile?.cv_url || '',
        resumeSetup: true,
        incompleteProfile: true,
      },
    });
    return;
  }

  navigate('/portal');
}

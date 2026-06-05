import { supabase } from './supabase';
import { loadPendingSetup } from './talentStorage';
import { fetchIsAdmin } from './adminAuth';
import { fetchIsClient } from './clientAuth';

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
 * After login: admin → talent setup/portal → client dashboard.
 * Admin uses /admin/login separately; this path is for talent and clients.
 */
export async function routeAfterAuth(navigate) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    navigate('/login');
    return;
  }

  if (await fetchIsAdmin()) {
    navigate('/admin/dashboard');
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
  if (profile) {
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
                monthly_fee_usd: profile.monthly_fee_usd,
                availability: profile.availability,
                availability_from_month: profile.availability_from_month,
                role_type: profile.role_type,
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
    return;
  }

  if (await fetchIsClient(user.id)) {
    navigate('/client');
    return;
  }

  navigate('/talent/setup', {
    state: {
      userId: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || '',
      resumeSetup: true,
      incompleteProfile: true,
    },
  });
}

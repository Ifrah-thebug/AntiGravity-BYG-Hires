import { supabase } from '@/core/api/supabase';
import { isNetworkError } from '@/core/api/http';
import {
  fetchIsAdmin,
  fetchIsAmbassador,
  fetchIsClient,
  fetchUserProfile,
} from '@/features/auth/api/accountApi';
import { clearPendingSetup, loadPendingSetup } from '@/features/onboarding/storage/pendingSetup';
import { isProfileComplete } from '@/features/profile/utils/profileReview';
import { ROUTES } from './routes';

/** Routing could not finish because the device is offline (session kept, not signed out). */
export class OfflineError extends Error {
  constructor() {
    super('You appear to be offline.');
    this.name = 'OfflineError';
  }
}

/** True for errors that mean "no connection" rather than "not allowed / not found". */
export function isOfflineError(err) {
  return err instanceof OfflineError || err?.name === 'AuthRetryableFetchError' || isNetworkError(err);
}

function resetTo(navigation, name, params) {
  navigation.reset({ index: 0, routes: [{ name, params }] });
}

/** Setup params built from an existing (incomplete) profile row — same as web. */
export function setupParamsFromProfile(user, profile, extra = {}) {
  return {
    userId: user.id,
    email: user.email,
    name: profile?.name || user.user_metadata?.full_name || '',
    parsed: profile
      ? {
          job_title: profile.job_title,
          about: profile.about,
          skills: profile.skills || [],
          best_skill: profile.best_skill || profile.skills?.[0] || '',
          experience_years: profile.experience_years,
          monthly_fee_usd: profile.monthly_fee_usd,
          availability: profile.availability,
          availability_from_month: profile.availability_from_month,
          role_type: profile.role_type,
          department: profile.department,
        }
      : null,
    photoUrl: profile?.photo_url || '',
    cvUrl: profile?.cv_url || '',
    resumeSetup: true,
    incompleteProfile: true,
    ...extra,
  };
}

/**
 * After login: talent setup / portal. Client, admin and ambassador accounts use the web app.
 * Mirrors web `routeAfterAuth`.
 */
export async function routeAfterAuth(navigation) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) {
    // getUser() checks the token online: offline it fails while the session is still stored.
    if (error && isOfflineError(error)) {
      throw new OfflineError();
    }
    resetTo(navigation, ROUTES.Login);
    return;
  }

  // Independent lookups run in parallel (each is a network round trip); the decision order
  // below is unchanged: admin → ambassador → finished profile → draft → profile → client.
  const [isAdmin, isAmbassador, profile, pending] = await Promise.all([
    fetchIsAdmin(),
    fetchIsAmbassador(user.id),
    fetchUserProfile(user.id),
    loadPendingSetup(user.email),
  ]);

  if (isAdmin) {
    resetTo(navigation, ROUTES.NotTalent, { kind: 'admin' });
    return;
  }

  if (isAmbassador) {
    resetTo(navigation, ROUTES.NotTalent, { kind: 'ambassador' });
    return;
  }

  // A finished profile always wins over a leftover signup draft (e.g. setup done on the web).
  if (profile && isProfileComplete(profile)) {
    if (pending) await clearPendingSetup();
    resetTo(navigation, ROUTES.Portal);
    return;
  }

  if (pending) {
    resetTo(navigation, ROUTES.Setup, {
      userId: user.id,
      email: user.email,
      name: pending.name || user.user_metadata?.full_name || '',
      parsed: pending.parsed,
      photoUrl: pending.photoUrl || '',
      cvUrl: pending.cvUrl || '',
      cvFile: pending.cvFile || null,
      photoFile: pending.photoFile || null,
      resumeSetup: true,
      uploadWarnings: pending.uploadWarnings,
      ambassadorId: pending.ambassadorId || null,
    });
    return;
  }

  if (profile) {
    resetTo(navigation, ROUTES.Setup, setupParamsFromProfile(user, profile));
    return;
  }

  if (await fetchIsClient(user.id)) {
    resetTo(navigation, ROUTES.NotTalent, { kind: 'client' });
    return;
  }

  resetTo(navigation, ROUTES.Setup, setupParamsFromProfile(user, null));
}

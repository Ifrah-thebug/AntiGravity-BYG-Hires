import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUserProfile, isProfileComplete } from '../lib/talentAuth';
import { fetchIsAdmin } from '../lib/adminAuth';

/**
 * True when the current session is a talent with a complete portal profile
 * (not a client visitor and not an admin).
 */
export function useIsLoggedInTalent() {
  const { user, loading: authLoading } = useAuth();
  const [isLoggedInTalent, setIsLoggedInTalent] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (authLoading) return;
      if (!user?.id) {
        if (!cancelled) {
          setIsLoggedInTalent(false);
          setChecking(false);
        }
        return;
      }
      try {
        if (await fetchIsAdmin()) {
          if (!cancelled) {
            setIsLoggedInTalent(false);
            setChecking(false);
          }
          return;
        }
        const profile = await fetchUserProfile(user.id);
        if (!cancelled) {
          setIsLoggedInTalent(Boolean(profile && isProfileComplete(profile)));
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          setIsLoggedInTalent(false);
          setChecking(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return {
    isLoggedInTalent,
    loading: authLoading || checking,
  };
}

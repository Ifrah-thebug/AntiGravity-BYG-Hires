import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchIsAdmin } from '../lib/adminAuth';
import { fetchIsClient } from '../lib/clientAuth';
import { fetchUserProfile, ACCOUNT_PROFILE_UPDATED } from '../lib/talentAuth';
import { fetchIsAmbassador } from '../lib/ambassadorApi';
import { loadPendingSetup } from '../lib/talentStorage';

/**
 * @returns {'admin' | 'ambassador' | 'client' | 'talent' | 'guest' | 'loading'}
 */
export function useAccountType(user) {
  const { pathname } = useLocation();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [accountType, setAccountType] = useState(user ? 'loading' : 'guest');

  useEffect(() => {
    const onProfileUpdated = () => setRefreshNonce((n) => n + 1);
    window.addEventListener(ACCOUNT_PROFILE_UPDATED, onProfileUpdated);
    return () => window.removeEventListener(ACCOUNT_PROFILE_UPDATED, onProfileUpdated);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!user?.id) {
        setAccountType('guest');
        return;
      }

      setAccountType((prev) => (prev === 'guest' || prev === 'loading' ? 'loading' : prev));

      try {
        if (await fetchIsAdmin()) {
          if (!cancelled) setAccountType('admin');
          return;
        }
        if (await fetchIsAmbassador(user.id)) {
          if (!cancelled) setAccountType('ambassador');
          return;
        }
        if (loadPendingSetup()) {
          if (!cancelled) setAccountType('talent');
          return;
        }
        const profile = await fetchUserProfile(user.id);
        if (profile) {
          if (!cancelled) setAccountType('talent');
          return;
        }
        if (await fetchIsClient(user.id)) {
          if (!cancelled) setAccountType('client');
          return;
        }
        if (!cancelled) setAccountType('guest');
      } catch {
        if (!cancelled) setAccountType('guest');
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [user?.id, pathname, refreshNonce]);

  return accountType;
}

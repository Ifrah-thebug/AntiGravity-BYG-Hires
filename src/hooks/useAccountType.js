import { useEffect, useState } from 'react';
import { fetchIsAdmin } from '../lib/adminAuth';
import { fetchIsClient } from '../lib/clientAuth';
import { fetchUserProfile } from '../lib/talentAuth';
import { loadPendingSetup } from '../lib/talentStorage';

/**
 * @returns {'admin' | 'client' | 'talent' | 'guest' | 'loading'}
 */
export function useAccountType(user) {
  const [accountType, setAccountType] = useState(user ? 'loading' : 'guest');

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!user?.id) {
        setAccountType('guest');
        return;
      }

      setAccountType('loading');
      try {
        if (await fetchIsAdmin()) {
          if (!cancelled) setAccountType('admin');
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
  }, [user?.id]);

  return accountType;
}

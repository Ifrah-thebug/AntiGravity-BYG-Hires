import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BGuidesCommandType,
  dispatchBGuidesUiCommand,
  highlightDomSection,
  subscribeBGuidesUiCommands,
} from '../lib/bguidesUiCommands';
import { useAuth } from './AuthContext';
import { useAccountType } from '../hooks/useAccountType';

const BGuidesUiSyncContext = createContext(null);

/**
 * Global bridge: chat → page UI. Pages can also register local listeners
 * for directory filters / modals via subscribeBGuidesUiCommands.
 */
export function BGuidesUiSyncProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const accountType = useAccountType(user);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const userRole = useMemo(() => {
    if (!user?.id) return 'unauthenticated';
    if (accountType === 'loading') return 'loading';
    if (accountType === 'client') return 'client';
    if (accountType === 'talent') return 'talent';
    return 'unauthenticated';
  }, [user?.id, accountType]);

  const emit = useCallback((type, payload = {}) => {
    dispatchBGuidesUiCommand({ type, payload });
  }, []);

  useEffect(() => {
    return subscribeBGuidesUiCommands((detail) => {
      const { type, payload } = detail;

      if (type === BGuidesCommandType.NAVIGATE && payload?.href) {
        const rawHref = String(payload.href).trim();
        if (rawHref.startsWith('http')) {
          window.open(rawHref, '_blank', 'noopener,noreferrer');
          return;
        }
        const hashIndex = rawHref.indexOf('#');
        const pathPart = hashIndex >= 0 ? rawHref.slice(0, hashIndex) : rawHref;
        const hash = hashIndex >= 0 ? rawHref.slice(hashIndex) : '';
        const queryIndex = pathPart.indexOf('?');
        const pathname = (queryIndex >= 0 ? pathPart.slice(0, queryIndex) : pathPart) || location.pathname;
        const search = queryIndex >= 0 ? pathPart.slice(queryIndex) : '';
        navigateRef.current({ pathname, search, hash });
        if (hash) {
          const sectionId = hash.replace(/^#/, '');
          window.setTimeout(() => highlightDomSection(sectionId), pathname === location.pathname ? 120 : 400);
        }
        return;
      }

      if (type === BGuidesCommandType.SCROLL_TO || type === BGuidesCommandType.HIGHLIGHT_SECTION) {
        const sectionId = String(payload?.sectionId || payload?.id || '').replace(/^#/, '');
        if (!sectionId) return;
        const targetPath = payload?.pathname || null;
        if (targetPath && targetPath !== location.pathname) {
          navigateRef.current({
            pathname: targetPath,
            hash: `#${sectionId}`,
            search: payload?.search || '',
          });
          window.setTimeout(() => highlightDomSection(sectionId), 400);
        } else {
          highlightDomSection(sectionId);
        }
        return;
      }

      if (type === BGuidesCommandType.OPEN_BOOKING && payload?.talentId) {
        navigateRef.current(`/request-intro?id=${encodeURIComponent(payload.talentId)}`);
        return;
      }

      if (type === BGuidesCommandType.APPLY_DIRECTORY_FILTERS) {
        const next = new URLSearchParams();
        if (payload?.dept && payload.dept !== 'all') next.set('dept', String(payload.dept));
        if (payload?.q) next.set('q', String(payload.q));
        const search = next.toString() ? `?${next.toString()}` : '';
        if (location.pathname !== '/talent') {
          navigateRef.current(`/talent${search}`);
        } else if (search !== location.search) {
          navigateRef.current({ pathname: '/talent', search });
        }
        // Directory page also listens to apply availability / fee state.
      }
    });
  }, [location.pathname, location.search]);

  const value = useMemo(
    () => ({
      userRole,
      accountType,
      emit,
      BGuidesCommandType,
    }),
    [userRole, accountType, emit]
  );

  return (
    <BGuidesUiSyncContext.Provider value={value}>
      {children}
    </BGuidesUiSyncContext.Provider>
  );
}

export function useBGuidesUiSync() {
  const ctx = useContext(BGuidesUiSyncContext);
  if (!ctx) {
    throw new Error('useBGuidesUiSync must be used within BGuidesUiSyncProvider');
  }
  return ctx;
}

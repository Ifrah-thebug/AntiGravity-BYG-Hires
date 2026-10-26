import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/core/api/supabase';
import { clearPendingSetup } from '@/features/onboarding/storage/pendingSetup';

const AuthContext = createContext(null);

/** Same contract as the web AuthProvider: user, session, loading, signUp, signIn, signOut. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      setSession(initial);
      setUser(initial?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => {
    const signUp = async (email, password, metadata = {}) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      return data;
    };

    const signIn = async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    };

    const signOut = async () => {
      // Never leave a signup draft behind for the next account on this device.
      await clearPendingSetup();
      const { error } = await supabase.auth.signOut();
      // Offline / expired token: still drop the session stored on this device.
      if (error) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    };

    return { user, session, loading, signUp, signIn, signOut };
  }, [user, session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

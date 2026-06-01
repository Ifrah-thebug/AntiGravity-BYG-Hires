import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchIsAdmin } from '../lib/adminAuth';

const AdminRoute = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (authLoading) return;
      if (!user) {
        navigate('/admin/login');
        return;
      }
      try {
        const isAdmin = await fetchIsAdmin();
        if (cancelled) return;
        if (!isAdmin) {
          navigate('/admin/login', { state: { error: 'Super admin access required.' } });
          return;
        }
        setAllowed(true);
      } catch {
        if (!cancelled) {
          navigate('/admin/login', { state: { error: 'Could not verify admin access.' } });
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-red/20 border-t-red rounded-full animate-spin" />
      </div>
    );
  }

  if (!allowed) return null;
  return children;
};

export default AdminRoute;

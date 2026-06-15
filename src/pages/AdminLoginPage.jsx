import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, AlertTriangle, ArrowRight, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchIsAdmin,
  formatAuthError,
  adminSignupConfigured,
  ensureAdminRecordIfAllowlisted,
} from '../lib/adminAuth';
import logo from '../assets/BYG Hires Logo.png';

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signOut, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(location.state?.error || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    async function check() {
      if (!user) return;
      try {
        if (await fetchIsAdmin()) {
          navigate('/admin/dashboard', { replace: true });
        }
      } catch {
        /* ignore */
      }
    }
    check();
  }, [user, authLoading, navigate]);

  const handleInput = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(form.email, form.password);

      let isAdmin = await fetchIsAdmin();
      if (!isAdmin) {
        isAdmin = await ensureAdminRecordIfAllowlisted(form.email);
      }
      if (!isAdmin) {
        await signOut();
        setError(
          'This account is not a super admin yet. Use Register as admin or ask your team to run admins_complete_fix.sql.'
        );
        return;
      }
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen pt-20 pb-24 px-4 font-sans flex items-center justify-center">
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <img src={logo} alt="BYG Hires" className="h-10 w-auto mx-auto mb-6" />
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-3 flex items-center justify-center gap-1.5">
            <Shield size={12} /> Super Admin
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight mb-3">Admin sign in</h1>
          <p className="text-gray-500 text-sm font-medium">Access the internal operations dashboard.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-8 space-y-6"
        >
          {error && (
            <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Mail size={10} /> Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleInput}
                required
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock size={10} /> Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[10px] font-bold text-red uppercase tracking-widest hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleInput}
                required
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || authLoading}
              className="w-full py-4 bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'} <ArrowRight size={14} />
            </button>
          </form>

          {adminSignupConfigured() && (
            <p className="text-center text-[11px] text-gray-500 font-medium">
              First-time admin?{' '}
              <Link to="/admin/signup" className="text-red font-bold hover:underline">
                Register here
              </Link>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminLoginPage;

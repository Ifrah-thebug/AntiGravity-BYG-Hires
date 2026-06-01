import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertTriangle, ArrowRight, Shield, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  adminSignupConfigured,
  canRegisterAsAdmin,
  completeAdminSignup,
  formatAuthError,
  routeAfterAdminAuth,
} from '../lib/adminAuth';
import logo from '../assets/BYG Hires Logo.png';

const AdminSignupPage = () => {
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleInput = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!adminSignupConfigured()) {
      setError('Admin signup is not configured. Set VITE_ADMIN_SIGNUP_EMAILS.');
      return;
    }

    if (!canRegisterAsAdmin(form.email)) {
      setError('This email is not authorized for super admin registration.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await completeAdminSignup({
        email: form.email,
        password: form.password,
        signUp,
        signIn,
      });

      if (result.needsEmailConfirm) {
        setDone(true);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await routeAfterAdminAuth(navigate);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!adminSignupConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white font-sans">
        <p className="text-sm font-semibold text-gray-600 text-center max-w-sm">
          Admin signup is disabled. Configure <code className="font-mono text-xs">VITE_ADMIN_SIGNUP_EMAILS</code>{' '}
          and run <code className="font-mono text-xs">supabase/admins.sql</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pt-20 pb-24 px-4 font-sans flex items-center justify-center">
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <img src={logo} alt="BYG Hires" className="h-10 w-auto mx-auto mb-6" />
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-3 flex items-center justify-center gap-1.5">
            <Shield size={12} /> Super Admin
          </p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Create admin account</h1>
          <p className="text-gray-500 text-sm font-medium">
            Email must be on the admin allowlist (env + Supabase).
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-8 space-y-6"
        >
          {done ? (
            <div className="text-center space-y-4">
              <UserPlus size={40} className="text-green-600 mx-auto" />
              <p className="font-black text-green-800">Account created</p>
              <p className="text-sm text-gray-600 font-medium">
                Confirm your email if required, then{' '}
                <Link to="/admin/login" className="text-red font-bold hover:underline">
                  sign in
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email</label>
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
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleInput}
                    required
                    minLength={6}
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    name="confirm"
                    value={form.confirm}
                    onChange={handleInput}
                    required
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Register'} <ArrowRight size={14} />
                </button>
              </form>
              <p className="text-center text-[11px] text-gray-500">
                Already registered?{' '}
                <Link to="/admin/login" className="text-red font-bold hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminSignupPage;

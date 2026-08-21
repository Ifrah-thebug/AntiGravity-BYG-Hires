import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, KeyRound, Lock, Mail, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatAuthError, routeAfterAuth } from '../lib/talentAuth';
import { fetchLoginRoleHint, loginHintMessage } from '../lib/clientAuth';
import { adminSignupConfigured } from '../lib/adminAuth';
import { verifyAmbassadorCode } from '../lib/ambassadorApi';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [ambassadorCode, setAmbassadorCode] = useState('');
  const [error, setError] = useState('');
  const [ambassadorError, setAmbassadorError] = useState('');
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  const [loading, setLoading] = useState(false);
  const [ambassadorLoading, setAmbassadorLoading] = useState(false);
  const [roleHint, setRoleHint] = useState(null);
  const [hintLoading, setHintLoading] = useState(false);

  useEffect(() => {
    const em = form.email.trim().toLowerCase();
    if (!em || !em.includes('@')) {
      setRoleHint(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setHintLoading(true);
      const role = await fetchLoginRoleHint(em);
      setRoleHint(role);
      setHintLoading(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [form.email]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(form.email, form.password);
      await routeAfterAuth(navigate);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAmbassadorCode(e) {
    e.preventDefault();
    setAmbassadorError('');
    setAmbassadorLoading(true);
    try {
      const data = await verifyAmbassadorCode(ambassadorCode);
      navigate('/ambassador', {
        state: {
          code: ambassadorCode.trim().toUpperCase(),
          ambassador: data.ambassador,
          step: data.ambassador.needsClaim ? 'claim' : 'login',
        },
      });
    } catch (err) {
      setAmbassadorError(err.message || 'Invalid ambassador code.');
    } finally {
      setAmbassadorLoading(false);
    }
  }

  const hintText = loginHintMessage(roleHint);

  return (
    <div className="bg-white min-h-screen pt-20 pb-24 px-4 font-sans flex items-center justify-center">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight mb-3">
            Log in
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Clients and talent use the same sign-in — we route you to the right dashboard.
          </p>
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

          {successMessage && !error && (
            <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-2xl flex items-start gap-3 text-sm font-semibold">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{successMessage}</span>
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
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red outline-none"
                placeholder="you@company.com"
              />
              {hintLoading && (
                <p className="text-[11px] text-gray-400 font-medium">Checking account type…</p>
              )}
              {!hintLoading && hintText && (
                <p
                  className={`text-[11px] font-semibold leading-relaxed rounded-lg px-3 py-2 ${
                    roleHint === 'client_pending'
                      ? 'text-amber-800 bg-amber-50 border border-amber-200'
                      : 'text-gray-600 bg-gray-50 border border-gray-100'
                  }`}
                >
                  {hintText}
                </p>
              )}
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
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 bg-black text-white hover:bg-red transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Continue'}
              <ArrowRight size={14} />
            </button>
          </form>

          <div className="pt-4 border-t border-gray-100 space-y-2 text-center text-xs text-gray-500 font-medium">
            <p>
              Booked an intro?{' '}
              <span className="text-gray-700">Activate via the link in your email first.</span>
            </p>
            <p>
              Talent new here?{' '}
              <Link to="/talent/signup" className="text-red font-bold hover:underline">
                Join the Talent Pool
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Ambassador secret code — visible on login */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6 relative overflow-hidden rounded-[1.75rem] border border-black bg-[#0c0a0f] text-white p-6 sm:p-7 shadow-xl"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-red rounded-full blur-[70px] opacity-30 -mr-8 -mt-8 pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red mb-2 flex items-center gap-1.5">
              <Sparkles size={11} /> Ambassador access
            </p>
            <h2 className="text-lg font-black tracking-tight mb-1">Have a secret code?</h2>
            <p className="text-[12px] text-white/50 font-medium mb-4 leading-relaxed">
              First time? Enter your code below. Already claimed? Use email & password at the top of this page — you&apos;ll land in your hub automatically.
            </p>
            <form onSubmit={handleAmbassadorCode} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <label className="sr-only" htmlFor="ambassador-code">Ambassador code</label>
                <div className="relative flex-1">
                  <KeyRound size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    id="ambassador-code"
                    value={ambassadorCode}
                    onChange={(e) => setAmbassadorCode(e.target.value.toUpperCase())}
                    placeholder="BYG-STAR-01"
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/15 text-white font-black tracking-[0.15em] text-sm uppercase outline-none focus:border-red placeholder:text-white/25 placeholder:tracking-normal placeholder:font-semibold"
                  />
                </div>
                <button
                  type="submit"
                  disabled={ambassadorLoading || !ambassadorCode.trim()}
                  className="sm:w-auto px-5 py-3.5 rounded-xl bg-red hover:bg-white hover:text-black text-white font-black text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shrink-0"
                >
                  {ambassadorLoading ? 'Checking…' : 'Enter lounge'}
                  <ArrowRight size={13} />
                </button>
              </div>
              {ambassadorError && (
                <p className="text-[11px] font-semibold text-red bg-red/10 border border-red/20 rounded-xl px-3 py-2">
                  {ambassadorError}
                </p>
              )}
              <p className="text-[11px] text-white/40 font-medium">
                Returning ambassador?{' '}
                <Link to="/ambassador" className="text-white font-bold hover:text-red underline-offset-2 hover:underline">
                  Open ambassador portal
                </Link>
                {' '}or use email & password above.
              </p>
            </form>
          </div>
        </motion.div>

        {adminSignupConfigured() && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 bg-gray-50 border border-gray-200 rounded-[1.5rem] p-6 space-y-3"
          >
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center flex items-center justify-center gap-1.5">
              <Shield size={11} className="text-red" /> BYG internal
            </p>
            <Link
              to="/admin/login"
              className="block w-full py-3.5 bg-black text-white text-center text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red transition-colors"
            >
              Log in as admin
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}

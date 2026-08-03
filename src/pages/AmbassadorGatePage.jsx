// Ambassador gate — unique code entry + claim / login (BYG light theme)
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, KeyRound, ArrowRight, Loader2, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { verifyAmbassadorCode, claimAmbassadorCode, fetchIsAmbassador } from '../lib/ambassadorApi';

const fieldClass =
  'w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-black outline-none focus:border-red placeholder:text-gray-400 placeholder:font-semibold';

export default function AmbassadorGatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};
  const { signIn, user } = useAuth();
  const [code, setCode] = useState(prefill.code || '');
  const [step, setStep] = useState(prefill.step || 'code');
  const [ambassador, setAmbassador] = useState(prefill.ambassador || null);
  const [name, setName] = useState(prefill.ambassador?.name || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!user?.id) return;
    (async () => {
      if (await fetchIsAmbassador(user.id)) navigate('/ambassador/hub', { replace: true });
    })();
  }, [user?.id, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await verifyAmbassadorCode(code);
      setAmbassador(data.ambassador);
      setName(data.ambassador.name || '');
      if (data.ambassador.needsClaim) setStep('claim');
      else setStep('login');
    } catch (err) {
      setError(err.message || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await claimAmbassadorCode({ code, name, email, password });
      await signIn(data.email, password);
      navigate('/ambassador/hub');
    } catch (err) {
      setError(err.message || 'Could not claim code.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      const ok = await fetchIsAmbassador();
      if (!ok) {
        setError('This account is not linked to that ambassador code.');
        return;
      }
      navigate('/ambassador/hub');
    } catch (err) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen pt-20 pb-24 px-4 font-sans flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 10% -10%, rgba(255,61,61,0.08), transparent 50%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(0,0,0,0.03), transparent 45%)',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-3 inline-flex items-center gap-1.5">
            <Sparkles size={11} /> Ambassador lounge
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight mb-3">
            Your secret door
          </h1>
          <p className="text-gray-500 text-sm font-medium leading-relaxed">
            Enter your unique code — invite talent, unlock LinkedIn branding tools, and track lifetime residual rewards.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-7 sm:p-8"
        >
          {ambassador?.code && step !== 'code' && (
            <div className="mb-5 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-red/5 border border-red/15">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Code</span>
              <span className="text-sm font-black text-red tracking-widest">{ambassador.code}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'code' && (
              <motion.form
                key="code"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleVerify}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <KeyRound size={10} /> Unique code
                  </label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="BYG-STAR-01"
                    className={`${fieldClass} text-center tracking-[0.18em] uppercase text-base`}
                    autoFocus
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="w-full py-4 rounded-2xl bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <>Continue <ArrowRight size={14} /></>}
                </button>
              </motion.form>
            )}

            {step === 'claim' && (
              <motion.form
                key="claim"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleClaim}
                className="space-y-4"
              >
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  Welcome, <span className="font-black text-black">{ambassador?.name || 'Ambassador'}</span>.
                  Create your account to claim this code.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <User size={10} /> Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className={fieldClass}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Mail size={10} /> Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className={fieldClass}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Lock size={10} /> Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={fieldClass}
                    minLength={8}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Claim & enter lounge'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('code'); setError(''); }}
                  className="w-full text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red transition-colors"
                >
                  Use a different code
                </button>
              </motion.form>
            )}

            {step === 'login' && (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  This code is already claimed. Sign in with your ambassador email and password.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Mail size={10} /> Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ambassador email"
                    className={fieldClass}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Lock size={10} /> Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={fieldClass}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Enter lounge'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('code'); setError(''); }}
                  className="w-full text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red transition-colors"
                >
                  Back
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-sm font-semibold text-red bg-red/5 border border-red/20 rounded-xl px-3 py-2.5"
            >
              {error}
            </motion.p>
          )}
        </motion.div>

        <p className="text-center mt-8 text-xs text-gray-500 font-medium">
          Not an ambassador?{' '}
          <Link to="/login" className="text-red font-bold hover:underline">
            Regular login
          </Link>
        </p>
      </div>
    </div>
  );
}

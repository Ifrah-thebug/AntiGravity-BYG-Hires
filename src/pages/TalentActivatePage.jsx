import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { verifyTalentActivationToken, completeTalentActivation } from '../lib/talentInvite';

export default function TalentActivatePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [verifyState, setVerifyState] = useState('loading');
  const [talentEmail, setTalentEmail] = useState('');
  const [talentName, setTalentName] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifyState('error');
      setVerifyError('Missing activation token. Check your email for the full link.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { ok, data } = await verifyTalentActivationToken(token);
        if (cancelled) return;

        if (!ok) {
          setVerifyState('error');
          setVerifyError(data.error || 'This activation link is not valid.');
          if (data.email) setTalentEmail(data.email);
          if (data.name) setTalentName(data.name);
          return;
        }

        setTalentEmail(data.email || '');
        setTalentName(data.name || '');
        setVerifyState('ready');
      } catch (err) {
        if (!cancelled) {
          setVerifyState('error');
          setVerifyError(err.message || 'Could not verify activation link.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await completeTalentActivation({ token, password });
      await signIn(data.email, password);
      setDone(true);
      setTimeout(() => {
        navigate('/talent/setup', {
          state: {
            inviteSetup: true,
            name: data.name,
            email: data.email,
            cvUrl: data.cvUrl,
          },
        });
      }, 1200);
    } catch (err) {
      setSubmitError(err.message || 'Could not activate account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white min-h-screen pt-20 pb-24 px-4 font-sans flex items-center justify-center">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-3">
            Talent Pool
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight mb-3">
            Activate your account
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Set a password to complete your BYG Hires talent profile.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-8"
        >
          {verifyState === 'loading' && (
            <p className="text-center text-sm font-bold text-gray-500">Verifying your link…</p>
          )}

          {verifyState === 'error' && (
            <div className="space-y-4 text-center">
              <AlertTriangle size={32} className="text-red mx-auto" />
              <p className="text-sm font-semibold text-gray-700">{verifyError}</p>
              {talentEmail && (
                <p className="text-xs text-gray-500">
                  Account: <span className="font-bold">{talentEmail}</span>
                </p>
              )}
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-black text-red hover:underline"
              >
                Go to login <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {done && (
            <div className="text-center space-y-3">
              <CheckCircle2 size={36} className="text-green-500 mx-auto" />
              <p className="font-black text-gray-900">Account activated!</p>
              <p className="text-sm text-gray-500">Taking you to profile setup…</p>
            </div>
          )}

          {verifyState === 'ready' && !done && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-left">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  Account
                </p>
                <p className="text-sm font-black text-gray-900">{talentName || 'Talent'}</p>
                <p className="text-xs text-gray-500 font-semibold flex items-center gap-1 mt-1">
                  <Mail size={12} /> {talentEmail}
                </p>
              </div>

              {submitError && (
                <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock size={10} /> New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red outline-none"
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock size={10} /> Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red outline-none"
                  placeholder="Repeat password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 bg-black text-white hover:bg-red transition-colors disabled:opacity-60"
              >
                {submitting ? 'Activating…' : 'Activate & continue'}
                <ArrowRight size={14} />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}

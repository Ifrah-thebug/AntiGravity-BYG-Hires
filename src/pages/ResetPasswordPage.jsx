import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import PasswordPeekBuddy from '../components/PasswordPeekBuddy';
import { verifyPasswordResetToken, completePasswordReset } from '../lib/passwordReset';

function PasswordField({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  revealed,
  onToggleReveal,
  placeholder,
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
        <Lock size={10} /> {label}
      </label>
      <div className="relative">
        <input
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          minLength={8}
          required
          className="w-full px-4 py-3.5 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red focus:bg-white outline-none transition-all"
          placeholder={placeholder}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleReveal}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red transition-colors rounded-lg"
          aria-label={revealed ? 'Hide password' : 'Show password'}
        >
          {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [verifyState, setVerifyState] = useState('loading');
  const [accountEmail, setAccountEmail] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const buddyState = useMemo(() => {
    const field = focusedField || 'password';
    return {
      value: field === 'confirm' ? confirmPassword : password,
      revealed: field === 'confirm' ? showConfirm : showPassword,
    };
  }, [focusedField, password, confirmPassword, showPassword, showConfirm]);

  useEffect(() => {
    if (!token) {
      setVerifyState('error');
      setVerifyError('Missing reset token. Check your email for the full link.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { ok, data } = await verifyPasswordResetToken(token);
        if (cancelled) return;

        if (!ok) {
          setVerifyState('error');
          setVerifyError(data.error || 'This reset link is not valid.');
          if (data.email) setAccountEmail(data.email);
          return;
        }

        setAccountEmail(data.email || '');
        setVerifyState('ready');
      } catch (err) {
        if (!cancelled) {
          setVerifyState('error');
          setVerifyError(err.message || 'Could not verify reset link.');
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
      await completePasswordReset({ token, password });
      setDone(true);
      setTimeout(() => {
        navigate('/login', { replace: true, state: { message: 'Password updated. Please log in.' } });
      }, 1500);
    } catch (err) {
      setSubmitError(err.message || 'Could not reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative bg-white min-h-screen pt-20 pb-24 px-4 font-sans flex items-center justify-center overflow-hidden">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-24 -left-20 w-72 h-72 bg-red/10 rounded-full blur-[100px]"
        animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-3">
            Account
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight mb-3">
            Reset password
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Choose a new password for your account.
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
              {accountEmail && (
                <p className="text-xs text-gray-500">
                  Account: <span className="font-bold">{accountEmail}</span>
                </p>
              )}
              <div className="flex flex-col gap-2 items-center">
                <Link
                  to="/forgot-password"
                  className="inline-flex items-center gap-2 text-sm font-black text-red hover:underline"
                >
                  Request a new link <ArrowRight size={14} />
                </Link>
                <Link to="/login" className="text-xs font-bold text-gray-500 hover:text-black">
                  Back to login
                </Link>
              </div>
            </div>
          )}

          {done && (
            <div className="text-center space-y-3">
              <CheckCircle2 size={36} className="text-green-500 mx-auto" />
              <p className="font-black text-gray-900">Password updated!</p>
              <p className="text-sm text-gray-500">Taking you to login…</p>
            </div>
          )}

          {verifyState === 'ready' && !done && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-left">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  Account
                </p>
                <p className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                  <Mail size={12} /> {accountEmail}
                </p>
              </div>

              <PasswordPeekBuddy
                value={buddyState.value}
                revealed={buddyState.revealed}
              />

              {submitError && (
                <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <PasswordField
                label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField((f) => (f === 'password' ? null : f))}
                revealed={showPassword}
                onToggleReveal={() => setShowPassword((v) => !v)}
                placeholder="At least 8 characters"
              />

              <PasswordField
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField((f) => (f === 'confirm' ? null : f))}
                revealed={showConfirm}
                onToggleReveal={() => setShowConfirm((v) => !v)}
                placeholder="Repeat password"
              />

              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={!submitting ? { scale: 1.01 } : {}}
                whileTap={!submitting ? { scale: 0.99 } : {}}
                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 bg-black text-white hover:bg-red transition-colors disabled:opacity-60"
              >
                {submitting ? 'Updating…' : 'Update password'}
                <ArrowRight size={14} />
              </motion.button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}

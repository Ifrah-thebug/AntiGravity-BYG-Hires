import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Mail, Sparkles } from 'lucide-react';
import logo from '../assets/BYG Hires Logo.png';
import { requestPasswordReset } from '../lib/passwordReset';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send reset link.');
    } finally {
      setLoading(false);
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
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-20 -right-16 w-80 h-80 bg-red/5 rounded-full blur-[120px]"
        animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      />

      <div className="relative w-full max-w-md">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.45 }}
          className="text-center mb-10"
        >
          <motion.img
            src={logo}
            alt="BYG Hires"
            className="h-10 w-auto mx-auto mb-6"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          />
          <motion.p
            initial={{ opacity: 0, letterSpacing: '0.1em' }}
            animate={{ opacity: 1, letterSpacing: '0.2em' }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-red font-black text-[10px] uppercase mb-3"
          >
            Account
          </motion.p>
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight mb-3">
            Forgot password?
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Enter your email and we&apos;ll send a link to reset your password.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, type: 'spring', stiffness: 200, damping: 22 }}
          className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-8"
        >
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className="text-center space-y-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.05 }}
                >
                  <CheckCircle2 size={40} className="text-green-500 mx-auto" />
                </motion.div>
                <p className="text-sm font-semibold text-gray-700 leading-relaxed">
                  If an account exists for that email, we sent a password reset link.
                  Check your inbox and spam folder.
                </p>
                <p className="text-xs text-gray-500">
                  On iPhone, use <span className="font-bold">Open in Safari</span> if the link
                  does not load in Mail.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-black text-red hover:underline"
                >
                  Back to login <ArrowRight size={14} />
                </Link>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="space-y-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold"
                  >
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 280, damping: 22 }}
                  className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/80 px-4 py-3.5"
                >
                  <motion.div
                    aria-hidden
                    className="absolute -top-6 -right-6 w-20 h-20 bg-amber-200/30 rounded-full blur-2xl"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="relative flex items-start gap-2.5">
                    <motion.span
                      animate={{ rotate: [0, 8, -8, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="shrink-0 mt-0.5 text-amber-600"
                    >
                      <Sparkles size={16} />
                    </motion.span>
                    <p className="text-sm font-semibold text-amber-900 leading-relaxed">
                      If you have not activated your account, activate it first{' '}
                      <motion.span
                        className="inline-block"
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        :)
                      </motion.span>
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28 }}
                  className="space-y-1.5"
                >
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Mail size={10} /> Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red focus:bg-white outline-none transition-all"
                    placeholder="you@company.com"
                  />
                </motion.div>

                <motion.button
                  type="submit"
                  disabled={loading || !email.trim()}
                  whileHover={!loading && email.trim() ? { scale: 1.01 } : {}}
                  whileTap={!loading && email.trim() ? { scale: 0.99 } : {}}
                  className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 bg-black text-white hover:bg-red transition-colors disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                  <ArrowRight size={14} />
                </motion.button>

                <p className="text-center text-xs text-gray-500 font-medium pt-2">
                  <Link to="/login" className="text-red font-bold hover:underline">
                    Back to login
                  </Link>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

// src/pages/TalentLoginPage.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertTriangle, ArrowRight, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatAuthError, routeAfterAuth } from '../lib/talentAuth';
import { adminSignupConfigured } from '../lib/adminAuth';
import logo from '../assets/BYG Hires Logo.png';

const TalentLoginPage = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInput = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
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
  };

  return (
    <div className="bg-white min-h-screen pt-20 pb-24 px-4 font-sans flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo + Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <img src={logo} alt="BYG Hires" className="h-10 w-auto mx-auto mb-6" />
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-3">Talent Portal</p>
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight mb-3">
            Welcome back.
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Don't have a profile?{' '}
            <Link to="/talent/signup" className="text-red font-bold hover:underline">Join the Talent Pool</Link>
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-8 space-y-6"
        >
          {error && (
            <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Mail size={10} /> Email Address
              </label>
              <input
                type="email" name="email" value={form.email} onChange={handleInput}
                placeholder="maria@example.com"
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all placeholder:text-gray-400"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Lock size={10} /> Password
              </label>
              <input
                type="password" name="password" value={form.password} onChange={handleInput}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all placeholder:text-gray-400"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !form.email || !form.password}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                !loading && form.email && form.password
                  ? 'bg-black text-white hover:bg-red cursor-pointer shadow-lg'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? 'Signing in…' : 'Log In'} <ArrowRight size={14} />
            </button>
          </form>

          <div className="pt-4 border-t border-gray-100 text-center">
            <Link to="/talent/signup" className="text-xs text-gray-400 font-bold hover:text-black transition-colors uppercase tracking-widest">
              Create an account instead →
            </Link>
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
            <Link
              to="/admin/signup"
              className="block w-full py-3.5 bg-white border border-gray-200 text-center text-xs font-black uppercase tracking-widest rounded-xl text-gray-700 hover:border-red hover:text-red transition-colors"
            >
              Register as admin
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TalentLoginPage;

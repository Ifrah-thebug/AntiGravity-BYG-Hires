// src/pages/TalentSetupPage.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertTriangle, X, Plus, ArrowRight, Sparkles, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatAuthError } from '../lib/talentAuth';
import {
  clearPendingSetup,
  loadPendingSetup,
  uploadSignupFiles,
  uploadTalentFile,
} from '../lib/talentStorage';

const TalentSetupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();

  const stateData = location.state || {};
  const pending = loadPendingSetup();

  const initialParsed = stateData.parsed || pending?.parsed;
  const initialName = stateData.name || pending?.name || '';

  const [form, setForm] = useState({
    name: initialName,
    job_title: initialParsed?.job_title || '',
    about: initialParsed?.about || '',
    experience_years: initialParsed?.experience_years ?? 3,
    skills: initialParsed?.skills || [],
  });
  const [cvUrl, setCvUrl] = useState(stateData.cvUrl || pending?.cvUrl || '');
  const [photoUrl, setPhotoUrl] = useState(stateData.photoUrl || pending?.photoUrl || '');
  const [cvFile] = useState(stateData.cvFile || null);
  const [photoFile] = useState(stateData.photoFile || null);
  const [uploadWarnings, setUploadWarnings] = useState(
    stateData.uploadWarnings || pending?.uploadWarnings || []
  );
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);

  useEffect(() => {
    if (pending && !stateData.parsed) {
      setForm({
        name: pending.name || '',
        job_title: pending.parsed?.job_title || '',
        about: pending.parsed?.about || '',
        experience_years: pending.parsed?.experience_years ?? 3,
        skills: pending.parsed?.skills || [],
      });
      setPhotoUrl(pending.photoUrl || '');
      setCvUrl(pending.cvUrl || '');
      setUploadWarnings(pending.uploadWarnings || []);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const hasSetupData = Boolean(stateData.parsed || pending?.parsed || initialName);

    if (!session && !hasSetupData) {
      navigate('/talent/signup');
      return;
    }

    if (!session && hasSetupData) {
      setAwaitingEmailConfirm(true);
      return;
    }

    setAwaitingEmailConfirm(false);
  }, [authLoading, session, stateData.parsed, pending, initialName, navigate]);

  const handleInput = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && form.skills.length < 8 && !form.skills.includes(s)) {
      setForm(f => ({ ...f, skills: [...f.skills, s] }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill) => setForm(f => ({ ...f, skills: f.skills.filter(s => s !== skill) }));

  const ensureFileUrls = async (userId) => {
    let nextCv = cvUrl;
    let nextPhoto = photoUrl;
    const warnings = [...uploadWarnings];

    if (cvFile && !nextCv?.startsWith('http')) {
      try {
        nextCv = await uploadTalentFile(userId, cvFile, 'cv');
      } catch (e) {
        warnings.push(`CV upload: ${e.message}`);
      }
    }

    if (photoFile && !nextPhoto?.startsWith('http')) {
      try {
        nextPhoto = await uploadTalentFile(userId, photoFile, 'photo');
      } catch (e) {
        warnings.push(`Photo upload: ${e.message}`);
      }
    }

    if (!nextCv?.startsWith('http') && !nextPhoto?.startsWith('http') && cvFile && photoFile) {
      const result = await uploadSignupFiles(userId, cvFile, photoFile);
      if (result.cvUrl) nextCv = result.cvUrl;
      if (result.photoUrl) nextPhoto = result.photoUrl;
      warnings.push(...result.warnings);
    }

    setCvUrl(nextCv);
    setPhotoUrl(nextPhoto);
    setUploadWarnings(warnings);
    return { cvUrl: nextCv, photoUrl: nextPhoto, warnings };
  };

  const handleConfirm = async () => {
    setError('');
    if (!form.name || !form.job_title) {
      setError('Name and job title are required.');
      return;
    }

    setSaving(true);
    try {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!activeSession) {
        throw new Error(
          'No active session. Please confirm your email, then log in to save your profile.'
        );
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Authenticated user could not be found. Please try again.');

      const { cvUrl: finalCv, photoUrl: finalPhoto, warnings: fileWarnings } =
        await ensureFileUrls(authUser.id);

      const { error: dbErr } = await supabase.from('profiles').upsert({
        user_id: authUser.id,
        email: authUser.email,
        name: form.name.trim(),
        job_title: form.job_title.trim(),
        about: form.about.trim(),
        skills: form.skills,
        experience_years: Number(form.experience_years) || 0,
        photo_url: finalPhoto || '',
        cv_url: finalCv || '',
      }, { onConflict: 'user_id' });

      if (dbErr) throw dbErr;

      clearPendingSetup();
      navigate('/portal', {
        state: {
          justCreated: true,
          uploadWarnings: fileWarnings.length ? fileWarnings : undefined,
        },
      });
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSaving(false);
    }
  };

  const canConfirm = form.name && form.job_title && session && !awaitingEmailConfirm;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-red/20 border-t-red rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pt-28 pb-24 px-4 font-sans">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-black uppercase tracking-wider rounded-full mb-4">
            <Sparkles size={11} /> AI Parsed Your CV
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight mb-3">
            Review your<br /><span className="text-red">profile.</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium max-w-sm mx-auto">
            {stateData.incompleteProfile
              ? 'Finish setting up your profile so it appears when you log in.'
              : 'Correct anything that looks off, then confirm to save to your account.'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-[2rem] shadow-xl overflow-hidden"
        >
          <div className="p-8 md:p-10 space-y-7">
            {awaitingEmailConfirm && (
              <div className="p-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-start gap-3">
                <Mail size={18} className="shrink-0 mt-0.5" />
                <div className="text-sm font-semibold space-y-2">
                  <p className="font-black">Confirm your email first</p>
                  <p className="text-xs font-medium text-amber-800/90">
                    Your profile draft is saved. After confirming,{' '}
                    <Link to="/talent/login" className="text-red font-black hover:underline">log in</Link>{' '}
                    to complete setup.
                  </p>
                </div>
              </div>
            )}

            {uploadWarnings.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-semibold space-y-1">
                <p className="font-black uppercase tracking-wider text-[10px]">Upload notes</p>
                {uploadWarnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Full Name *</label>
              <input
                name="name" value={form.name} onChange={handleInput}
                disabled={awaitingEmailConfirm}
                className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Professional Title *</label>
              <input
                name="job_title" value={form.job_title} onChange={handleInput}
                disabled={awaitingEmailConfirm}
                className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">About</label>
              <textarea
                name="about" value={form.about} onChange={handleInput} rows={4}
                disabled={awaitingEmailConfirm}
                className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-red focus:bg-white outline-none transition-all resize-none disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Years of Experience</label>
              <input
                type="number" name="experience_years" min={0} max={50}
                value={form.experience_years} onChange={handleInput}
                disabled={awaitingEmailConfirm}
                className="block w-full max-w-[8rem] px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all disabled:opacity-60"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Skills ({form.skills.length}/8)
              </label>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {form.skills.map(skill => (
                  <span key={skill} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-[10px] font-black uppercase rounded-full">
                    {skill}
                    {!awaitingEmailConfirm && (
                      <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red">
                        <X size={9} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {!awaitingEmailConfirm && (
                <div className="flex gap-2">
                  <input
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    placeholder="Add a skill…"
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                  />
                  <button type="button" onClick={addSkill} disabled={!newSkill.trim() || form.skills.length >= 8}
                    className="px-4 py-2.5 bg-black text-white text-xs font-black rounded-xl disabled:opacity-40">
                    <Plus size={12} className="inline" /> Add
                  </button>
                </div>
              )}
            </div>

            {photoUrl && (
              <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <img src={photoUrl} alt="Profile" className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md" />
                <p className="text-xs font-black text-gray-800">Profile photo ready ✓</p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100 space-y-3">
              <button
                onClick={handleConfirm}
                disabled={saving || !canConfirm}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 ${
                  canConfirm && !saving ? 'bg-black text-white hover:bg-red shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Saving Profile…' : 'Confirm & Create Profile'} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TalentSetupPage;

// src/pages/TalentSetupPage.jsx
// Profile review + confirm step after signup + CV parsing
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, X, Plus, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const TalentSetupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const stateData = location.state || {};

  const [form, setForm] = useState({
    name: stateData.name || '',
    job_title: stateData.parsed?.job_title || '',
    about: stateData.parsed?.about || '',
    experience_years: stateData.parsed?.experience_years || 3,
    skills: stateData.parsed?.skills || [],
  });
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Redirect if no state data (e.g. direct URL access)
  useEffect(() => {
    if (!stateData.userId && !user) {
      navigate('/talent/signup');
    }
  }, [stateData.userId, user, navigate]);

  const handleInput = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && form.skills.length < 8 && !form.skills.includes(s)) {
      setForm(f => ({ ...f, skills: [...f.skills, s] }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill) => setForm(f => ({ ...f, skills: f.skills.filter(s => s !== skill) }));

  const handleConfirm = async () => {
    setError('');
    if (!form.name || !form.job_title) {
      setError('Name and job title are required.');
      return;
    }

    setSaving(true);
    try {
      // Check session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found. Please sign up or log in first to confirm authentication.');
      }

      // Explicitly get user details from session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Authenticated user could not be found. Please try again.');
      }

      const { error: dbErr } = await supabase.from('profiles').upsert({
        user_id: user.id,
        name: form.name.trim(),
        job_title: form.job_title.trim(),
        about: form.about.trim(),
        skills: form.skills,
        experience_years: Number(form.experience_years) || 0,
        photo_url: stateData.photoUrl || '',
        cv_url: stateData.cvUrl || '',
      }, { onConflict: 'user_id' });

      if (dbErr) throw dbErr;

      navigate('/portal', { state: { justCreated: true } });
    } catch (err) {
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white min-h-screen pt-28 pb-24 px-4 font-sans">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-black uppercase tracking-wider rounded-full mb-4">
            <Sparkles size={11} /> AI Parsed Your CV
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight mb-3">
            Review your<br /><span className="text-red">profile.</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium max-w-sm mx-auto">
            Gemini read your CV and filled in the fields below. Correct anything that looks off, then confirm.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-[2rem] shadow-xl overflow-hidden"
        >
          <div className="p-8 md:p-10 space-y-7">
            {error && (
              <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Full Name *</label>
              <input
                name="name" value={form.name} onChange={handleInput}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all"
                placeholder="Your full name"
              />
            </div>

            {/* Job Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Professional Title *</label>
              <input
                name="job_title" value={form.job_title} onChange={handleInput}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all"
                placeholder="e.g. Senior Operations Manager"
              />
            </div>

            {/* About */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">About (2–3 sentences)</label>
              <textarea
                name="about" value={form.about} onChange={handleInput} rows={4}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-red focus:bg-white outline-none transition-all resize-none leading-relaxed"
                placeholder="A short professional bio in third person…"
              />
            </div>

            {/* Experience Years */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Years of Experience</label>
              <input
                type="number" name="experience_years" min={0} max={50}
                value={form.experience_years} onChange={handleInput}
                className="w-40 px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all"
              />
            </div>

            {/* Skills */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Skills ({form.skills.length}/8)
              </label>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {form.skills.map(skill => (
                  <span key={skill} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-full">
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red transition-colors">
                      <X size={9} />
                    </button>
                  </span>
                ))}
                {form.skills.length === 0 && (
                  <p className="text-gray-400 text-xs font-medium">No skills yet — add some below.</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                  placeholder="Add a skill…"
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all"
                />
                <button
                  type="button" onClick={addSkill}
                  disabled={!newSkill.trim() || form.skills.length >= 8}
                  className="px-4 py-2.5 bg-black text-white text-xs font-black rounded-xl hover:bg-red transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>

            {/* Photo preview if available */}
            {stateData.photoUrl && (
              <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <img src={stateData.photoUrl} alt="Profile" className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md" />
                <div>
                  <p className="text-xs font-black text-gray-800">Profile photo uploaded ✓</p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">Stored securely in the talent files vault</p>
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <button
                onClick={handleConfirm}
                disabled={saving || !form.name || !form.job_title}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                  !saving && form.name && form.job_title
                    ? 'bg-black text-white hover:bg-red cursor-pointer shadow-lg'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Saving Profile…' : 'Confirm & Create Profile'} <ArrowRight size={14} />
              </button>
              <p className="text-center text-[10px] text-gray-400 font-medium">
                Your profile will be publicly visible in the BYG Hires talent directory.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TalentSetupPage;

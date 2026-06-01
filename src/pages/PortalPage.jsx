// src/pages/PortalPage.jsx
// Auth-gated profile management page at /portal
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LogOut, User, Save, AlertTriangle, CheckCircle2,
  X, Plus, ExternalLink, Camera
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { isProfileComplete } from '../lib/talentAuth';
import logo from '../assets/BYG Hires Logo.png';
import { processProfilePhoto, fileToDataUrl } from '../lib/processProfilePhoto';

const PortalPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: '', job_title: '', about: '', experience_years: 0, skills: [],
  });
  const [newSkill, setNewSkill] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saved' | 'error'
  const [error, setError] = useState('');
  const justCreated = location.state?.justCreated;
  const portalUploadWarnings = location.state?.uploadWarnings;

  // Guard: redirect to login if not authed
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/talent/login');
    }
  }, [authLoading, user, navigate]);

  // Load profile from Supabase
  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoadingProfile(true);
    setError('');
    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr) {
      setError(fetchErr.message);
      setLoadingProfile(false);
      return;
    }

    if (!data || !isProfileComplete(data)) {
      setLoadingProfile(false);
      navigate('/talent/setup', {
        state: {
          userId: user.id,
          email: user.email,
          name: data?.name || user.user_metadata?.full_name || '',
          parsed: data
            ? {
                job_title: data.job_title,
                about: data.about,
                skills: data.skills || [],
                experience_years: data.experience_years,
              }
            : null,
          photoUrl: data?.photo_url || '',
          cvUrl: data?.cv_url || '',
          incompleteProfile: true,
          resumeSetup: true,
        },
      });
      return;
    }

    setProfile(data);
    setForm({
      name: data.name || '',
      job_title: data.job_title || '',
      about: data.about || '',
      experience_years: data.experience_years || 0,
      skills: data.skills || [],
    });
    setPhotoPreview(data.photo_url || '');
    setLoadingProfile(false);
  };

  const handleInput = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && form.skills.length < 8 && !form.skills.includes(s)) {
      setForm(f => ({ ...f, skills: [...f.skills, s] }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill) => setForm(f => ({ ...f, skills: f.skills.filter(s => s !== skill) }));

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoProcessing(true);
    setError('');
    try {
      const processed = await processProfilePhoto(file);
      setPhotoFile(processed);
      const dataUrl = await fileToDataUrl(processed);
      setPhotoPreview(dataUrl);
    } catch (err) {
      setError(err.message || 'Could not process photo.');
    } finally {
      setPhotoProcessing(false);
    }
  };

  const uploadPhoto = async () => {
    if (!photoFile || !user) return null;
    setUploadingPhoto(true);
    const path = `${user.id}/photo.jpg`;
    const { error: upErr } = await supabase.storage.from('talent-files').upload(path, photoFile, {
      upsert: true,
      contentType: 'image/jpeg',
    });
    setUploadingPhoto(false);
    if (upErr) { setError('Photo upload failed: ' + upErr.message); return null; }
    const { data } = supabase.storage.from('talent-files').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    setError('');
    setSaveStatus('');
    if (!form.name || !form.job_title) { setError('Name and job title are required.'); return; }

    setSaving(true);
    try {
      let photoUrl = profile?.photo_url || '';
      if (photoFile) {
        const uploaded = await uploadPhoto();
        if (uploaded) photoUrl = uploaded;
      }

      const { error: dbErr } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          email: user.email,
          name: form.name.trim(),
          job_title: form.job_title.trim(),
          about: form.about.trim(),
          experience_years: Number(form.experience_years) || 0,
          skills: form.skills,
          photo_url: photoUrl,
          cv_url: profile?.cv_url || '',
        }, { onConflict: 'user_id' });

      if (dbErr) throw new Error(dbErr.message);
      await fetchProfile();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save.');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="bg-white min-h-screen pt-28 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red/20 border-t-red rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const initials = form.name
    ? form.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const hue = form.name ? (form.name.charCodeAt(0) * 37 + (form.name.charCodeAt(1) || 0) * 17) % 360 : 200;

  return (
    <div className="bg-white min-h-screen pt-24 pb-24 px-4 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ── Top Bar ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="BYG Hires" className="h-8 w-auto" />
            <div className="h-6 w-px bg-gray-200" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">My Portal</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-black text-gray-400 hover:text-red transition-colors uppercase tracking-widest"
          >
            <LogOut size={13} /> Log Out
          </button>
        </div>

        {/* ── Welcome Banner ── */}
        {portalUploadWarnings?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-semibold text-amber-900 space-y-1">
            <p className="font-black uppercase tracking-wider text-[10px]">Some files may need re-upload</p>
            {portalUploadWarnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        )}

        {justCreated && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4"
          >
            <CheckCircle2 size={24} className="text-green-600 shrink-0" />
            <div>
              <p className="font-black text-green-800 text-sm">Profile created! Welcome to the talent pool.</p>
              <p className="text-green-600 text-xs font-medium mt-0.5">
                Your profile is now live at{' '}
                {profile?.id && (
                  <Link to={`/talent/${profile.id}`} className="underline font-bold">
                    /talent/{profile.id}
                  </Link>
                )}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Header Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-black text-white rounded-[2rem] p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-red rounded-full blur-[120px] opacity-20 -mr-20 -mt-20 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-6">
            {/* Photo */}
            <div className="relative shrink-0">
              {photoPreview ? (
                <img src={photoPreview} alt={form.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-xl" />
              ) : (
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-black text-2xl border-2 border-white/20"
                  style={{ background: `linear-gradient(135deg, hsl(${hue},55%,42%), hsl(${hue + 40},60%,32%))` }}
                >
                  {initials}
                </div>
              )}
              <label className={`absolute -bottom-2 -right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-200 transition-colors ${photoProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:bg-gray-100'}`}>
                <Camera size={12} className="text-black" />
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={photoProcessing} />
              </label>
              {photoProcessing && (
                <p className="absolute -bottom-8 left-0 right-0 text-center text-[9px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Processing…
                </p>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Logged in as</p>
              <h2 className="text-xl font-black text-white truncate">{form.name || user.email}</h2>
              <p className="text-red font-bold text-sm mt-0.5">{form.job_title || 'No title set yet'}</p>
            </div>

            {profile?.id && (
              <Link
                to={`/talent/${profile.id}`}
                target="_blank"
                className="shrink-0 flex items-center gap-1.5 text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-widest transition-colors"
              >
                View Public Profile <ExternalLink size={10} />
              </Link>
            )}
          </div>
        </motion.div>

        {/* ── Edit Form ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-[2rem] p-8 space-y-7"
        >
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Edit Profile</h3>

          {error && (
            <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {saveStatus === 'saved' && (
            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl flex items-center gap-3 text-sm font-bold">
              <CheckCircle2 size={16} /> Profile saved successfully!
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Full Name *</label>
            <input name="name" value={form.name} onChange={handleInput}
              className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all" />
          </div>

          {/* Job Title */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Professional Title *</label>
            <input name="job_title" value={form.job_title} onChange={handleInput}
              className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all" />
          </div>

          {/* About */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">About</label>
            <textarea name="about" value={form.about} onChange={handleInput} rows={4}
              className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-red focus:bg-white outline-none transition-all resize-none leading-relaxed" />
          </div>

          {/* Experience */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Years of Experience</label>
            <input type="number" name="experience_years" min={0} max={50} value={form.experience_years} onChange={handleInput}
              className="block w-full max-w-[8rem] px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all" />
          </div>

          {/* Skills */}
          <div className="space-y-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Skills ({form.skills.length}/8)</label>
            <div className="flex flex-wrap gap-2 min-h-[36px]">
              {form.skills.map(skill => (
                <span key={skill} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-full">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red transition-colors">
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newSkill} onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                placeholder="Add a skill…"
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all" />
              <button type="button" onClick={addSkill} disabled={!newSkill.trim() || form.skills.length >= 8}
                className="px-4 py-2.5 bg-black text-white text-xs font-black rounded-xl hover:bg-red transition-colors disabled:opacity-40 flex items-center gap-1">
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          {/* Photo upload hint */}
          {photoProcessing && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600 font-bold">
              <div className="w-5 h-5 border-2 border-red/20 border-t-red rounded-full animate-spin shrink-0" />
              Formatting passport-style photo…
            </div>
          )}

          {photoFile && !photoProcessing && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700 font-bold">
              <Camera size={16} className="shrink-0" />
              New passport photo will upload when you save.
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || uploadingPhoto || photoProcessing}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              !saving && !uploadingPhoto && !photoProcessing
                ? 'bg-black text-white hover:bg-red cursor-pointer shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {photoProcessing ? 'Processing photo…' : uploadingPhoto ? 'Uploading photo…' : saving ? 'Saving…' : 'Save Changes'}
            {!saving && !uploadingPhoto && !photoProcessing && <Save size={14} />}
          </button>
        </motion.div>

        {/* ── Quick links ── */}
        <div className="flex gap-4 flex-wrap">
          {profile?.id && (
            <Link to={`/talent/${profile.id}`} className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-black transition-colors uppercase tracking-widest">
              <ExternalLink size={12} /> View Public Profile
            </Link>
          )}
          <Link to="/talent" className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-black transition-colors uppercase tracking-widest">
            ← Talent Directory
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PortalPage;

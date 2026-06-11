// src/pages/PortalPage.jsx
// Auth-gated profile management page at /portal
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Save, AlertTriangle, CheckCircle2,
  ExternalLink, Camera, Award, TrendingUp, ClipboardCheck,
  Sparkles, ArrowRight, Calendar, Video, Check,
} from 'lucide-react';
import ProfileSkillsEditor from '../components/ProfileSkillsEditor';
import TalentIntroAvailability from '../components/TalentIntroAvailability';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { isProfileComplete, fetchUserProfile } from '../lib/talentAuth';
import { fetchIsAdmin } from '../lib/adminAuth';
import { fetchIsClient } from '../lib/clientAuth';
import { processProfilePhotoWithAI, fileToDataUrl } from '../lib/processProfilePhoto';
import { normalizeProfileName } from '../lib/formatDisplayName';
import {
  PROFILE_CONTENT_HINT,
  AVAILABILITY_OPTIONS,
  ROLE_TYPE_OPTIONS,
  DEFAULT_MONTHLY_FEE_USD,
  prepareProfileForSave,
  formatProfileValidationErrors,
  validateProfileFields,
} from '../lib/profileContentPolicy';
import {
  TALENT_DEPARTMENTS,
  normalizeTalentDepartment,
  DEFAULT_TALENT_DEPARTMENT,
} from '../lib/talentDepartments';

function ActionIconWithCheck({ icon: Icon, done }) {
  return (
    <div className="relative w-10 h-10 rounded-xl bg-red/10 text-red flex items-center justify-center shrink-0">
      <Icon size={18} strokeWidth={2.25} />
      {done && (
        <span
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black border-2 border-white flex items-center justify-center"
          aria-label="Completed"
        >
          <Check size={11} className="text-white" strokeWidth={3} />
        </span>
      )}
    </div>
  );
}

function buildStrengthenTiles({ connectCalendarUrl, calendarConnected, introSlotsPublished }) {
  const tiles = [
    {
      id: 'assessment',
      label: 'Take skills assessment',
      description: 'Prove your skills with a real-world task (~25 min).',
      href: '/assessment/coming-soon',
      icon: ClipboardCheck,
      done: false,
    },
  ];

  if (connectCalendarUrl) {
    tiles.push({
      id: 'calendar',
      label: 'Connect your calendar',
      description: 'Sync Cal.com so HR can book intro interviews when clients request you.',
      href: connectCalendarUrl,
      external: true,
      icon: Calendar,
      done: calendarConnected,
    });
  }

  tiles.push({
    id: 'intro',
    label: 'Client intro scheduling',
    description: 'Jump to available slots and upcoming intro calls on this page.',
    onClick: scrollToClientIntroSection,
    icon: Video,
    done: introSlotsPublished,
  });

  return tiles;
}

function scrollToClientIntroSection() {
  const el = document.getElementById('client-intro-scheduling');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', '#client-intro-scheduling');
}

function StrengthenProfilePanel({
  connectCalendarUrl,
  calendarConnected,
  introSlotsPublished,
}) {
  const tiles = buildStrengthenTiles({
    connectCalendarUrl,
    calendarConnected,
    introSlotsPublished,
  });

  const tileClassName =
    'block w-full text-left rounded-2xl border-2 border-white p-4 transition-all bg-white hover:bg-gray-50 shadow-md';

  const renderTileInner = (tile) => (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <ActionIconWithCheck icon={tile.icon} done={tile.done} />
        <div className="min-w-0">
          <p className="font-black text-sm text-gray-900">{tile.label}</p>
          <p className="text-[11px] font-medium text-gray-600 mt-1 leading-snug">
            {tile.description}
          </p>
        </div>
      </div>
      <ArrowRight size={16} className="shrink-0 mt-1 text-red" />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-red border border-red rounded-[2rem] p-8 lg:sticky lg:top-28 space-y-6"
    >
      <div>
        <p className="text-white font-black text-[10px] uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
          <Sparkles size={11} /> Grow your presence
        </p>
        <h3 className="text-2xl font-black tracking-tight text-white leading-tight">
          Strengthen your profile
        </h3>
        <p className="text-white text-sm font-semibold mt-3 leading-relaxed">
          Complete your assessment and connect your calendar. Then publish intro availability for
          clients.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {tiles.map((tile) => {
          if (tile.external) {
            return (
              <a key={tile.id} href={tile.href} className={tileClassName}>
                {renderTileInner(tile)}
              </a>
            );
          }
          if (tile.onClick) {
            return (
              <button key={tile.id} type="button" onClick={tile.onClick} className={tileClassName}>
                {renderTileInner(tile)}
              </button>
            );
          }
          return (
            <Link key={tile.id} to={tile.href} className={tileClassName}>
              {renderTileInner(tile)}
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl bg-black border border-black p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red text-white flex items-center justify-center shrink-0">
            <Award size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">Why it matters</p>
            <p className="text-xs font-semibold text-white leading-relaxed mt-1">
              Assessed talent is featured more prominently and stands out in client searches.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-wider">
          <TrendingUp size={12} className="text-white" />
          Complete assessment (Phase 2) → stronger visibility
        </div>
      </div>
    </motion.div>
  );
}

const PortalPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: '',
    job_title: '',
    about: '',
    experience_years: 0,
    monthly_fee_usd: DEFAULT_MONTHLY_FEE_USD,
    availability: 'immediate',
    availability_from_month: '',
    role_type: 'flexible',
    department: DEFAULT_TALENT_DEPARTMENT,
    skills: [],
    best_skill: '',
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
  const [introSlotsPublished, setIntroSlotsPublished] = useState(false);
  const justCreated = location.state?.justCreated;
  const portalUploadWarnings = location.state?.uploadWarnings;

  // Guard: clients → client dashboard; admins → admin; guests → login
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      if (await fetchIsAdmin()) {
        navigate('/admin/dashboard', { replace: true });
        return;
      }
      if (await fetchIsClient(user.id)) {
        const profile = await fetchUserProfile(user.id);
        if (!profile) {
          navigate('/client', { replace: true });
        }
      }
    })();
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  // Load profile from Supabase
  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  // Refresh profile after Cal.com OAuth redirect (?cal=connected)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('cal') === 'connected' && user) {
      fetchProfile();
    }
  }, [location.search, user]);

  // Deep link: /portal#client-intro-scheduling
  useEffect(() => {
    if (loadingProfile) return;
    if (location.hash === '#client-intro-scheduling') {
      requestAnimationFrame(() => scrollToClientIntroSection());
    }
  }, [loadingProfile, location.hash]);

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
          name: normalizeProfileName(data?.name || user.user_metadata?.full_name || ''),
          parsed: data
            ? {
                job_title: data.job_title,
                about: data.about,
                skills: data.skills || [],
                best_skill: data.best_skill || data.skills?.[0] || '',
                experience_years: data.experience_years,
                monthly_fee_usd: data.monthly_fee_usd,
                availability: data.availability,
                availability_from_month: data.availability_from_month,
                role_type: data.role_type,
                department: data.department,
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

    const talentId = data.id;
    if (talentId) {
      const { data: slots } = await supabase
        .from('talent_intro_slots')
        .select('id')
        .eq('talent_id', talentId)
        .in('status', ['open', 'held'])
        .limit(1);
      setIntroSlotsPublished(Boolean(slots?.length));
    } else {
      setIntroSlotsPublished(false);
    }

    const availabilityRaw = String(data.availability || '');
    const availabilityDate = /^\d{4}-\d{2}-\d{2}$/.test(availabilityRaw) ? availabilityRaw : '';
    setForm({
      name: normalizeProfileName(data.name || ''),
      job_title: data.job_title || '',
      about: data.about || '',
      experience_years: data.experience_years || 0,
      monthly_fee_usd: data.monthly_fee_usd ?? DEFAULT_MONTHLY_FEE_USD,
      availability: availabilityDate ? 'from_month' : (data.availability || 'immediate'),
      availability_from_month: availabilityDate,
      role_type: data.role_type || 'flexible',
      department: normalizeTalentDepartment(data.department),
      skills: data.skills || [],
      best_skill: data.best_skill || data.skills?.[0] || '',
    });
    setPhotoPreview(data.photo_url || '');
    setLoadingProfile(false);
  };

  const handleInput = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleNameBlur = () => {
    setForm((f) => ({ ...f, name: normalizeProfileName(f.name) }));
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s) return;
    const skillErrors = validateProfileFields({ name: '', job_title: '', about: '', skills: [s] });
    if (skillErrors.length) {
      setError(skillErrors[0]);
      return;
    }
    if (form.skills.length < 8 && !form.skills.includes(s)) {
      setForm((f) => ({
        ...f,
        skills: [...f.skills, s],
        best_skill: f.best_skill || s,
      }));
      setNewSkill('');
      setError('');
    }
  };

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
    const prepared = prepareProfileForSave(form);
    if (!prepared.ok) {
      setError(formatProfileValidationErrors(prepared.errors));
      setSaveStatus('error');
      return;
    }

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
          name: prepared.data.name,
          job_title: prepared.data.job_title,
          about: prepared.data.about,
          experience_years: prepared.data.experience_years,
          monthly_fee_usd: prepared.data.monthly_fee_usd,
          directory_fee_usd: prepared.data.directory_fee_usd,
          availability: prepared.data.availability,
          role_type: prepared.data.role_type,
          department: prepared.data.department,
          skills: prepared.data.skills,
          best_skill: prepared.data.best_skill,
          photo_url: photoUrl,
          cv_url: profile?.cv_url || '',
        }, { onConflict: 'user_id' });

      if (dbErr) throw new Error(dbErr.message);

      setForm((f) => ({
        ...f,
        name: prepared.data.name,
        job_title: prepared.data.job_title,
        about: prepared.data.about,
          skills: prepared.data.skills,
          best_skill: prepared.data.best_skill,
          experience_years: prepared.data.experience_years,
        monthly_fee_usd: prepared.data.monthly_fee_usd,
        directory_fee_usd: prepared.data.directory_fee_usd,
        availability: prepared.data.availability,
        availability_from_month:
          prepared.data.availability && /^\d{4}-\d{2}-\d{2}$/.test(prepared.data.availability)
            ? prepared.data.availability
            : '',
        role_type: prepared.data.role_type,
        department: prepared.data.department,
      }));

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
      <div className="max-w-6xl mx-auto space-y-8">

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

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* ── Left: profile summary + edit ── */}
          <div className="lg:col-span-3 space-y-8">
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
                rel="noopener noreferrer"
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

          <p className="text-[11px] text-gray-500 font-medium leading-relaxed -mt-4">{PROFILE_CONTENT_HINT}</p>

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
            <input name="name" value={form.name} onChange={handleInput} onBlur={handleNameBlur}
              className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all" />
          </div>

          {/* Job Title */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Professional Title *</label>
            <input name="job_title" value={form.job_title} onChange={handleInput}
              className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Department</label>
            <select
              name="department"
              value={form.department}
              onChange={handleInput}
              className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all"
            >
              {TALENT_DEPARTMENTS.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.label}</option>
              ))}
            </select>
          </div>

          {/* About */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">About</label>
            <textarea name="about" value={form.about} onChange={handleInput} rows={4}
              placeholder="Professional summary only — no contact details."
              className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-red focus:bg-white outline-none transition-all resize-none leading-relaxed" />
          </div>

          {/* Experience */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Years of Experience</label>
            <input type="number" name="experience_years" min={0} max={50} value={form.experience_years} onChange={handleInput}
              className="block w-full max-w-[8rem] px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monthly Fee (USD)</label>
              <input
                type="number"
                name="monthly_fee_usd"
                min={0}
                step={50}
                value={form.monthly_fee_usd}
                onChange={handleInput}
                className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all"
              />
              <p className="text-[10px] text-gray-400 font-semibold">BYG Hires will add a 10% markup as platform fees.</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Availability</label>
              <select
                name="availability"
                value={form.availability}
                onChange={handleInput}
                className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all"
              >
                {AVAILABILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {form.availability === 'from_month' && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Available From (Date)</label>
              <input
                type="date"
                name="availability_from_month"
                value={String(form.availability_from_month || '').slice(0, 10)}
                onChange={handleInput}
                className="block w-full max-w-[14rem] px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Timing Preference</label>
            <select
              name="role_type"
              value={form.role_type}
              onChange={handleInput}
              className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all"
            >
              {ROLE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <ProfileSkillsEditor
            skills={form.skills}
            bestSkill={form.best_skill}
            onSkillsChange={(skills) => setForm((f) => ({ ...f, skills }))}
            onBestSkillChange={(best_skill) => setForm((f) => ({ ...f, best_skill }))}
            newSkill={newSkill}
            onNewSkillChange={setNewSkill}
            onAddSkill={addSkill}
          />

          {/* Photo upload hint */}
          {photoProcessing && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600 font-bold">
              <div className="w-5 h-5 border-2 border-red/20 border-t-red rounded-full animate-spin shrink-0" />
              Creating your professional photo…
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

        {/* ── Intro scheduling (availability + booked calls) ── */}
        <motion.div
          id="client-intro-scheduling"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="scroll-mt-28 bg-white border border-gray-200 rounded-[2rem] p-8 space-y-2"
        >
          <div className="mb-6">
            <p className="text-[10px] font-black text-red uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
              <Calendar size={11} /> Client intros
            </p>
            <h3 className="font-black text-lg text-gray-900 tracking-tight">Intro scheduling</h3>
            <p className="text-xs text-gray-500 font-medium mt-2 leading-relaxed max-w-xl">
              Publish when you are free for intro calls, and see confirmed bookings in one place — separate
              from profile setup on the right.
            </p>
          </div>
          <TalentIntroAvailability
            talentId={profile?.id || user?.id}
            calConnected={Boolean(profile?.cal_username)}
            connectCalendarUrl={
              user?.id
                ? `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}/api/cal/connect/start?talentId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email || '')}`
                : ''
            }
          />
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

          {/* ── Right: strengthen profile ── */}
          <div className="lg:col-span-2">
            <StrengthenProfilePanel
              connectCalendarUrl={
                user?.id
                  ? `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}/api/cal/connect/start?talentId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email || '')}`
                  : ''
              }
              calendarConnected={Boolean(profile?.cal_username)}
              introSlotsPublished={introSlotsPublished}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalPage;

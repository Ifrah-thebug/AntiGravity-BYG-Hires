// src/pages/TalentSetupPage.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Sparkles, Mail, Camera, CheckCircle2, X } from 'lucide-react';
import { useProfilePhotoUpload } from '../lib/useProfilePhotoUpload';
import ProfileSkillsEditor from '../components/ProfileSkillsEditor';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatAuthError, notifyAccountProfileUpdated } from '../lib/talentAuth';
import {
  clearPendingSetup,
  loadPendingSetup,
  uploadSignupFiles,
  uploadTalentFile,
} from '../lib/talentStorage';
import { normalizeProfileName } from '../lib/formatDisplayName';
import {
  PROFILE_CONTENT_HINT,
  AVAILABILITY_OPTIONS,
  ROLE_TYPE_OPTIONS,
  prepareProfileForSave,
  formatProfileValidationErrors,
  validateProfileFields,
  DEFAULT_MONTHLY_FEE_USD,
} from '../lib/profileContentPolicy';
import { fetchInviteSetupStatus, parseInviteCvOnSetup } from '../lib/talentInvite';
import CVShredderLoader from '../components/CVShredderLoader';
import {
  TALENT_DEPARTMENTS,
  normalizeTalentDepartment,
  DEFAULT_TALENT_DEPARTMENT,
} from '../lib/talentDepartments';

const TalentSetupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();

  const stateData = location.state || {};
  const pending = loadPendingSetup();

  const initialParsed = stateData.parsed || pending?.parsed;
  const initialName = stateData.name || pending?.name || '';
  const parsedAvailability = String(initialParsed?.availability || '');
  const initialAvailabilityDate = /^\d{4}-\d{2}-\d{2}$/.test(parsedAvailability)
    ? parsedAvailability
    : '';

  const [form, setForm] = useState({
    name: normalizeProfileName(initialName),
    job_title: initialParsed?.job_title || '',
    about: initialParsed?.about || '',
    experience_years: initialParsed?.experience_years ?? 3,
    monthly_fee_usd: initialParsed?.monthly_fee_usd ?? DEFAULT_MONTHLY_FEE_USD,
    availability: initialAvailabilityDate ? 'from_month' : (initialParsed?.availability || 'immediate'),
    availability_from_month: initialAvailabilityDate,
    role_type: initialParsed?.role_type || 'flexible',
    department: normalizeTalentDepartment(initialParsed?.department || DEFAULT_TALENT_DEPARTMENT),
    skills: initialParsed?.skills || [],
    best_skill: initialParsed?.best_skill || initialParsed?.skills?.[0] || '',
  });
  const [cvUrl, setCvUrl] = useState(stateData.cvUrl || pending?.cvUrl || '');
  const [photoUrl, setPhotoUrl] = useState(stateData.photoUrl || pending?.photoUrl || '');
  const [cvFile] = useState(stateData.cvFile || null);
  const [legacyPhotoFile] = useState(stateData.photoFile || null);
  const [uploadWarnings, setUploadWarnings] = useState(
    stateData.uploadWarnings || pending?.uploadWarnings || []
  );
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const {
    photoFile: uploadedPhotoFile,
    photoPreview,
    photoProcessing,
    photoProgress,
    photoEnhanceDebug,
    handlePhotoSelect,
    clearPhoto,
  } = useProfilePhotoUpload({ onError: setError, showEnhanceDebug: import.meta.env.DEV });
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);
  const [parsingInvite, setParsingInvite] = useState(false);
  const [inviteFlow, setInviteFlow] = useState(Boolean(stateData.inviteSetup));

  const applyParsedToForm = (parsed, nameOverride) => {
    if (!parsed) return;
    setForm((f) => ({
      ...f,
      name: normalizeProfileName(nameOverride || parsed.name || f.name),
      job_title: parsed.job_title || f.job_title,
      about: parsed.about || f.about,
      experience_years: parsed.experience_years ?? f.experience_years,
      skills: parsed.skills?.length ? parsed.skills : f.skills,
      best_skill: parsed.best_skill || parsed.skills?.[0] || f.best_skill,
      department: normalizeTalentDepartment(parsed.department || f.department),
    }));
  };

  useEffect(() => {
    if (pending && !stateData.parsed) {
      const pendingAvailability = String(pending.parsed?.availability || '');
      const pendingAvailabilityDate = /^\d{4}-\d{2}-\d{2}$/.test(pendingAvailability)
        ? pendingAvailability
        : '';
      setForm({
        name: normalizeProfileName(pending.name || ''),
        job_title: pending.parsed?.job_title || '',
        about: pending.parsed?.about || '',
        experience_years: pending.parsed?.experience_years ?? 3,
        monthly_fee_usd: pending.parsed?.monthly_fee_usd ?? DEFAULT_MONTHLY_FEE_USD,
        availability: pendingAvailabilityDate ? 'from_month' : (pending.parsed?.availability || 'immediate'),
        availability_from_month: pendingAvailabilityDate,
        role_type: pending.parsed?.role_type || 'flexible',
        department: normalizeTalentDepartment(pending.parsed?.department || DEFAULT_TALENT_DEPARTMENT),
        skills: pending.parsed?.skills || [],
        best_skill: pending.parsed?.best_skill || pending.parsed?.skills?.[0] || '',
      });
      setPhotoUrl(pending.photoUrl || '');
      setCvUrl(pending.cvUrl || '');
      setUploadWarnings(pending.uploadWarnings || []);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const hasSetupData = Boolean(
      stateData.parsed ||
        pending?.parsed ||
        initialName ||
        stateData.inviteSetup ||
        stateData.cvUrl
    );

    if (!session && !hasSetupData) {
      navigate('/talent/signup');
      return;
    }

    if (!session && hasSetupData) {
      setAwaitingEmailConfirm(true);
      return;
    }

    setAwaitingEmailConfirm(false);
  }, [authLoading, session, stateData.parsed, stateData.inviteSetup, stateData.cvUrl, pending, initialName, navigate]);

  useEffect(() => {
    if (authLoading || !session) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const status = await fetchInviteSetupStatus();
        if (cancelled || !status.hasInvite) return;

        setInviteFlow(true);
        if (status.cvUrl) setCvUrl(status.cvUrl);

        if (status.parseStatus === 'parsed' && status.parsed) {
          applyParsedToForm(status.parsed, status.name);
          return;
        }

        setParsingInvite(true);
        const result = await parseInviteCvOnSetup();
        if (cancelled) return;
        if (result.parsed) {
          applyParsedToForm(result.parsed, result.name || status.name);
        }
        if (result.cvUrl) setCvUrl(result.cvUrl);
      } catch (err) {
        if (!cancelled && inviteFlow) {
          setError(err.message || 'Could not parse your CV. Fill in your profile manually.');
        }
      } finally {
        if (!cancelled) setParsingInvite(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, session]);

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


  const activePhotoFile = uploadedPhotoFile || legacyPhotoFile;
  const hasProfilePhoto = Boolean(
    photoPreview ||
      activePhotoFile ||
      (photoUrl && (photoUrl.startsWith('http') || photoUrl.startsWith('data:')))
  );

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

    if (activePhotoFile && !nextPhoto?.startsWith('http')) {
      try {
        nextPhoto = await uploadTalentFile(userId, activePhotoFile, 'photo');
      } catch (e) {
        warnings.push(`Photo upload: ${e.message}`);
      }
    }

    if (!nextCv?.startsWith('http') && !nextPhoto?.startsWith('http') && cvFile && activePhotoFile) {
      const result = await uploadSignupFiles(userId, cvFile, activePhotoFile);
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
    if (!hasProfilePhoto) {
      setError('Please upload a profile photo before saving.');
      return;
    }
    const prepared = prepareProfileForSave(form);
    if (!prepared.ok) {
      setError(formatProfileValidationErrors(prepared.errors));
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
        name: prepared.data.name,
        job_title: prepared.data.job_title,
        about: prepared.data.about,
        skills: prepared.data.skills,
        best_skill: prepared.data.best_skill,
        experience_years: prepared.data.experience_years,
        monthly_fee_usd: prepared.data.monthly_fee_usd,
        directory_fee_usd: prepared.data.directory_fee_usd,
        availability: prepared.data.availability,
        role_type: prepared.data.role_type,
        department: prepared.data.department,
        photo_url: finalPhoto || '',
        cv_url: finalCv || '',
      }, { onConflict: 'user_id' });

      if (dbErr) throw dbErr;

      setForm((f) => ({
        ...f,
        name: prepared.data.name,
        job_title: prepared.data.job_title,
        about: prepared.data.about,
        skills: prepared.data.skills,
        best_skill: prepared.data.best_skill,
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

      clearPendingSetup();
      notifyAccountProfileUpdated();
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

  const canConfirm =
    form.name &&
    form.job_title &&
    session &&
    !awaitingEmailConfirm &&
    !parsingInvite &&
    !photoProcessing &&
    hasProfilePhoto;

  if (authLoading || parsingInvite) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
        {parsingInvite ? (
          <CVShredderLoader className="mb-6" label="Parsing your CV with AI" />
        ) : (
          <div className="w-10 h-10 border-4 border-red/20 border-t-red rounded-full animate-spin mb-4" />
        )}
        <p className="font-black text-gray-900 uppercase tracking-wider text-sm">
          {parsingInvite ? 'Parsing your CV with AI…' : 'Loading…'}
        </p>
        {parsingInvite && (
          <p className="text-gray-500 text-xs font-medium mt-2 max-w-xs">
            This may take a few seconds. We&apos;ll pre-fill your profile from the resume BYG uploaded.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pt-28 pb-24 px-4 font-sans">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-black uppercase tracking-wider rounded-full mb-4">
            <Sparkles size={11} /> {inviteFlow ? 'CV imported by BYG Hires' : 'AI Parsed Your CV'}
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

            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">{PROFILE_CONTENT_HINT}</p>

            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Profile Photo <span className="text-red">*</span>
              </label>
              {!photoPreview && !photoProcessing && !(photoUrl && !inviteFlow) ? (
                <label className="flex flex-col items-center justify-center min-h-[180px] border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-red hover:bg-gray-50 transition-all cursor-pointer group">
                  <Camera size={32} className="text-gray-400 mb-2 group-hover:text-red transition-colors" />
                  <p className="font-black text-xs text-gray-700 mb-1">Upload headshot</p>
                  <p className="text-[10px] text-gray-400 max-w-[280px]">
                    Front-facing photo (JPG, PNG, or HEIC). We&apos;ll crop and enhance it for your profile.
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    disabled={awaitingEmailConfirm}
                    className="hidden"
                  />
                </label>
              ) : photoProcessing ? (
                <div className="min-h-[180px] border border-gray-200 bg-gray-50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-10 h-10 border-4 border-red/20 border-t-red rounded-full animate-spin" />
                  <p className="font-black text-xs text-gray-700 uppercase tracking-wider">
                    {photoProgress || 'Processing photo…'}
                  </p>
                  <p className="text-[10px] text-gray-500 font-medium">Usually takes 15–40 seconds</p>
                </div>
              ) : photoPreview ? (
                <div className="min-h-[180px] border border-green-200 bg-green-50/40 rounded-2xl p-5 flex flex-col justify-between items-center text-center">
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-24 h-28 rounded-2xl object-cover object-top border-2 border-green-500 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={clearPhoto}
                      disabled={awaitingEmailConfirm}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-green-200 rounded-full flex items-center justify-center text-gray-400 hover:text-red transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-green-700 text-[9px] font-black uppercase tracking-wider border-t border-green-200 pt-3 mt-3 w-full justify-center">
                    <CheckCircle2 size={11} className="text-green-500" />
                    Professional photo ready
                  </div>
                  {import.meta.env.DEV && photoEnhanceDebug && (
                    <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mt-3 w-full font-mono leading-snug text-left">
                      {photoEnhanceDebug}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <img
                    src={photoUrl}
                    alt="Profile"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md"
                  />
                  <div>
                    <p className="text-xs font-black text-gray-800">Profile photo ready ✓</p>
                    <label className="text-[10px] font-bold text-red hover:underline cursor-pointer mt-1 inline-block">
                      Replace photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        disabled={awaitingEmailConfirm}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Full Name *</label>
              <input
                name="name" value={form.name} onChange={handleInput} onBlur={handleNameBlur}
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
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Department</label>
              <select
                name="department"
                value={form.department}
                onChange={handleInput}
                disabled={awaitingEmailConfirm}
                className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all disabled:opacity-60"
              >
                {TALENT_DEPARTMENTS.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 font-semibold">Suggested from your CV — change if needed.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">About</label>
              <textarea
                name="about" value={form.about} onChange={handleInput} rows={4}
                placeholder="Professional summary only — no contact details."
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

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monthly Fee (USD)</label>
                <input
                  type="number" name="monthly_fee_usd" min={0} step={50}
                  value={form.monthly_fee_usd} onChange={handleInput}
                  disabled={awaitingEmailConfirm}
                  className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all disabled:opacity-60"
                />
                <p className="text-[10px] text-gray-400 font-semibold">BYG Hires will add a 10% markup as platform fees.</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Availability</label>
                <select
                  name="availability"
                  value={form.availability}
                  onChange={handleInput}
                  disabled={awaitingEmailConfirm}
                  className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all disabled:opacity-60"
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
                  disabled={awaitingEmailConfirm}
                  className="block w-full max-w-[14rem] px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all disabled:opacity-60"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Timing Preference</label>
              <select
                name="role_type"
                value={form.role_type}
                onChange={handleInput}
                disabled={awaitingEmailConfirm}
                className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all disabled:opacity-60"
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
              disabled={awaitingEmailConfirm}
            />

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

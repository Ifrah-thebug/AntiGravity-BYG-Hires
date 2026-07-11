// src/pages/PortalPage.jsx
// Auth-gated profile management page at /portal
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Save, AlertTriangle, CheckCircle2,
  ExternalLink, Camera, Award, TrendingUp, ClipboardCheck,
  Sparkles, ArrowRight, Calendar, Video, Check, Mic, BookOpen,
} from 'lucide-react';
import ProfileSkillsEditor from '../components/ProfileSkillsEditor';
import PortalPortfolioEditor from '../components/PortalPortfolioEditor';
import TalentIntroAvailability from '../components/TalentIntroAvailability';
import TalentGuideModal, { TALENT_GUIDE_STORAGE_KEY } from '../components/TalentGuideModal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { isProfileComplete, fetchUserProfile } from '../lib/talentAuth';
import { fetchIsAdmin } from '../lib/adminAuth';
import { fetchIsClient } from '../lib/clientAuth';
import { useProfilePhotoUpload } from '../lib/useProfilePhotoUpload';
import ProfilePhotoGeneratingLoader from '../components/ProfilePhotoGeneratingLoader';
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
import { fetchAssessmentStatus } from '../services/assessmentService';
import { fetchVoiceInterviewStatus } from '../services/voiceInterviewService';
import { withPhotoCacheBust, photoUrlForDisplay } from '../lib/talentStorage';
import {
  canSubmitForReview,
  isDirectoryLive,
  submitProfileForReview,
  STATUS_LABELS,
  REVIEW_ISSUE_OPTIONS,
} from '../lib/profileReview';

const INTRO_API_BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001').replace(/\/$/, '');

async function fetchIntroSlotsPublished(talentId) {
  if (!talentId) return false;
  try {
    const resp = await fetch(`${INTRO_API_BASE}/api/intro/my-slots/${encodeURIComponent(talentId)}`);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return false;
    return (data.slots || []).some((s) => s.status === 'open' || s.status === 'held');
  } catch {
    return false;
  }
}

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

function buildStrengthenTiles({
  profileId,
  navigate,
  connectCalendarUrl,
  calendarConnected,
  introSlotsPublished,
  assessmentDone,
  interviewUnlocked,
  interviewCompleted,
}) {
  const tiles = [
    {
      id: 'portfolio',
      label: 'Build your portfolio',
      description: 'Add project chapters with cover images and live work links.',
      onClick: () => {
        if (profileId && navigate) {
          navigate(`/talent/${profileId}/portfolio?add=1#portfolio-editor`);
        } else {
          scrollToPortfolioSection({ openAdd: true });
        }
      },
      icon: BookOpen,
      done: false,
    },
    {
      id: 'assessment',
      label: 'Take skills test',
      description: 'Prove your skills with a focused test per skill (~25 min).',
      href: '/assessment',
      icon: ClipboardCheck,
      done: assessmentDone,
    },
  ];

  if (interviewUnlocked) {
    tiles.push({
      id: 'voice-interview',
      label: 'AI voice interview',
      description: assessmentDone
        ? 'A client requested this — speak with our AI interviewer (~15 min).'
        : 'Complete at least one skills test first, then take the AI interview.',
      href: '/interview',
      icon: Mic,
      done: interviewCompleted,
      disabled: !assessmentDone,
    });
  }

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

function scrollToPortfolioSection({ openAdd = false } = {}) {
  const el = document.getElementById('talent-portfolio');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const search = openAdd ? '?portfolio=add' : '';
  window.history.replaceState(null, '', `/portal${search}#talent-portfolio`);
  window.dispatchEvent(new CustomEvent('byg-portfolio-scroll', { detail: { openAdd } }));
}

function StrengthenProfilePanel({
  profileId,
  navigate,
  connectCalendarUrl,
  calendarConnected,
  introSlotsPublished,
  assessmentDone,
  interviewUnlocked,
  interviewCompleted,
  onOpenGuide,
}) {
  const tiles = buildStrengthenTiles({
    profileId,
    navigate,
    connectCalendarUrl,
    calendarConnected,
    introSlotsPublished,
    assessmentDone,
    interviewUnlocked,
    interviewCompleted,
  });

  const tileClassName =
    'block w-full text-left rounded-2xl border-2 border-white p-3.5 sm:p-4 transition-all bg-white hover:bg-gray-50 shadow-md';

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
      className="bg-red border border-red rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 lg:sticky lg:top-28 space-y-5 sm:space-y-6"
    >
      <div>
        <p className="text-white font-black text-[10px] uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
          <Sparkles size={11} /> Grow your presence
        </p>
        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
          Strengthen your profile
        </h3>
        <p className="text-white text-sm font-semibold mt-2 sm:mt-3 leading-relaxed">
          Complete your skills test so clients can see verified expertise. When a client requests an
          AI interview, it will appear here. Connect your calendar and publish intro availability.
        </p>
        {onOpenGuide && (
          <button
            type="button"
            onClick={onOpenGuide}
            className="mt-4 text-[10px] font-black uppercase tracking-widest text-white/90 hover:text-white underline underline-offset-4 decoration-white/40 hover:decoration-white transition-colors"
          >
            How it works — quick guide
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {tiles.map((tile) => {
          if (tile.disabled) {
            return (
              <div
                key={tile.id}
                className="block w-full text-left rounded-2xl border-2 border-white/60 p-3.5 sm:p-4 bg-white/70 opacity-80 cursor-not-allowed"
                aria-disabled="true"
              >
                {renderTileInner(tile)}
              </div>
            );
          }
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
        <div className="flex flex-wrap items-start gap-2 text-[10px] font-bold text-white uppercase tracking-wider leading-snug">
          <TrendingUp size={12} className="text-white shrink-0 mt-0.5" />
          <span>Complete skills tests → stronger visibility in client searches</span>
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
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saved' | 'error'
  const [error, setError] = useState('');
  const {
    photoFile: uploadedPhotoFile,
    photoPreview,
    photoProcessing,
    photoProgress,
    handlePhotoSelect,
    clearPhoto,
  } = useProfilePhotoUpload({ onError: setError });
  const [introSlotsPublished, setIntroSlotsPublished] = useState(false);
  const [skillScores, setSkillScores] = useState({});
  const [assessmentDone, setAssessmentDone] = useState(false);
  const [interviewUnlocked, setInterviewUnlocked] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [inProgressSkill, setInProgressSkill] = useState('');
  const justSubmitted = location.state?.justSubmitted;
  const portalUploadWarnings = location.state?.uploadWarnings;
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [portfolioOpenAdd, setPortfolioOpenAdd] = useState(false);

  const connectCalendarUrl = user?.id
    ? `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}/api/cal/connect/start?talentId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email || '')}`
    : '';

  const closeGuide = () => {
    setShowGuideModal(false);
    try {
      localStorage.setItem(TALENT_GUIDE_STORAGE_KEY, '1');
    } catch {
      // ignore private mode
    }
  };

  const openGuide = () => setShowGuideModal(true);

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

  // Intro slots status — fetch early so ticks match calendar/skills (no wait for publish-grid)
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    fetchIntroSlotsPublished(user.id).then((published) => {
      if (alive) setIntroSlotsPublished(published);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Refresh profile after Cal.com OAuth redirect (?cal=connected)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('cal') === 'connected' && user) {
      fetchProfile();
    }
  }, [location.search, user]);

  // Open guide from navbar link (?guide=1)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('guide') !== '1' || !user || loadingProfile) return;
    setShowGuideModal(true);
    navigate({ pathname: '/portal', search: '' }, { replace: true });
  }, [location.search, user, loadingProfile, navigate]);

  // Deep link: /portal#client-intro-scheduling
  useEffect(() => {
    if (loadingProfile) return;
    if (location.hash === '#client-intro-scheduling') {
      requestAnimationFrame(() => scrollToClientIntroSection());
    }
  }, [loadingProfile, location.hash]);

  // Deep links: profile sections used by onboarding chat actions
  useEffect(() => {
    if (loadingProfile) return;
    if (!['#profile-photo', '#profile-pricing', '#profile-submit'].includes(location.hash)) return;
    requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [loadingProfile, location.hash]);

  // Deep link: /portal#talent-portfolio or /portal?portfolio=add
  useEffect(() => {
    if (loadingProfile) return;
    const params = new URLSearchParams(location.search);
    const hashOk = location.hash === '#talent-portfolio' || location.hash === '#portfolio';
    const wantsAdd = params.get('portfolio') === 'add';
    if (hashOk || wantsAdd) {
      requestAnimationFrame(() => scrollToPortfolioSection({ openAdd: wantsAdd }));
      if (wantsAdd) setPortfolioOpenAdd(true);
    }
  }, [loadingProfile, location.hash, location.search]);

  useEffect(() => {
    const onPortfolioScroll = (e) => {
      if (e.detail?.openAdd) setPortfolioOpenAdd(true);
    };
    window.addEventListener('byg-portfolio-scroll', onPortfolioScroll);
    return () => window.removeEventListener('byg-portfolio-scroll', onPortfolioScroll);
  }, []);

  useEffect(() => {
    if (loadingProfile || !user) return;
    try {
      if (!localStorage.getItem(TALENT_GUIDE_STORAGE_KEY)) {
        setShowGuideModal(true);
      }
    } catch {
      // ignore
    }
  }, [loadingProfile, user]);

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
    const assessmentPromise = fetchAssessmentStatus().catch(() => null);
    const introPromise = talentId ? fetchIntroSlotsPublished(talentId) : Promise.resolve(false);
    const interviewPromise = fetchVoiceInterviewStatus().catch(() => null);

    const [assessment, introPublished, interviewStatus] = await Promise.all([
      assessmentPromise,
      introPromise,
      interviewPromise,
    ]);

    if (assessment) {
      setSkillScores(assessment.skillScores || {});
      setAssessmentDone((assessment.assessedCount || 0) > 0);
      setInProgressSkill(assessment.activeSession?.skill || '');
    } else {
      setSkillScores({});
      setAssessmentDone(false);
      setInProgressSkill('');
    }

    setIntroSlotsPublished(introPublished);
    setInterviewUnlocked(Boolean(interviewStatus?.interviewUnlocked));
    setInterviewCompleted(Boolean(interviewStatus?.hasCompleted));

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

  const uploadPhoto = async () => {
    if (!uploadedPhotoFile || !user) return null;
    setUploadingPhoto(true);
    const path = `${user.id}/photo.jpg`;
    const { error: upErr } = await supabase.storage.from('talent-files').upload(path, uploadedPhotoFile, {
      upsert: true,
      contentType: 'image/jpeg',
    });
    setUploadingPhoto(false);
    if (upErr) { setError('Photo upload failed: ' + upErr.message); return null; }
    const { data } = supabase.storage.from('talent-files').getPublicUrl(path);
    return withPhotoCacheBust(data.publicUrl);
  };

  const persistProfileChanges = async () => {
    const prepared = prepareProfileForSave(form);
    if (!prepared.ok) {
      throw new Error(formatProfileValidationErrors(prepared.errors));
    }

    let photoUrl = profile?.photo_url || '';
    if (uploadedPhotoFile) {
      const uploaded = await uploadPhoto();
      if (!uploaded) {
        throw new Error('Photo upload failed. Please try again.');
      }
      photoUrl = uploaded;
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

    setProfile((p) => (p ? { ...p, photo_url: photoUrl, updated_at: new Date().toISOString() } : p));

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

    clearPhoto();
    return photoUrl;
  };

  const handleSave = async () => {
    setError('');
    setSaveStatus('');
    setSaving(true);
    try {
      await persistProfileChanges();
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

  const handleSubmitForReview = async () => {
    setError('');
    setSaveStatus('');
    setSubmittingReview(true);
    try {
      await persistProfileChanges();
      const updated = await submitProfileForReview();
      setProfile((p) => ({ ...p, ...updated }));
      await fetchProfile();
    } catch (err) {
      setError(err.message || 'Could not submit for review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const directoryStatus = profile?.directory_status || 'draft';
  const directoryLive = isDirectoryLive(directoryStatus);
  const showSubmitReview = canSubmitForReview(directoryStatus);
  const reviewIssueLabels = (profile?.review_issues || [])
    .map((code) => REVIEW_ISSUE_OPTIONS.find((o) => o.code === code)?.label || code)
    .filter(Boolean);

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
  const displayPhoto =
    photoPreview || photoUrlForDisplay(profile?.photo_url, profile?.updated_at) || '';

  return (
    <div className="bg-white min-h-screen pt-20 sm:pt-24 pb-16 sm:pb-24 px-3 sm:px-4 font-sans">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">

        {/* ── Welcome Banner ── */}
        {portalUploadWarnings?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-semibold text-amber-900 space-y-1">
            <p className="font-black uppercase tracking-wider text-[10px]">Some files may need re-upload</p>
            {portalUploadWarnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        )}

        {justSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4"
          >
            <CheckCircle2 size={24} className="text-amber-600 shrink-0" />
            <div>
              <p className="font-black text-amber-900 text-sm">Profile submitted for review</p>
              <p className="text-amber-800 text-xs font-medium mt-0.5">
                You are on our waitlist. We will email you when your profile is approved for the talent directory.
              </p>
            </div>
          </motion.div>
        )}

        {directoryStatus === 'pending_review' && !justSubmitted && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
            <AlertTriangle size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-900 text-sm">On waitlist — pending admin review</p>
              <p className="text-amber-800 text-xs font-medium mt-1">
                Your profile is not visible on the talent directory yet. We typically review within a few business days.
              </p>
            </div>
          </div>
        )}

        {directoryStatus === 'changes_requested' && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-4">
              <AlertTriangle size={22} className="text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-orange-900 text-sm">Updates required before going live</p>
                <p className="text-orange-800 text-xs font-medium mt-1">
                  Please fix the items below, then use <strong>Save &amp; submit for review</strong> — your edits are saved and sent to admin in one step.
                </p>
              </div>
            </div>
            {reviewIssueLabels.length > 0 && (
              <ul className="text-xs font-semibold text-orange-900 list-disc pl-5 space-y-1">
                {reviewIssueLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            )}
            {profile?.review_notes && (
              <p className="text-xs font-medium text-orange-900 bg-white/60 rounded-xl p-3 border border-orange-100">
                {profile.review_notes}
              </p>
            )}
          </div>
        )}

        {directoryLive && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
            <CheckCircle2 size={24} className="text-green-600 shrink-0" />
            <div>
              <p className="font-black text-green-800 text-sm">Profile live on talent directory</p>
              <p className="text-green-700 text-xs font-medium mt-0.5">
                {profile?.id && (
                  <>
                    Clients can find you at{' '}
                    <Link to={`/talent/${profile.id}`} className="underline font-bold">
                      /talent/{profile.id}
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
        )}


        {/* ── Header Card (full width) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-black text-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-red rounded-full blur-[120px] opacity-20 -mr-16 sm:-mr-20 -mt-16 sm:-mt-20 pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-4 sm:gap-6">
            <div className="flex items-center gap-4 min-w-0">
            {/* Photo */}
            <div className="relative shrink-0" id="profile-photo">
              {displayPhoto ? (
                <img src={displayPhoto} alt={form.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover object-top border-2 border-white/20 shadow-xl" />
              ) : (
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white font-black text-xl sm:text-2xl border-2 border-white/20"
                  style={{ background: `linear-gradient(135deg, hsl(${hue},55%,42%), hsl(${hue + 40},60%,32%))` }}
                >
                  {initials}
                </div>
              )}
              <label className={`absolute -bottom-2 -right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-200 transition-colors ${photoProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:bg-gray-100'}`}>
                <Camera size={12} className="text-black" />
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" disabled={photoProcessing} />
              </label>
              {photoProcessing && (
                <p className="absolute -bottom-8 left-0 right-0 text-center text-[9px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Processing…
                </p>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Logged in as</p>
              <h2 className="text-lg sm:text-xl font-black text-white truncate">{form.name || user.email}</h2>
              <p className="text-red font-bold text-sm mt-0.5 truncate">{form.job_title || 'No title set yet'}</p>
            </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full">
            {profile?.id && directoryLive && (
              <Link
                to={`/talent/${profile.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2.5 sm:py-0 text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-widest transition-colors rounded-xl sm:rounded-none border border-white/10 sm:border-0"
              >
                View Public Profile <ExternalLink size={10} />
              </Link>
            )}
            {profile?.id && (
              <Link
                to={`/talent/${profile.id}/portfolio`}
                className="flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2.5 sm:py-0 text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-widest transition-colors rounded-xl sm:rounded-none border border-white/10 sm:border-0"
              >
                My portfolio <ExternalLink size={10} />
              </Link>
            )}
            {profile?.id && (
              <Link
                to={`/talent/${profile.id}/portfolio?preview=visitor`}
                className="flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2.5 sm:py-0 text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-widest transition-colors rounded-xl sm:rounded-none border border-white/10 sm:border-0"
              >
                Preview as visitor <ExternalLink size={10} />
              </Link>
            )}
            {profile?.id && (
              <Link
                to={`/talent/${profile.id}/portfolio?add=1#portfolio-editor`}
                className="flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2.5 sm:py-0 text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-widest transition-colors rounded-xl sm:rounded-none border border-white/10 sm:border-0"
              >
                Add chapter <ExternalLink size={10} />
              </Link>
            )}
            <button
              type="button"
              onClick={openGuide}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-black text-white uppercase tracking-widest transition-colors border border-white/15 flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
            >
              <Sparkles size={11} /> Talent guide
            </button>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-6 sm:gap-8 items-start">
          {/* ── Strengthen profile — first on phone, sidebar on desktop ── */}
          <div className="lg:col-span-2 lg:col-start-4 lg:row-start-1 order-1 lg:order-2">
            <StrengthenProfilePanel
              profileId={profile?.id}
              navigate={navigate}
              connectCalendarUrl={connectCalendarUrl}
              calendarConnected={Boolean(profile?.cal_username)}
              introSlotsPublished={introSlotsPublished}
              assessmentDone={assessmentDone}
              interviewUnlocked={interviewUnlocked}
              interviewCompleted={interviewCompleted}
              onOpenGuide={openGuide}
            />
          </div>

          {/* ── Main column: edit + intro ── */}
          <div className="lg:col-span-3 lg:col-start-1 lg:row-start-1 order-2 lg:order-1 space-y-6 sm:space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 space-y-6 sm:space-y-7"
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

          <div className="grid sm:grid-cols-2 gap-4" id="profile-pricing">
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

          {inProgressSkill && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-900 font-medium space-y-2">
              <p className="font-bold">
                Unfinished skills test for{' '}
                <span className="text-red">{inProgressSkill}</span>
              </p>
              <p className="text-xs text-amber-800/90 leading-relaxed">
                Only one unfinished test is tracked at a time. Finish or restart this skill,
                or start another — any new test discards the previous attempt (new questions, no resume).
              </p>
              <Link
                to="/assessment"
                className="inline-flex items-center gap-1.5 text-[10px] font-black text-red uppercase tracking-widest hover:text-black transition-colors"
              >
                <ClipboardCheck size={12} /> Pick a skill to assess
              </Link>
            </div>
          )}

          <ProfileSkillsEditor
            skills={form.skills}
            bestSkill={form.best_skill}
            skillScores={skillScores}
            inProgressSkill={inProgressSkill}
            showAssessmentLink
            onSkillsChange={(skills) => setForm((f) => ({ ...f, skills }))}
            onBestSkillChange={(best_skill) => setForm((f) => ({ ...f, best_skill }))}
            newSkill={newSkill}
            onNewSkillChange={setNewSkill}
            onAddSkill={addSkill}
          />

          {photoProcessing && (
            <ProfilePhotoGeneratingLoader
              message={photoProgress || 'Creating professional studio photo…'}
            />
          )}

          {uploadedPhotoFile && !photoProcessing && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800 font-bold">
              <CheckCircle2 size={16} className="shrink-0 text-green-600" />
              {showSubmitReview
                ? 'New photo ready — it will be saved when you submit for review.'
                : 'Professional photo ready — save to update your profile.'}
            </div>
          )}

          {/* Save + submit */}
          <div className="space-y-3" id="profile-submit">
          {showSubmitReview ? (
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={submittingReview || saving || uploadingPhoto || photoProcessing}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 bg-red text-white hover:bg-black disabled:opacity-50 shadow-lg"
            >
              {submittingReview
                ? 'Saving & submitting…'
                : uploadingPhoto
                  ? 'Uploading photo…'
                  : photoProcessing
                    ? 'Processing photo…'
                    : 'Save & submit for review'}
              {!submittingReview && !uploadingPhoto && !photoProcessing && <ArrowRight size={14} />}
            </button>
          ) : null}

          <button
            onClick={handleSave}
            disabled={saving || uploadingPhoto || photoProcessing || submittingReview}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              showSubmitReview
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                : !saving && !uploadingPhoto && !photoProcessing && !submittingReview
                  ? 'bg-black text-white hover:bg-red cursor-pointer shadow-lg'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            } ${saving || uploadingPhoto || photoProcessing || submittingReview ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {photoProcessing ? 'Processing photo…' : uploadingPhoto ? 'Uploading photo…' : saving ? 'Saving…' : showSubmitReview ? 'Save changes only' : 'Save Changes'}
            {!saving && !uploadingPhoto && !photoProcessing && !submittingReview && <Save size={14} />}
          </button>

          {showSubmitReview && (
            <p className="text-center text-[10px] font-medium text-gray-500">
              Use <span className="font-bold">Save changes only</span> if you are not ready to resubmit yet.
            </p>
          )}

          {directoryStatus === 'pending_review' && (
            <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Status: {STATUS_LABELS.pending_review}
            </p>
          )}
          </div>
        </motion.div>

        <motion.div
          id="talent-portfolio"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.11 }}
          className="scroll-mt-28"
        >
          <PortalPortfolioEditor
            profileId={profile?.id}
            userId={user?.id}
            autoOpenAdd={portfolioOpenAdd}
            onAutoOpenHandled={() => setPortfolioOpenAdd(false)}
          />
        </motion.div>

        {/* ── Intro scheduling (availability + booked calls) ── */}
        <motion.div
          id="client-intro-scheduling"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="scroll-mt-24 sm:scroll-mt-28 bg-white border border-gray-200 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 space-y-2"
        >
          <div className="mb-4 sm:mb-6">
            <p className="text-[10px] font-black text-red uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
              <Calendar size={11} /> Client intros
            </p>
            <h3 className="font-black text-lg text-gray-900 tracking-tight">Intro scheduling</h3>
            <p className="text-xs text-gray-500 font-medium mt-2 leading-relaxed">
              Publish when you are free for intro calls, and see confirmed bookings in one place.
            </p>
          </div>
          <TalentIntroAvailability
            talentId={profile?.id || user?.id}
            calConnected={Boolean(profile?.cal_username)}
            connectCalendarUrl={connectCalendarUrl}
            onPublishedChange={setIntroSlotsPublished}
          />
        </motion.div>

        {/* ── Quick links ── */}
        <div className="flex gap-4 flex-wrap">
          {profile?.id && (
            <Link to={`/talent/${profile.id}`} className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-black transition-colors uppercase tracking-widest">
              <ExternalLink size={12} /> View Public Profile
            </Link>
          )}
          {profile?.id && (
            <Link to={`/talent/${profile.id}/portfolio`} className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-black transition-colors uppercase tracking-widest">
              <ExternalLink size={12} /> My portfolio
            </Link>
          )}
          {profile?.id && (
            <Link to={`/talent/${profile.id}/portfolio?preview=visitor`} className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-black transition-colors uppercase tracking-widest">
              <ExternalLink size={12} /> Preview as visitor
            </Link>
          )}
          {profile?.id && (
            <Link to={`/talent/${profile.id}/portfolio?add=1#portfolio-editor`} className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-black transition-colors uppercase tracking-widest">
              <ExternalLink size={12} /> Add chapter
            </Link>
          )}
          <Link to="/talent" className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-black transition-colors uppercase tracking-widest">
            ← Talent Directory
          </Link>
        </div>
          </div>
        </div>
      </div>

      <TalentGuideModal
        open={showGuideModal}
        onClose={closeGuide}
        connectCalendarUrl={connectCalendarUrl}
        calendarConnected={Boolean(profile?.cal_username)}
        assessmentDone={assessmentDone}
        interviewUnlocked={interviewUnlocked}
        interviewCompleted={interviewCompleted}
        introSlotsPublished={introSlotsPublished}
        onScrollToTimings={scrollToClientIntroSection}
      />
    </div>
  );
};

export default PortalPage;

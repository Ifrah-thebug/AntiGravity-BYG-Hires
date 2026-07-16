// src/pages/TalentPortfolioPage.jsx
// Storybook-style public portfolio — /talent/:id/portfolio
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, Sparkles, User, ChevronRight, Pencil, Eye, Plus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDisplayName, formatFirstName } from '../lib/formatDisplayName';
import { useAuth } from '../context/AuthContext';
import { useIsLoggedInTalent } from '../hooks/useIsLoggedInTalent';
import { isDirectoryLive } from '../lib/profileReview';
import { fetchPublicPortfolioProjects, fetchOwnPortfolioProjects } from '../lib/talentPortfolio';
import { fetchPortfolioViewAccess, fetchTalentPortfolioSharing } from '../services/portfolioAccessService';
import RequestPortfolioPanel from '../components/RequestPortfolioPanel';
import { photoUrlForDisplay } from '../lib/talentStorage';
import { getTalentDepartmentLabel } from '../lib/talentDepartments';
import { fetchPublicSkillScores, buildTalentSkillScores } from '../services/assessmentService';
import { fetchPublicAiInterviewBadges } from '../services/voiceInterviewService';
import { scoreBadgeClass } from '../lib/skillAssessmentDisplay';
import { SHOW_ASSESSMENT_SCORE, sanitizeTalentForPublicDisplay } from '../lib/talentVerification';
import ProfileVerificationBadge from '../components/ProfileVerificationBadge';
import AiInterviewVerifiedBadge from '../components/AiInterviewVerifiedBadge';
import PortfolioProjectDetail from '../components/PortfolioProjectDetail';
import PortfolioShareBar from '../components/portfolio/PortfolioShareBar';
import StorybookSpread from '../components/portfolio/StorybookSpread';
import StoryQuote, { buildPortfolioStoryQuotes } from '../components/portfolio/StoryQuote';
import StorybookProjectCard from '../components/portfolio/StorybookProjectCard';
import { StorybookDivider, StorybookCorner } from '../components/portfolio/StorybookOrnament';
import PortfolioStoryMusic from '../components/portfolio/PortfolioStoryMusic';
import PortfolioPageDecor from '../components/portfolio/PortfolioPageDecor';
import PortfolioHighlightsStrip from '../components/portfolio/PortfolioHighlightsStrip';
import PortfolioJourneyTimeline from '../components/portfolio/PortfolioJourneyTimeline';
import PortalPortfolioEditor from '../components/PortalPortfolioEditor';

function scrollToChapter(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToPortfolioEditor() {
  scrollToChapter('portfolio-editor');
}

const TalentPortfolioPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const visitorPreview = searchParams.get('preview') === 'visitor';
  const shareParam = searchParams.get('share') || searchParams.get('token') || '';
  const wantsAddChapter = searchParams.get('add') === '1' || searchParams.get('add') === 'chapter';
  const { user } = useAuth();
  const { isLoggedInTalent } = useIsLoggedInTalent();
  const canRequestIntro = !isLoggedInTalent;

  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [skillScores, setSkillScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeProject, setActiveProject] = useState(null);
  const [addChapterSignal, setAddChapterSignal] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [viewAccess, setViewAccess] = useState({ allowed: false, status: 'loading' });
  const [sharingSettings, setSharingSettings] = useState({ portfolioPublicEnabled: true, shareToken: '' });

  const refreshDisplayProjects = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const items = await fetchOwnPortfolioProjects(profile.id);
      setProjects(items.filter((p) => p.published));
      setDraftCount(items.filter((p) => !p.published).length);
    } catch {
      setProjects([]);
      setDraftCount(0);
    }
  }, [profile?.id]);

  const openAddChapter = () => {
    setAddChapterSignal((n) => n + 1);
    scrollToPortfolioEditor();
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchPageData();
  }, [id, user?.id, visitorPreview, shareParam]);

  useEffect(() => {
    if (loading) return;
    if (location.hash === '#portfolio-editor' || wantsAddChapter) {
      requestAnimationFrame(() => scrollToPortfolioEditor());
    }
  }, [loading, location.hash, wantsAddChapter]);

  // While waiting on talent approval, poll so the portfolio unlocks automatically.
  useEffect(() => {
    if (loading || viewAccess.status !== 'pending') return undefined;
    const timer = setInterval(() => {
      fetchPageData();
    }, 8000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchPageData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loading, viewAccess.status, id, user?.id, shareParam]);

  const fetchPageData = async () => {
    setLoading(true);
    setError('');

    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('id, user_id, name, job_title, about, skills, best_skill, experience_years, photo_url, department, directory_status, created_at, updated_at')
      .eq('id', id)
      .single();

    if (profileErr || !profileData) {
      setError('Portfolio not found.');
      setLoading(false);
      return;
    }

    const profileIsOwner = Boolean(user?.id && profileData.user_id === user.id);
    const isOwnerView = profileIsOwner && !visitorPreview;
    const scoreMap = await fetchPublicSkillScores([profileData.id]).catch(() => ({}));
    const aiBadgeMap = await fetchPublicAiInterviewBadges([profileData.id]).catch(() => ({}));
    const aiMeta = aiBadgeMap[profileData.id] || {};

    setProfile({
      ...profileData,
      aiInterviewVerified: Boolean(aiMeta.aiInterviewVerified),
      aiInterviewScore: aiMeta.interviewScore ?? null,
    });
    setSkillScores(buildTalentSkillScores(scoreMap, profileData.id, profileData.skills || []));

    try {
      if (isOwnerView) {
        const items = await fetchOwnPortfolioProjects(profileData.id);
        setProjects(items.filter((p) => p.published));
        setDraftCount(items.filter((p) => !p.published).length);
        setViewAccess({ allowed: true, status: 'owner', asOwner: true });
        try {
          const sharing = await fetchTalentPortfolioSharing();
          setSharingSettings({
            portfolioPublicEnabled: sharing.portfolioPublicEnabled !== false,
            shareToken: sharing.shareToken || '',
          });
        } catch {
          setSharingSettings({ portfolioPublicEnabled: true, shareToken: '' });
        }
      } else if (profileIsOwner && visitorPreview) {
        // Owner "Preview as visitor": show published work without access gating.
        // (Share/public APIs can return empty for a logged-in talent.)
        const items = await fetchOwnPortfolioProjects(profileData.id);
        const published = items.filter((p) => p.published);
        setProjects(published);
        setDraftCount(0);
        setViewAccess({ allowed: true, status: 'visitor_preview', asOwner: false });
        try {
          const sharing = await fetchTalentPortfolioSharing();
          setSharingSettings({
            portfolioPublicEnabled: sharing.portfolioPublicEnabled !== false,
            shareToken: sharing.shareToken || '',
          });
        } catch {
          setSharingSettings({ portfolioPublicEnabled: true, shareToken: '' });
        }
      } else {
        const access = await fetchPortfolioViewAccess(profileData.id, shareParam);
        setViewAccess({
          allowed: Boolean(access.allowed),
          status: access.status || access.reason || 'none',
          asOwner: false,
        });
        if (access.allowed && Array.isArray(access.projects)) {
          setProjects(access.projects);
        } else {
          setProjects([]);
        }
        setDraftCount(0);
      }
    } catch {
      setProjects([]);
      setDraftCount(0);
      setViewAccess({ allowed: false, status: 'error', asOwner: false });
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-28 flex flex-col items-center justify-center gap-5 bg-[#f5ebe0]">
        <div className="relative">
          <motion.div
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="w-20 h-24 bg-[#fffbf5] border-2 border-[#e8dcc8] rounded-sm shadow-xl flex items-center justify-center"
          >
            <BookOpen size={32} className="text-red/50" />
          </motion.div>
          <motion.div
            className="absolute -bottom-1 -right-2 w-8 h-10 bg-[#fffbf5] border border-[#e8dcc8] rounded-sm shadow-md"
            animate={{ rotate: [8, 12, 8] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.25em]">Opening story…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-[#fffbf5] min-h-screen pt-28 flex flex-col items-center justify-center text-center px-4">
        <p className="font-black text-gray-400 text-sm uppercase tracking-widest">{error || 'Story not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/talent')}
          className="mt-6 px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red transition-colors"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  const displayPhotoUrl = photoUrlForDisplay(profile.photo_url, profile.updated_at || profile.created_at);
  const displayName = formatDisplayName(profile.name);
  const firstName = formatFirstName(profile.name);
  const initials = profile.name
    ? profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const hue = profile.name
    ? (profile.name.charCodeAt(0) * 37 + (profile.name.charCodeAt(1) || 0) * 17) % 360
    : 200;

  const isOwner = Boolean(user?.id && profile.user_id === user.id);
  const showOwnerEditor = isOwner && !visitorPreview;
  const directoryLive = isDirectoryLive(profile.directory_status);
  const canViewPortfolio = showOwnerEditor || viewAccess.allowed;

  if (!canViewPortfolio && directoryLive) {
    return (
      <div className="min-h-screen bg-[#f5ebe0] pt-24 pb-20 px-4">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => navigate(`/talent/${profile.id}`)}
            className="inline-flex items-center gap-2 text-xs font-black text-gray-500 hover:text-black uppercase tracking-widest mb-8"
          >
            <ArrowLeft size={13} /> Back to profile
          </button>
          <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <BookOpen size={32} className="mx-auto text-red/70" />
              <h1 className="font-black text-xl text-gray-900">{formatDisplayName(profile.name)}&apos;s portfolio</h1>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                {viewAccess.status === 'pending'
                  ? 'Your request is pending. This page updates automatically when the talent approves — you do not need to reopen it.'
                  : viewAccess.status === 'share_required'
                    ? 'This portfolio uses a private link. Ask the talent for their share URL, or request access as a BYG client below.'
                    : viewAccess.status === 'login_required'
                      ? 'Sign in with your activated hiring client account to request portfolio access, or use the talent\'s public share link if they sent you one.'
                      : 'Request access to view this talent\'s portfolio storybook. Each client is approved individually.'}
              </p>
            </div>
            {canRequestIntro && user?.email && (
              <RequestPortfolioPanel
                talent={{ id: profile.id, isReal: true }}
                clientEmail={user.email}
                canRequestPortfolio={viewAccess.status !== 'login_required'}
              />
            )}
            {viewAccess.status === 'login_required' && (
              <Link
                to={`/login?redirect=${encodeURIComponent(`/talent/${profile.id}/portfolio`)}`}
                className="block w-full py-4 bg-black hover:bg-red text-white font-black text-sm uppercase tracking-widest rounded-2xl text-center transition-colors"
              >
                Sign in as client
              </Link>
            )}
            <Link
              to={`/request-intro?id=${profile.id}`}
              className="block w-full py-3 text-center text-xs font-black uppercase tracking-widest text-gray-500 hover:text-red transition-colors"
            >
              Go to intro &amp; portfolio request
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const showPreviewBanner = isOwner && !directoryLive && !visitorPreview;
  const showOwnerBar = showOwnerEditor;
  const departmentLabel = getTalentDepartmentLabel(profile.department);
  const skills = profile.skills || [];

  const displayTalent = sanitizeTalentForPublicDisplay({
    bestSkill: profile.best_skill || skills[0],
    tags: skills,
    skillScores,
    aiInterviewVerified: profile.aiInterviewVerified,
    aiInterviewScore: profile.aiInterviewScore,
  });

  const storyQuotes = buildPortfolioStoryQuotes({ profile, firstName, displayName, projects, departmentLabel });
  const openQuote = storyQuotes[0];
  const craftQuote = storyQuotes.find((q) => q.attribution === firstName && q.text.includes('craft')) || storyQuotes[1];
  const closingQuote = storyQuotes[storyQuotes.length - 1];

  return (
    <div className="relative font-sans text-black overflow-x-hidden bg-[#ebe0d0]">
      <div
        className="absolute inset-0 pointer-events-none z-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 100% 70% at 50% -10%, rgba(255,61,61,0.08) 0%, transparent 50%),
            radial-gradient(ellipse 90% 60% at 10% 50%, rgba(139,115,85,0.06) 0%, transparent 45%),
            radial-gradient(ellipse 90% 60% at 90% 60%, rgba(139,115,85,0.05) 0%, transparent 45%),
            linear-gradient(180deg, #f5ebe0 0%, #f0e6d8 35%, #ebe0d0 70%, #e5d9c8 100%)
          `,
        }}
      />
      <PortfolioPageDecor />

      <div className="relative z-10 pb-16 md:pb-10">
      {/* Desktop sticky bar */}
      <div className="hidden md:block fixed top-[4.5rem] left-0 right-0 z-40 bg-[#fffbf5]/95 backdrop-blur-md border-b-2 border-[#e8dcc8] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/talent')}
              className="inline-flex items-center gap-2 text-[10px] font-black text-gray-500 hover:text-black uppercase tracking-widest"
            >
              <ArrowLeft size={12} /> Directory
            </button>
            <span className="text-gray-300">·</span>
            <Link
              to={`/talent/${profile.id}`}
              className="inline-flex items-center gap-2 text-[10px] font-black text-gray-500 hover:text-red uppercase tracking-widest truncate"
            >
              <User size={12} className="shrink-0" /> Hire Profile
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && !visitorPreview && (
              <Link
                to={`/talent/${profile.id}/portfolio?preview=visitor`}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#e8dcc8] hover:border-red text-gray-700 font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors"
              >
                <Eye size={12} /> Preview as visitor
              </Link>
            )}
            {isOwner && visitorPreview && (
              <Link
                to={`/talent/${profile.id}/portfolio`}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-black hover:bg-red text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors"
              >
                <Pencil size={12} /> Exit preview
              </Link>
            )}
            <PortfolioShareBar
              profileId={profile.id}
              displayName={displayName}
              portfolioPublicEnabled={sharingSettings.portfolioPublicEnabled}
              shareToken={sharingSettings.shareToken}
            />
          </div>
        </div>
      </div>
      <div className="hidden md:block h-[3.75rem]" aria-hidden />

      {/* Mobile top links */}
      <div className="md:hidden max-w-6xl mx-auto px-3 sm:px-6 pt-20 pb-2 flex flex-wrap items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/talent')}
            className="inline-flex items-center gap-1.5 text-[10px] font-black text-gray-500 hover:text-black uppercase tracking-widest"
          >
            <ArrowLeft size={12} /> Directory
          </button>
          <span className="text-gray-300">·</span>
          <Link
            to={`/talent/${profile.id}`}
            className="inline-flex items-center gap-1.5 text-[10px] font-black text-gray-500 hover:text-red uppercase tracking-widest truncate"
          >
            <User size={12} className="shrink-0" /> Hire Profile
          </Link>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && !visitorPreview && (
            <Link
              to={`/talent/${profile.id}/portfolio?preview=visitor`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#e8dcc8] text-gray-700 font-black text-[9px] uppercase tracking-widest rounded-lg"
            >
              <Eye size={11} /> Preview
            </Link>
          )}
          {isOwner && visitorPreview && (
            <Link
              to={`/talent/${profile.id}/portfolio`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-black text-white font-black text-[9px] uppercase tracking-widest rounded-lg"
            >
              <Pencil size={11} /> Exit
            </Link>
          )}
          <PortfolioShareBar
            profileId={profile.id}
            displayName={displayName}
            compact
            portfolioPublicEnabled={sharingSettings.portfolioPublicEnabled}
            shareToken={sharingSettings.shareToken}
          />
        </div>
      </div>

      {visitorPreview && isOwner && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-4">
          <div className="bg-black text-white border border-gray-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold flex items-center gap-2">
                <Eye size={14} className="text-red shrink-0" />
                Visitor preview — this is what clients see when your profile is live.
              </p>
              {!isDirectoryLive(profile.directory_status) && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Your profile isn&apos;t approved yet — projects won&apos;t appear publicly until it is.
                </p>
              )}
            </div>
            <Link
              to={`/talent/${profile.id}/portfolio`}
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red hover:text-white transition-colors shrink-0"
            >
              <Pencil size={12} /> Exit preview & edit
            </Link>
          </div>
        </div>
      )}

      {showOwnerBar && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-4">
          <div className="bg-[#fffbf5] border border-[#e8dcc8] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <p className="text-xs font-semibold text-gray-700">
              You&apos;re editing <span className="font-black text-black">your portfolio</span>.
              {draftCount > 0 && projects.length === 0 && (
                <span className="block text-[10px] text-amber-700 mt-1 font-bold">
                  You have {draftCount} draft chapter{draftCount === 1 ? '' : 's'} — publish them in Chapter studio below to show here.
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={openAddChapter}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-black hover:bg-red text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors"
              >
                <Plus size={12} /> Add chapter
              </button>
              <button
                type="button"
                onClick={scrollToPortfolioEditor}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-red text-gray-700 font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors"
              >
                <Pencil size={12} /> Manage chapters
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviewBanner && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-semibold text-amber-900">
            Preview — this story goes public once your profile is approved.{' '}
            <Link to="/portal" className="text-red font-black hover:underline">Portal</Link>
          </div>
        </div>
      )}

      {/* ═══ COVER ═══ */}
      <section id="cover" className="scroll-mt-28 md:scroll-mt-8 pb-6 md:pb-8 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl mx-auto px-4 sm:px-6 w-full"
        >
          <div className="relative bg-black text-white rounded-sm shadow-[0_28px_80px_-24px_rgba(0,0,0,0.6)] overflow-hidden border-[5px] sm:border-[8px] border-[#1a1a1a] ring-1 ring-[#4a4a4a]">
            <div className="absolute inset-0 bg-gradient-to-br from-red/25 via-transparent to-black pointer-events-none" />
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 50%)' }} />
            <StorybookCorner className="top-3 left-3 sm:top-4 sm:left-4 text-white/25 hidden sm:block" />
            <StorybookCorner className="top-3 right-3 sm:top-4 sm:right-4 text-white/25 hidden sm:block" flip />

            {/* Wax seal */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.8, type: 'spring' }}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-10 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-red shadow-lg flex items-center justify-center border-2 border-red-400/50 z-20"
              aria-hidden
            >
              <BookOpen size={16} className="text-white/90 sm:w-5 sm:h-5" />
            </motion.div>

            <div className="relative z-10 px-4 py-8 sm:px-6 sm:py-10 md:py-12 text-center">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 text-red font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.25em] sm:tracking-[0.3em] mb-4 sm:mb-6"
              >
                <Sparkles size={12} /> A BYG Hires Story
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45, type: 'spring' }}
                className="mx-auto mb-5 sm:mb-6"
              >
                {displayPhotoUrl ? (
                  <img
                    src={displayPhotoUrl}
                    alt={profile.name}
                    className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full object-cover object-top border-4 border-white/20 shadow-2xl mx-auto"
                  />
                ) : (
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center text-white font-black text-2xl sm:text-3xl border-4 border-white/20 mx-auto"
                    style={{ background: `linear-gradient(135deg, hsl(${hue},55%,42%), hsl(${hue + 40},60%,32%))` }}
                  >
                    {initials}
                  </div>
                )}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight px-1"
              >
                The Story of
                <br />
                <span className="text-red break-words">{displayName}</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="mt-3 sm:mt-4 text-gray-400 font-bold text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] px-2"
              >
                {profile.job_title}
              </motion.p>

              <div className="flex flex-wrap justify-center gap-2 mt-6">
                <ProfileVerificationBadge talent={displayTalent} variant="dark" />
                <AiInterviewVerifiedBadge talent={displayTalent} variant="dark" />
              </div>

              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                onClick={() => scrollToChapter('chapter-1')}
                className="mt-10 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-red transition-colors"
              >
                Turn the page <ChevronRight size={14} className="animate-pulse" />
              </motion.button>
            </div>

            {/* Cover curl bottom */}
            <div className="h-4 bg-gradient-to-r from-red/30 via-red to-red/30 relative">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)]" />
            </div>
          </div>

          <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mt-5 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-gray-300" />
            Digital Portfolio · Share instead of LinkedIn
            <span className="h-px w-8 bg-gray-300" />
          </p>
        </motion.div>
      </section>

      <PortfolioHighlightsStrip
        experienceYears={profile.experience_years}
        projectCount={projects.length}
        skillCount={skills.length}
        verified={displayTalent.aiInterviewVerified || isDirectoryLive(profile.directory_status)}
      />

      <StorybookDivider />

      {/* ═══ CHAPTER I — The Beginning ═══ */}
      <div id="chapter-1" className="scroll-mt-32 py-3 md:py-5">
        <StorybookSpread
          chapter="I"
          chapterLabel="The Beginning"
          title={<>Once upon a career&hellip;</>}
          subtitle={`Every professional has an origin story. This is ${firstName}'s.`}
          variant="left"
        >
          {openQuote && <StoryQuote text={openQuote.text} attribution={openQuote.attribution} size="lg" />}

          <p className="text-gray-700 font-medium leading-[1.75] sm:leading-[1.9] text-[15px] sm:text-base md:text-lg first-letter:text-4xl sm:first-letter:text-5xl first-letter:font-black first-letter:text-red first-letter:float-left first-letter:mr-2 sm:first-letter:mr-3 first-letter:mt-1 first-letter:leading-none">
            {profile.about || (
              <>
                {displayName} is a {profile.job_title?.toLowerCase() || 'professional'} on BYG Hires —
                vetted remote talent ready to help teams build, ship, and grow.
              </>
            )}
          </p>

          {profile.experience_years > 0 && (
            <p className="mt-6 text-sm font-bold text-gray-500">
              <span className="text-red font-black">{profile.experience_years}+</span> years writing this story so far.
            </p>
          )}
        </StorybookSpread>
      </div>

      <StorybookDivider />

      {/* ═══ CHAPTER II — The Craft ═══ */}
      <div id="chapter-2" className="scroll-mt-32 py-3 md:py-5">
        <StorybookSpread
          chapter="II"
          chapterLabel="The Craft"
          title={<>Tools of the <span className="text-red">trade</span></>}
          subtitle="The skills and strengths that shape every chapter of this journey."
          variant="right"
        >
          {craftQuote && <StoryQuote text={craftQuote.text} attribution={craftQuote.attribution} />}

          {profile.best_skill && (
            <div className="mb-5 p-5 rounded-xl bg-black text-white inline-block">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Signature strength</p>
              <p className="font-black text-lg text-red">{profile.best_skill}</p>
            </div>
          )}

          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, i) => {
                const score = skillScores[skill];
                return (
                  <motion.span
                    key={skill}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e8dcc8] text-gray-800 font-bold text-[10px] uppercase tracking-wide rounded-xl shadow-sm hover:border-red/30 hover:shadow-md transition-all"
                  >
                    {skill}
                    {SHOW_ASSESSMENT_SCORE && score != null && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${scoreBadgeClass(score)}`}>{score}</span>
                    )}
                  </motion.span>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 italic text-sm">Skills chapter still being written…</p>
          )}
        </StorybookSpread>
      </div>

      <StorybookDivider />

      {/* ═══ CHAPTER II½ — The Journey ═══ */}
      <div id="chapter-journey" className="scroll-mt-32 py-3 md:py-5">
        <StorybookSpread
          chapter="·"
          chapterLabel="The Journey"
          title={<>Milestones along the <span className="text-red">way</span></>}
          subtitle={`Key moments that shaped ${firstName}'s path as a ${profile.job_title?.toLowerCase() || 'professional'}.`}
          variant="left"
        >
          <PortfolioJourneyTimeline
            firstName={firstName}
            jobTitle={profile.job_title}
            departmentLabel={departmentLabel}
            experienceYears={profile.experience_years}
            bestSkill={profile.best_skill}
          />
        </StorybookSpread>
      </div>

      <StorybookDivider />

      {/* ═══ CHAPTER III — The Adventures (Work) ═══ */}
      <div id="chapter-3" className="scroll-mt-32 py-3 md:py-5">
        <StorybookSpread
          chapter="III"
          chapterLabel="The Adventures"
          title={<>Chapters of <span className="text-red">real work</span></>}
          subtitle={`Projects, case studies, and live links — each one a page in ${firstName}'s professional storybook.`}
          variant="left"
          className="mb-5"
        />

        {projects.length === 0 && !showOwnerEditor ? (
          <StorybookSpread
            chapterLabel="Still being written"
            title="An empty page awaits…"
            subtitle={`${firstName} is adding work samples soon.`}
            variant="right"
          >
            <div className="text-center py-5">
              <BookOpen size={48} className="mx-auto text-gray-200 mb-4" strokeWidth={1.5} />
            </div>
          </StorybookSpread>
        ) : projects.length === 0 && showOwnerEditor ? (
          <StorybookSpread
            chapterLabel="Your first chapter"
            title="Start writing your story…"
            subtitle="Add a project below — once published, it appears in this chapter for visitors."
            variant="right"
          >
            <div className="text-center py-2">
              <BookOpen size={40} className="mx-auto text-red/20 mb-2" strokeWidth={1.5} />
            </div>
          </StorybookSpread>
        ) : (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-5 md:space-y-6">
            {projects.map((project, index) => (
              <React.Fragment key={project.id}>
                <StorybookProjectCard
                  project={project}
                  chapterNum={index + 1}
                  index={index}
                  variant={index % 2 === 0 ? 'left' : 'right'}
                  onOpen={setActiveProject}
                />
                {index < projects.length - 1 && storyQuotes[index + 2] && (
                  <StoryQuote
                    text={storyQuotes[index + 2].text}
                    attribution={storyQuotes[index + 2].attribution}
                    className="max-w-5xl mx-auto"
                  />
                )}
              </React.Fragment>
            ))}

            {showOwnerEditor && (
              <div className="text-center pt-2 pb-4">
                <button
                  type="button"
                  onClick={openAddChapter}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-black hover:bg-red text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors shadow-lg"
                >
                  <Plus size={12} /> Write next chapter <ArrowRight size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        {showOwnerEditor && (
          <div id="portfolio-editor" className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 scroll-mt-36">
            <PortalPortfolioEditor
              embedded
              profileId={profile.id}
              userId={user?.id}
              autoOpenAdd={wantsAddChapter}
              openAddSignal={addChapterSignal}
              onProjectsChange={refreshDisplayProjects}
            />
          </div>
        )}
      </div>

      <StorybookDivider />

      {/* ═══ CHAPTER IV — The End / Connect ═══ */}
      <div id="chapter-4" className="scroll-mt-32 py-3 md:py-5 pb-4">
        <StorybookSpread
          chapter="IV"
          chapterLabel="The End… or a New Beginning"
          title={<>Every story deserves a <span className="text-red">next chapter</span></>}
          subtitle={`Interested in working with ${firstName}? The BYG Hires team can make the introduction.`}
          variant="left"
        >
          {closingQuote && <StoryQuote text={closingQuote.text} attribution={closingQuote.attribution} />}

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-6 sm:mt-8 w-full">
            <PortfolioShareBar
              profileId={profile.id}
              displayName={displayName}
              className="w-full sm:w-auto justify-center"
              portfolioPublicEnabled={sharingSettings.portfolioPublicEnabled}
              shareToken={sharingSettings.shareToken}
            />
            <Link
              to={`/talent/${profile.id}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-black text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-black hover:text-white transition-colors w-full sm:w-auto"
            >
              Hire Profile
            </Link>
            {canRequestIntro && (
              <Link
                to={`/request-intro?id=${profile.id}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-red hover:bg-black text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors w-full sm:w-auto"
              >
                Request Intro <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </StorybookSpread>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-4 mb-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]"
        >
          <BookOpen size={12} className="inline mr-1 -mt-0.5" />
          The End · Powered by{' '}
          <Link to="/" className="text-red hover:text-black transition-colors">BYG Hires</Link>
        </motion.p>
      </div>

      <PortfolioProjectDetail project={activeProject} onClose={() => setActiveProject(null)} />
      <PortfolioStoryMusic />
      </div>
    </div>
  );
};

export default TalentPortfolioPage;

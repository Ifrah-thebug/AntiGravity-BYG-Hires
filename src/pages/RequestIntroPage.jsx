// src/pages/RequestIntroPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Briefcase, Clock, Zap, Moon, Award, AlertTriangle
} from 'lucide-react';
import { formatDisplayName } from '../lib/formatDisplayName';
import { formatAvailabilityLabel } from '../lib/profileContentPolicy';
import { resolveRequestIntroTalent } from '../lib/requestIntroTalent';
import { useAuth } from '../context/AuthContext';
import { useAccountType } from '../hooks/useAccountType';
import IntroSlotPicker from '../components/IntroSlotPicker';
import RequestAiInterviewPanel from '../components/RequestAiInterviewPanel';
import TalentSkillTags from '../components/TalentSkillTags';
import ProfileVerificationBadge from '../components/ProfileVerificationBadge';
import AiInterviewVerifiedBadge from '../components/AiInterviewVerifiedBadge';
import { SHOW_ASSESSMENT_SCORE } from '../lib/talentVerification';
import { useIsLoggedInTalent } from '../hooks/useIsLoggedInTalent';

const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

const Avatar = ({ name, size = 96 }) => {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360;
  return (
    <div
      className="rounded-3xl flex items-center justify-center text-white font-black shadow-xl"
      style={{
        width: size, height: size,
        fontSize: size * 0.35,
        background: `linear-gradient(135deg, hsl(${hue},55%,42%), hsl(${hue + 40},60%,32%))`,
      }}
    >
      {initials}
    </div>
  );
};

const RoleTypeBadge = ({ type }) => {
  const map = {
    night:    { label: 'Night Role',  icon: <Moon size={11} />,      cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    flexible: { label: 'Flexible',    icon: <Clock size={11} />,     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    fulltime: { label: 'Full-Time',   icon: <Briefcase size={11} />, cls: 'bg-green-50 text-green-700 border-green-200' },
    parttime: { label: 'Part-Time',   icon: <Zap size={11} />,       cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  };
  const b = map[type] || map.flexible;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${b.cls}`}>
      {b.icon}{b.label}
    </span>
  );
};

function TalentSummaryCard({ talent }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden lg:sticky lg:top-28"
    >
      <div className="bg-black text-white p-5 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 sm:w-40 h-32 sm:h-40 bg-red rounded-full blur-[90px] opacity-20 -mr-12 -mt-12 pointer-events-none" />
        <div className="flex items-center gap-4 sm:gap-5 relative z-10 min-w-0">
          {talent.photo ? (
            <img
              src={talent.photo}
              alt={talent.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover object-top shadow-lg border-2 border-white/10 shrink-0"
            />
          ) : (
            <Avatar name={talent.name} size={64} />
          )}
          <div className="min-w-0">
            <ProfileVerificationBadge talent={talent} variant="dark" />
            <AiInterviewVerifiedBadge talent={talent} variant="dark" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight truncate">{formatDisplayName(talent.name)}</h2>
            <p className="text-red font-bold text-xs uppercase tracking-wide truncate">{talent.role}</p>
          </div>
        </div>
        {SHOW_ASSESSMENT_SCORE && talent.score > 0 && (
          <div className="mt-5 sm:mt-6 relative z-10">
            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              <span>Assessment Score</span>
              <span className="text-white">{talent.score}/100</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${talent.score}%` }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-300"
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-7 space-y-5 sm:space-y-6">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">About</p>
          <p className="text-gray-700 text-sm font-medium leading-relaxed">{talent.bio}</p>
        </div>

        {talent.tags?.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Skills & Expertise</p>
            <TalentSkillTags tags={talent.tags} bestSkill={talent.bestSkill} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {talent.fee > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 sm:p-4">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Monthly Fee</p>
              <p className="font-black text-gray-900 text-sm sm:text-base">
                ${talent.fee.toLocaleString()}
                <span className="text-gray-400 text-xs font-semibold">{talent.period}</span>
              </p>
            </div>
          )}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 sm:p-4">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Experience</p>
            <p className="font-black text-gray-900 text-sm">{talent.experience}</p>
          </div>
          {talent.availability && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 sm:p-4">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Availability</p>
              <p className="font-black text-gray-900 text-sm leading-snug">{formatAvailabilityLabel(talent.availability)}</p>
            </div>
          )}
          {talent.roleType && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 sm:p-4">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Role Type</p>
              <RoleTypeBadge type={talent.roleType} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ScheduleIntroPanel({
  talent,
  scheduleError,
  clientIdentityLoading,
  isActivatedClient,
  clientIdentity,
  guestPrefillName,
  guestPrefillEmail,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 }}
      className="lg:col-span-3 order-1 lg:order-2"
    >
      <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">
            Step 2
          </p>
          <h3 className="font-black text-base sm:text-lg uppercase tracking-wide text-gray-900">
            Schedule an Introduction
          </h3>
          <p className="text-gray-500 text-sm font-medium mt-1 leading-relaxed">
            Book a 30-minute intro call with our team to discuss hiring{' '}
            <span className="font-bold text-black">{formatDisplayName(talent.name)}</span>
          </p>
          <p className="text-[11px] text-gray-400 font-semibold mt-2 leading-relaxed">
            Choose a time the talent published. Cal.com sends invites to you, HR, and the talent.
          </p>
        </div>

        <div className="w-full relative overflow-hidden min-h-[240px] sm:min-h-[320px]">
          {scheduleError ? (
            <div className="flex items-center justify-center p-6 sm:p-8 min-h-[240px] sm:min-h-[320px]">
              <div className="max-w-md text-center space-y-3">
                <AlertTriangle size={28} className="mx-auto text-red" />
                <p className="font-black text-sm text-gray-900">Scheduling unavailable</p>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">{scheduleError}</p>
              </div>
            </div>
          ) : clientIdentityLoading ? (
            <div className="flex items-center justify-center p-6 sm:p-8 min-h-[240px] sm:min-h-[320px]">
              <div className="w-8 h-8 border-4 border-red/20 border-t-red rounded-full animate-spin" />
            </div>
          ) : (
            <IntroSlotPicker
              talentId={talent.id}
              talentName={formatDisplayName(talent.name)}
              guestName={isActivatedClient ? clientIdentity.name : guestPrefillName}
              guestEmail={isActivatedClient ? clientIdentity.email : guestPrefillEmail}
              guestCompany={isActivatedClient ? clientIdentity.company : ''}
              identityLocked={isActivatedClient}
              isLoggedInClient={isActivatedClient}
              bookingTitle="Intro Interview"
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

const RequestIntroPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const accountType = useAccountType(user);
  const { isLoggedInTalent, loading: viewerLoading } = useIsLoggedInTalent();
  const talentId = searchParams.get('id');
  const requesterName = searchParams.get('name') || '';
  const requesterEmail = searchParams.get('email') || '';
  const loggedInName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim();
  const loggedInEmail = String(user?.email || '').trim();
  const [talent, setTalent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState('');
  const [clientIdentity, setClientIdentity] = useState(null);
  const [clientIdentityLoading, setClientIdentityLoading] = useState(false);

  const isLoggedInClient = accountType === 'client' && Boolean(clientIdentity?.email);
  const canRequestAiInterview = isLoggedInClient && Boolean(clientIdentity?.activated);
  const guestPrefillName = requesterName || loggedInName;
  const guestPrefillEmail = requesterEmail || loggedInEmail;

  /** Clients can book; logged-in talent on their own profile see details only. */
  const canRequestIntro = !viewerLoading && !isLoggedInTalent;

  useEffect(() => {
    let cancelled = false;

    if (accountType !== 'client' || !user?.id || !API_BASE) {
      setClientIdentity(null);
      setClientIdentityLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setClientIdentityLoading(true);
    (async () => {
      try {
        const resp = await fetch(
          `${API_BASE}/api/client/dashboard/overview?userId=${encodeURIComponent(user.id)}`
        );
        const data = await resp.json().catch(() => ({}));
        if (cancelled) return;
        if (resp.ok && data?.ok && data?.profile?.email) {
          const email = String(data.profile.email || user.email || '').trim();
          const name =
            String(data.profile.name || loggedInName || '').trim() ||
            email.split('@')[0] ||
            'Client';
          setClientIdentity({
            name,
            email,
            company: String(data.profile.company || '').trim(),
            activated: Boolean(data.profile.activated),
          });
        } else {
          setClientIdentity(null);
        }
      } catch {
        if (!cancelled) setClientIdentity(null);
      } finally {
        if (!cancelled) setClientIdentityLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountType, user?.id, user?.email, loggedInName]);

  useEffect(() => {
    window.scrollTo(0, 0);
    let cancelled = false;
    setLoading(true);
    resolveRequestIntroTalent(talentId).then((t) => {
      if (!cancelled) {
        setTalent(t);
        setLoading(false);
        if (t && !t.isReal) {
          setScheduleError('This profile is using sample data and is not connected to live scheduling yet.');
        } else {
          setScheduleError('');
        }
      }
    });
    return () => { cancelled = true; };
  }, [talentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-24 sm:pt-28">
        <div className="w-10 h-10 border-4 border-red/20 border-t-red rounded-full animate-spin" />
      </div>
    );
  }

  if (!talent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-24 sm:pt-28 font-sans text-black px-4">
        <div className="text-center max-w-md">
          <Award size={48} className="text-red mx-auto mb-6" />
          <h2 className="text-xl sm:text-2xl font-black uppercase mb-3">Talent Not Found</h2>
          <p className="text-gray-500 font-medium text-sm mb-6">The profile you&apos;re looking for is not available.</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto min-h-[44px] px-8 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 sm:pt-24 font-sans text-black overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 mb-4 sm:mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-black font-bold text-sm transition-colors group min-h-[44px]"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-16 sm:pb-20">
        <div
          className={`grid gap-6 sm:gap-8 items-start ${
            canRequestIntro ? 'lg:grid-cols-5' : 'lg:grid-cols-1 max-w-2xl mx-auto'
          }`}
        >
          {canRequestIntro && (
            <div className="lg:col-span-3 order-1 lg:order-2 space-y-0">
              <RequestAiInterviewPanel
                talent={talent}
                clientEmail={clientIdentity?.email || guestPrefillEmail}
                canRequestAiInterview={canRequestAiInterview}
              />
              <ScheduleIntroPanel
                talent={talent}
                scheduleError={scheduleError}
                clientIdentityLoading={clientIdentityLoading}
                isActivatedClient={isLoggedInClient}
                clientIdentity={clientIdentity}
                guestPrefillName={guestPrefillName}
                guestPrefillEmail={guestPrefillEmail}
              />
            </div>
          )}

          <div className={`${canRequestIntro ? 'lg:col-span-2 order-2 lg:order-1' : ''}`}>
            <TalentSummaryCard talent={talent} />
          </div>

          {!canRequestIntro && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm text-gray-500 font-medium px-2 pb-2"
            >
              Hiring clients book intros from this page. You are viewing as talent — profile details only.
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestIntroPage;

import React, { useState, useEffect, useMemo } from 'react';
import { formatDisplayName } from '../lib/formatDisplayName';
import TalentSkillTags from './TalentSkillTags';
import ProfileVerificationBadge from './ProfileVerificationBadge';
import { SHOW_ASSESSMENT_SCORE } from '../lib/talentVerification';
import { useIsLoggedInTalent } from '../hooks/useIsLoggedInTalent';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Star, ArrowRight, ArrowDown, X, Briefcase } from 'lucide-react';
import { formatAvailabilityLabel } from '../lib/profileContentPolicy';
import { fetchLiveDirectoryTalents, pickFeaturedTalents } from '../lib/liveDirectoryTalents';
import { sanitizeTalentList } from '../lib/talentVerification';

const EXPLORE_STEPS = [
  { label: 'Filter industry', short: 'Filter' },
  { label: 'Review matches', short: 'Review' },
  { label: 'Request intro', short: 'Intro' },
  { label: 'Explore talent', short: 'Explore' },
];

const EXPLORE_LINE_START = 12.5;
const EXPLORE_LINE_SPAN = 75;

/** Matches section labels (Top Recommendations, talent card CTAs). */
const exploreEyebrowClass =
  'font-sans text-xs font-black text-gray-400 uppercase tracking-[0.2em]';
const exploreStepLabelClass =
  'font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest text-center leading-snug';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Step progress — aligned grid, site typography, sliding active state. */
function MatchmakingExploreBanner({ onExplore }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const stepCount = EXPLORE_STEPS.length;
  const lastIndex = stepCount - 1;
  const progressPct =
    lastIndex > 0 ? (active / lastIndex) * EXPLORE_LINE_SPAN : 0;

  const motionTransition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 280, damping: 28 };

  useEffect(() => {
    if (paused || reducedMotion) return undefined;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % stepCount);
    }, 4000);
    return () => window.clearInterval(id);
  }, [paused, reducedMotion, stepCount]);

  return (
    <div
      className="mt-16 flex flex-col items-center w-full font-sans antialiased"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      <div
        className="w-full max-w-2xl mb-10"
        role="group"
        aria-label="How matchmaking works"
      >
        <p className={`text-center mb-8 ${exploreEyebrowClass}`}>
          Your hiring path
        </p>

        <div className="relative px-2 sm:px-0">
          <div
            className="absolute top-[3.35rem] sm:top-[3.6rem] h-px bg-gray-200 pointer-events-none"
            style={{
              left: `${EXPLORE_LINE_START}%`,
              width: `${EXPLORE_LINE_SPAN}%`,
            }}
            aria-hidden
          />
          <motion.div
            className="absolute top-[3.35rem] sm:top-[3.6rem] h-0.5 bg-red rounded-full pointer-events-none"
            style={{ left: `${EXPLORE_LINE_START}%` }}
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={motionTransition}
            aria-hidden
          />

          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            {EXPLORE_STEPS.map((step, i) => {
              const isActive = i === active;
              return (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Step ${i + 1}: ${step.label}`}
                  aria-current={isActive ? 'step' : undefined}
                  className="group flex flex-col items-center gap-3 sm:gap-4 focus:outline-none"
                >
                  <span
                    className={`min-h-[2.5rem] sm:min-h-0 transition-colors duration-300 ${exploreStepLabelClass} ${
                      isActive ? 'text-black' : 'text-gray-500 group-hover:text-gray-700'
                    }`}
                  >
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.short}</span>
                  </span>

                  <div className="relative flex h-11 w-11 items-center justify-center">
                    {!isActive && (
                      <span
                        className="absolute inset-0 rounded-full border-2 border-gray-200 bg-white transition-colors group-hover:border-gray-300"
                        aria-hidden
                      />
                    )}
                    {isActive && (
                      <>
                        <motion.span
                          layoutId="explore-step-active"
                          className="absolute inset-0 rounded-full bg-black shadow-md shadow-black/10"
                          transition={motionTransition}
                          aria-hidden
                        />
                        <span
                          className="absolute -inset-1 rounded-full border-2 border-red"
                          aria-hidden
                        />
                      </>
                    )}
                    <span
                      className={`relative z-10 font-sans text-xs font-black tabular-nums transition-colors duration-300 ${
                        isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
                      }`}
                    >
                      {i + 1}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 mb-5 -mt-2" aria-hidden>
        <span className={exploreEyebrowClass}>Matchmaking</span>
        <motion.div
          animate={reducedMotion ? undefined : { y: [0, 6, 0] }}
          transition={
            reducedMotion
              ? undefined
              : { repeat: Infinity, duration: 1.7, ease: 'easeInOut' }
          }
          className="text-red"
        >
          <ArrowDown size={26} strokeWidth={2.5} />
        </motion.div>
      </div>

      <button
        type="button"
        onClick={onExplore}
        className="inline-flex items-center gap-2 rounded-xl bg-red px-7 py-3.5 text-white font-sans font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-colors shadow-md shadow-red/20"
      >
        Explore Matchmaking
        <ArrowRight size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ─── Avatar initials helper ──────────────────────────────────────────────────
const Avatar = ({ name, score, photo, size = "w-16 h-16 text-lg" }) => {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(1) * 17) % 360;
  return (
    <div
      className={`relative ${size} rounded-2xl flex items-center justify-center text-white font-black shrink-0 shadow-lg overflow-hidden border-2 border-white/10`}
      style={!photo ? { background: `linear-gradient(135deg, hsl(${hue},55%,42%), hsl(${hue + 40},60%,32%))` } : {}}
    >
      {photo ? (
        <img src={photo} alt={name} className="w-full h-full object-cover object-top" />
      ) : (
        initials
      )}
    </div>
  );
};

// ─── Talent Detail Modal ──────────────────────────────────────────────────────
const TalentModal = ({ talent, onClose, canRequestIntro = true }) => {
  const navigate = useNavigate();
  if (!talent) return null;
  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          key="modal"
          initial={{ scale: 0.92, opacity: 0, y: 32 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 32 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="bg-white rounded-[2.5rem] max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-black text-white p-8 relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 w-48 h-48 bg-red rounded-full blur-[100px] opacity-20 -mr-16 -mt-16 pointer-events-none" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close profile"
              className="absolute top-5 right-5 z-20 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-start gap-6 relative z-10">
              <Avatar name={talent.name} score={talent.score} photo={talent.photo} size="w-48 h-48 text-5xl" />
              <div>
                <ProfileVerificationBadge talent={talent} variant="dark" />
                <h2 className="text-2xl font-black tracking-tight" title={talent.name}>{formatDisplayName(talent.name)}</h2>
                <p className="text-red font-bold text-sm uppercase tracking-wide">{talent.role}</p>
                <div className="flex items-center gap-3 mt-2 text-gray-400 text-xs font-semibold">
                  <span className="flex items-center gap-1"><Briefcase size={10} />{talent.experience} experience</span>
                </div>
              </div>
            </div>
            {SHOW_ASSESSMENT_SCORE && talent.score > 0 && (
              <div className="mt-6 relative z-10">
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  <span>Assessment Score</span><span className="text-white">{talent.score}/100</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${talent.score}%` }} transition={{ delay: 0.3, duration: 0.7 }}
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-300" />
                </div>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-8 space-y-6 text-left">
            {/* Bio */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">About</p>
              <p className="text-gray-700 text-sm font-medium leading-relaxed">{talent.bio}</p>
            </div>

            {/* Tags */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Skills & Expertise</p>
              <div className="flex flex-wrap gap-2">
                {talent.tags && talent.tags.map(tag => (
                  <span key={tag} className="px-3 py-1.5 bg-red/5 border border-red/10 text-red font-bold text-[10px] uppercase tracking-wide rounded-xl">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Monthly Fee', value: `$${talent.fee.toLocaleString()}${talent.period || '/mo'}` },
                { label: 'Availability', value: talent.availability === 'immediate' ? 'Available Now' : talent.availability === '2weeks' ? 'In 2 Weeks' : talent.availability === 'july' ? 'Available from July' : 'In 1 Month' },
                { label: 'Role Type', value: { night: 'Night Role', flexible: 'Flexible Hours', fulltime: 'Full-Time Remote', parttime: 'Part-Time' }[talent.roleType] || 'Flexible Hours' },
                { label: 'Experience', value: talent.experience },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                  <p className="font-black text-gray-900 text-sm">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              {canRequestIntro && (
                <button
                  onClick={() => navigate(`/request-intro?id=${talent.id}`)}
                  className="flex-1 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-colors text-center flex items-center justify-center gap-2 shadow-lg"
                >
                  Request Intro <ArrowRight size={14} />
                </button>
              )}
              <button
                onClick={onClose}
                className={`${canRequestIntro ? 'px-6' : 'flex-1'} py-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest rounded-2xl transition-colors`}
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const industries = [
  'All',
  'E-commerce',
  'SaaS',
  'Healthcare',
  'Logistics',
  'Real Estate',
  'Finance',
  'Retail',
];

const roleTypeColors = {
  fulltime: 'bg-black text-white',
  flexible: 'bg-gray-100 text-gray-700',
  night:    'bg-gray-900 text-white',
  parttime: 'bg-gray-50 border border-gray-100 text-gray-600',
};

const roleTypeLabels = {
  fulltime: '⏰ 9-5',
  night:    '🌙 Night',
  flexible: '🔄 Flexible',
  parttime: '⚡ Part-Time',
};

const TalentMatchmaking = () => {
  const { isLoggedInTalent } = useIsLoggedInTalent();
  const canRequestIntro = !isLoggedInTalent;
  const [selected, setSelected] = useState('All');
  const [selectedTalent, setSelectedTalent] = useState(null);
  const [talents, setTalents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const live = await fetchLiveDirectoryTalents();
        if (!cancelled) setTalents(sanitizeTalentList(live));
      } catch (err) {
        console.warn('[TalentMatchmaking] fetch failed:', err?.message || err);
        if (!cancelled) setTalents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const displayed = useMemo(
    () => pickFeaturedTalents(talents, { industry: selected }),
    [talents, selected]
  );

  return (
    <section className="py-28 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black text-black tracking-tight leading-tight mb-2 uppercase"
          >
            Business & Talent Matchmaking
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-2xl md:text-3xl font-bold text-gray-500 tracking-tight mb-12"
          >
            Your next hire is already <span className="text-red">ready.</span>
          </motion.p>

          {/* Industry Selector */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-3 items-center"
          >
            <span className="text-gray-500 font-bold text-xs tracking-widest uppercase mr-2">
              Select your Industry:
            </span>
            {industries.map(ind => (
              <button
                key={ind}
                onClick={() => setSelected(ind)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all border ${
                  selected === ind
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
                }`}
              >
                {ind}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Top Recommendations Label */}
        <div className="flex items-center gap-4 mb-8">
          <Star size={14} className="text-red fill-red" />
          <span className="text-xs font-black text-gray-400 tracking-[0.2em] uppercase">
            Top Recommendations
          </span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Profile Tiles */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 mb-14">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-3xl overflow-hidden animate-pulse">
                <div className="w-full aspect-[4/5] bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                  <div className="h-2 bg-gray-100 rounded-full w-1/2" />
                  <div className="h-10 bg-gray-100 rounded-xl w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 mb-14 border border-dashed border-gray-200 rounded-3xl">
            <p className="font-black text-gray-400 uppercase tracking-widest text-sm">No talent profiles yet</p>
            <p className="text-gray-400 text-xs font-medium mt-2">
              {selected === 'All'
                ? 'Live profiles will appear here as talent joins the directory.'
                : `No profiles matched “${selected}”. Try another industry or browse all talent.`}
            </p>
            <button
              type="button"
              onClick={() => navigate('/talent')}
              className="mt-6 px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red transition-colors"
            >
              Browse directory
            </button>
          </div>
        ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 mb-14"
          >
            {displayed.map((talent, i) => {
              const showMatchBadge =
                SHOW_ASSESSMENT_SCORE && Boolean(talent.verified) && Number(talent.match) > 0;
              return (
              <motion.div
                key={talent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => setSelectedTalent(talent)}
                className="group bg-white border border-gray-100 rounded-3xl overflow-hidden hover:border-red/30 hover:shadow-xl hover:shadow-red/5 transition-all duration-300 flex flex-col cursor-pointer"
              >
                {/* Photo */}
                <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-50">
                  {talent.photo ? (
                    <img
                      src={talent.photo}
                      alt={talent.name}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-white font-black text-3xl"
                      style={{
                        background: `linear-gradient(135deg, hsl(${(talent.name.charCodeAt(0) * 37) % 360},55%,42%), hsl(${((talent.name.charCodeAt(0) * 37) + 40) % 360},60%,32%))`,
                      }}
                    >
                      {talent.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {/* Availability Badge */}
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm border border-gray-100 text-black text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm z-10">
                    <span className={`w-1.5 h-1.5 rounded-full ${talent.availability === 'immediate' ? 'bg-green-500 animate-pulse' : talent.availability === '2weeks' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                    <span>{formatAvailabilityLabel(talent.availability)}</span>
                  </div>

                  {/* Match Score Badge */}
                  {showMatchBadge && (
                    <div className="absolute top-3 right-3 bg-black text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="text-red">{talent.match}%</span>
                      <span>match</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-5 flex flex-col gap-3.5 flex-1">
                  {/* Name & Title */}
                  <div className="h-[48px] flex flex-col justify-start overflow-hidden">
                    <p className="text-black font-black text-sm leading-tight line-clamp-1" title={talent.name}>{formatDisplayName(talent.name)}</p>
                    <p className="text-gray-500 text-[11px] font-normal mt-1 line-clamp-2 leading-snug" title={talent.role || talent.expertise}>{talent.role || talent.expertise}</p>
                  </div>

                  <TalentSkillTags
                    tags={talent.tags}
                    bestSkill={talent.bestSkill}
                    skillScores={talent.skillScores}
                  />

                  {/* Experience & Role Type */}
                  <div className="h-[24px] flex flex-wrap gap-1.5 items-start overflow-hidden">
                    <span className="text-[10px] font-bold bg-gray-50 border border-gray-100 text-gray-600 px-2 py-1 rounded-lg whitespace-nowrap">
                      {talent.experience || '4+ yrs'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap ${roleTypeColors[talent.roleType] || 'bg-gray-100 text-gray-700'}`}>
                      {roleTypeLabels[talent.roleType] || '🔄 Flexible'}
                    </span>
                  </div>

                  {/* Monthly Fee */}
                  <div className="h-[42px] flex flex-col justify-end mt-auto">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Monthly</p>
                    <p className="text-black font-black text-base leading-none">
                      ${talent.fee ? talent.fee.toLocaleString() : '0'}<span className="text-xs">{talent.period || '/mo'}</span>
                    </p>
                  </div>

                  {canRequestIntro ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/request-intro?id=${talent.id}`);
                      }}
                      className="w-full py-3.5 bg-black text-white text-[10px] font-black tracking-widest uppercase rounded-xl hover:bg-red transition-all duration-200 text-center shadow-md shadow-black/5"
                    >
                      Request Intro
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTalent(talent);
                      }}
                      className="w-full py-3.5 border border-gray-200 bg-gray-50 text-gray-700 text-[10px] font-black tracking-widest uppercase rounded-xl hover:border-gray-300 hover:bg-gray-100 transition-colors"
                    >
                      View profile
                    </button>
                  )}
                </div>
              </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
        )}

        <MatchmakingExploreBanner onExplore={() => navigate('/talent')} />
      </div>

      {/* Talent Detail Modal */}
      {selectedTalent && (
        <TalentModal
          talent={selectedTalent}
          onClose={() => setSelectedTalent(null)}
          canRequestIntro={canRequestIntro}
        />
      )}
    </section>
  );
};

export default TalentMatchmaking;

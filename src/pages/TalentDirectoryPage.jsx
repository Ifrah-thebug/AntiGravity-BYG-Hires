// src/pages/TalentDirectoryPage.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, SlidersHorizontal, Star, Clock, ChevronDown,
  ChevronUp, ArrowRight, X, Briefcase, Award, Moon, Zap, CheckCircle2
} from 'lucide-react';
import {
  DEPARTMENTS,
  SORT_OPTIONS,
  AVAILABILITY_OPTIONS,
  ROLE_TYPE_OPTIONS,
  parseTalentDirectorySearchParams,
} from '../data/talentData';
import { formatDisplayName } from '../lib/formatDisplayName';
import { formatAvailabilityLabel } from '../lib/profileContentPolicy';
import { fetchLiveDirectoryTalents, pickFeaturedTalents } from '../lib/liveDirectoryTalents';
import TalentSkillTags from '../components/TalentSkillTags';
import TalentModalSkillTags from '../components/TalentModalSkillTags';
import ProfileVerificationBadge from '../components/ProfileVerificationBadge';
import AiInterviewVerifiedBadge from '../components/AiInterviewVerifiedBadge';
import { SHOW_ASSESSMENT_SCORE, sanitizeTalentList } from '../lib/talentVerification';
import { useIsLoggedInTalent } from '../hooks/useIsLoggedInTalent';

// ─── Avatar initials helper ──────────────────────────────────────────────────
const Avatar = ({ name, score, photo, size = "w-16 h-16 text-lg" }) => {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360;
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

// ─── Role type badge ──────────────────────────────────────────────────────────
const RoleTypeBadge = ({ type }) => {
  const map = {
    night:    { label: 'Night Role',  icon: <Moon size={9} />,      cls: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    flexible: { label: 'Flexible',    icon: <Clock size={9} />,     cls: 'bg-blue-50 text-blue-700 border-blue-100' },
    fulltime: { label: 'Full-Time',   icon: <Briefcase size={9} />, cls: 'bg-green-50 text-green-700 border-green-100' },
    parttime: { label: 'Part-Time',   icon: <Zap size={9} />,       cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  };
  const b = map[type] || map.flexible;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${b.cls}`}>
      {b.icon}{b.label}
    </span>
  );
};

// ─── Availability badge ───────────────────────────────────────────────────────
const AvailBadge = ({ avail }) => {
  const map = {
    immediate: { cls: 'text-green-600' },
    '2weeks':  { cls: 'text-yellow-600' },
    '1month':  { cls: 'text-gray-500' },
    from_month: { cls: 'text-indigo-600' },
  };
  const b = map[avail] || map.immediate;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold ${b.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${avail === 'immediate' ? 'animate-pulse' : ''}`} />
      {formatAvailabilityLabel(avail)}
    </span>
  );
};

// ─── Talent Card ──────────────────────────────────────────────────────────────
const TalentCard = ({ talent, onSelect, canRequestIntro = true }) => {
  const navigate = useNavigate();
  const showMatchBadge =
    SHOW_ASSESSMENT_SCORE &&
    Boolean(talent.verified) &&
    (Number(talent.score) > 0 || Number(talent.match) > 0);

  // Mapping roleType values to match availability badge styles from TalentMatchmaking
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22 }}
      onClick={() => onSelect(talent)}
      className="group bg-white border border-gray-100 rounded-3xl overflow-hidden hover:border-red/30 hover:shadow-xl hover:shadow-red/5 transition-all duration-300 flex flex-col cursor-pointer"
    >
      {/* Photo container */}
      <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-50">
        {talent.photo ? (
          <img
            src={talent.photo}
            alt={talent.name}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white font-black text-5xl select-none"
            style={{
              background: `linear-gradient(135deg, hsl(${(talent.name.charCodeAt(0) * 37 + (talent.name.charCodeAt(1) || 0) * 17) % 360},55%,42%), hsl(${(talent.name.charCodeAt(0) * 37 + (talent.name.charCodeAt(1) || 0) * 17) % 360 + 40},60%,32%))`
            }}
          >
            {talent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Availability Badge */}
        <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm border border-gray-100 text-black text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
          <span className={`w-1.5 h-1.5 rounded-full ${talent.availability === 'immediate' ? 'bg-green-500 animate-pulse' : talent.availability === '2weeks' ? 'bg-yellow-500' : talent.availability === 'from_month' ? 'bg-indigo-500' : 'bg-gray-400'}`} />
          <span>{formatAvailabilityLabel(talent.availability)}</span>
        </div>

        {/* Match Score Badge (Only show if > 0) */}
        {showMatchBadge && (
          <div className="absolute top-3 right-3 bg-black text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
            <span className="text-red">{talent.score || talent.match}%</span>
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

        {/* Skills — best skill + "+N more" */}
        <TalentSkillTags
          tags={talent.tags}
          bestSkill={talent.bestSkill}
          skillScores={talent.skillScores || {}}
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
              onSelect(talent);
            }}
            className="w-full py-3.5 border border-gray-200 bg-gray-50 text-gray-700 text-[10px] font-black tracking-widest uppercase rounded-xl hover:border-gray-300 hover:bg-gray-100 transition-colors"
          >
            View profile
          </button>
        )}
      </div>
    </motion.div>
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
          <div className="bg-black text-white p-8 relative overflow-hidden">
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
                <AiInterviewVerifiedBadge talent={talent} variant="dark" />
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
          <div className="p-8 space-y-6">
            {/* Bio */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">About</p>
              <p className="text-gray-700 text-sm font-medium leading-relaxed">{talent.bio}</p>
            </div>

            {/* Tags */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Skills & Expertise</p>
              <TalentModalSkillTags tags={talent.tags} skillScores={talent.skillScores} />
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Monthly Fee', value: `$${talent.fee.toLocaleString()}${talent.period}` },
                { label: 'Availability', value: formatAvailabilityLabel(talent.availability) },
                { label: 'Role Type', value: { night: 'Night Role', flexible: 'Flexible Hours', fulltime: 'Full-Time Remote', parttime: 'Part-Time' }[talent.roleType] },
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

// ─── Filter Panel ─────────────────────────────────────────────────────────────
const FilterPanel = ({ filters, onChange, onClear }) => {
  const hasFilters = filters.availability.length > 0 || filters.roleType.length > 0;

  const toggle = (key, value) => {
    const current = filters[key];
    onChange(key, current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mt-3 space-y-5">
        <div className="flex items-center justify-between">
          <p className="font-black text-xs uppercase tracking-widest text-gray-500">Filter Options</p>
          {hasFilters && (
            <button onClick={onClear} className="text-red text-[10px] font-black uppercase tracking-wider hover:text-black transition-colors flex items-center gap-1">
              <X size={10} /> Clear All
            </button>
          )}
        </div>

        {/* Availability */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Availability to Join</p>
          <div className="flex flex-wrap gap-2">
            {AVAILABILITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggle('availability', opt.value)}
                className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                  filters.availability.includes(opt.value)
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Role Type */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Role Type</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggle('roleType', opt.value)}
                className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                  filters.roleType.includes(opt.value)
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fee range */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">
            Max Monthly Fee: <span className="text-black">${filters.maxFee.toLocaleString()}</span>
          </p>
          <input
            type="range" min={450} max={2000} step={50}
            value={filters.maxFee}
            onChange={e => onChange('maxFee', Number(e.target.value))}
            className="w-full accent-red"
          />
          <div className="flex justify-between text-[9px] text-gray-400 font-bold mt-1">
            <span>$450</span><span>$2,000</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const TalentDirectoryPage = () => {
  const { isLoggedInTalent } = useIsLoggedInTalent();
  const canRequestIntro = !isLoggedInTalent;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = parseTalentDirectorySearchParams(searchParams);
  const [talents, setTalents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilterLabel, setRoleFilterLabel] = useState(initialFilters.roleLabel);
  const [activedept, setActivedept] = useState(initialFilters.activedept);
  const [search, setSearch] = useState(initialFilters.search);
  const [sortBy, setSortBy] = useState('name-asc');
  const [showSort, setShowSort] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ availability: [], roleType: [], maxFee: 2000 });
  const [selectedTalent, setSelectedTalent] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const liveTalents = await fetchLiveDirectoryTalents();
      setTalents(sanitizeTalentList(liveTalents));
    } catch (err) {
      console.warn('[TalentDirectory] fetch failed:', err?.message || err);
      setTalents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchData();
  }, []);

  useEffect(() => {
    const { activedept: dept, search: q, roleLabel } = parseTalentDirectorySearchParams(searchParams);
    setActivedept(dept);
    setSearch(q);
    setRoleFilterLabel(roleLabel);
  }, [searchParams]);

  const updateFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ availability: [], roleType: [], maxFee: 2000 });

  const activeFilterCount =
    filters.availability.length + filters.roleType.length + (filters.maxFee < 2000 ? 1 : 0);

  const featuredTalents = useMemo(
    () => pickFeaturedTalents(talents, { department: activedept }),
    [talents, activedept]
  );

  const featuredIdSet = useMemo(
    () => new Set(featuredTalents.map((t) => t.id)),
    [featuredTalents]
  );

  const visible = useMemo(() => {
    let list = talents.filter((t) => !featuredIdSet.has(t.id));

    // Department filter
    if (activedept !== 'all') list = list.filter(t => t.department === activedept);

    // Search (name, title, skills, bio)
    if (search.trim()) {
      const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter((t) => {
        const haystack = [
          t.name,
          t.role,
          t.bestSkill,
          t.bio,
          ...(t.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return terms.every((term) => haystack.includes(term));
      });
    }

    // Filters
    if (filters.availability.length) list = list.filter(t => filters.availability.includes(t.availability));
    if (filters.roleType.length) list = list.filter(t => filters.roleType.includes(t.roleType));
    list = list.filter(t => t.fee <= filters.maxFee);

    // Sort
    switch (sortBy) {
      case 'fee-asc':  list = [...list].sort((a, b) => a.fee - b.fee); break;
      case 'fee-desc': list = [...list].sort((a, b) => b.fee - a.fee); break;
      case 'name-asc': list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc':list = [...list].sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'score-desc':list = [...list].sort((a, b) => b.score - a.score); break;
      default: break;
    }

    return list;
  }, [talents, activedept, search, sortBy, filters, featuredIdSet]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';

  return (
    <div className="bg-white min-h-screen pt-28 pb-24 font-sans text-black">

      {/* ─── Hero Header ───────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-4">Talent Directory</p>
          <h1 className="text-5xl md:text-7xl font-black text-black tracking-tight leading-[1.05] mb-5">
            Meet the<br /><span className="text-red">talent pool.</span>
          </h1>
          <p className="text-gray-500 text-lg font-medium max-w-xl mx-auto leading-relaxed">
            Browse vetted talent profiles. Skill assessment scores reflect verified expertise.
          </p>
        </motion.div>

        {/* ─── Search + Sort + Filter bar ─────────────────────────────────── */}
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="talent-search"
                type="text"
                placeholder="Search by name, role, or skill…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-black transition-colors bg-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSort(!showSort)}
                className="flex items-center gap-2 px-4 py-3.5 border border-gray-200 hover:border-gray-400 rounded-2xl text-sm font-black text-gray-700 whitespace-nowrap transition-colors bg-white"
              >
                {currentSortLabel}
                {showSort ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <AnimatePresence>
                {showSort && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 py-2 overflow-hidden"
                  >
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setShowSort(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${
                          sortBy === opt.value ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative flex items-center gap-2 px-4 py-3.5 border rounded-2xl text-sm font-black transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'bg-black text-white border-black'
                  : 'border-gray-200 hover:border-gray-400 text-gray-700 bg-white'
              }`}
            >
              <SlidersHorizontal size={15} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 bg-red rounded-full text-white text-[9px] font-black flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {showFilters && <FilterPanel filters={filters} onChange={updateFilter} onClear={clearFilters} />}
          </AnimatePresence>

          {activedept !== 'all' && roleFilterLabel && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red/5 border border-red/20 text-xs font-bold text-gray-800">
                Department: <span className="text-red">{roleFilterLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('dept');
                  next.delete('q');
                  setSearchParams(next);
                  setActivedept('all');
                  setSearch('');
                  setRoleFilterLabel('');
                }}
                className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red transition-colors"
              >
                Clear department filter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Department Tabs (Pill Style) ────────────────────────────────────────────────── */}
      <div className="mb-10 sticky top-20 bg-white z-10 pt-4 pb-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-nowrap gap-2 items-center overflow-x-auto scrollbar-hide pb-2 md:pb-0 select-none">
            <span className="text-gray-500 font-bold text-xs tracking-widest uppercase mr-1 hidden md:block whitespace-nowrap">
              Select Department:
            </span>
            {DEPARTMENTS.map(dept => (
              <button
                key={dept.id}
                onClick={() => {
                  setActivedept(dept.id);
                  const next = new URLSearchParams(searchParams);
                  if (dept.id === 'all') {
                    next.delete('dept');
                  } else {
                    next.set('dept', dept.id);
                  }
                  next.delete('q');
                  setSearchParams(next);
                  setSearch('');
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all border whitespace-nowrap shrink-0 ${
                  activedept === dept.id
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
                }`}
              >
                {dept.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Top Recommendations ─────────────────────────────────────────────── */}
      {!loading && featuredTalents.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 mb-12">
          <div className="flex items-center gap-4 mb-8">
            <Star size={14} className="text-red fill-red" />
            <span className="text-xs font-black text-gray-400 tracking-[0.2em] uppercase">
              Top Recommendations
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5"
          >
            {featuredTalents.map((talent) => (
              <TalentCard
                key={`featured-${talent.id}`}
                talent={talent}
                onSelect={setSelectedTalent}
                canRequestIntro={canRequestIntro}
              />
            ))}
          </motion.div>
        </div>
      )}

      {/* ─── Results ────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6">
        {/* Count bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
            {loading
              ? 'Loading…'
              : `${visible.length + featuredTalents.length} talent${visible.length + featuredTalents.length !== 1 ? 's' : ''} found`}
          </p>
          <div className="flex items-center gap-2">
            <Award size={12} className="text-red" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assessment verification coming soon</p>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-3xl overflow-hidden animate-pulse">
                <div className="w-full aspect-[4/5] bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                  <div className="h-2 bg-gray-100 rounded-full w-1/2" />
                  <div className="flex gap-1">
                    <div className="h-5 w-14 bg-gray-100 rounded-lg" />
                    <div className="h-5 w-14 bg-gray-100 rounded-lg" />
                  </div>
                  <div className="h-10 bg-gray-100 rounded-xl w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {visible.length > 0 ? (
              <motion.div
                key="grid"
                layout
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5"
              >
                {visible.map(talent => (
                  <TalentCard
                    key={talent.id}
                    talent={talent}
                    onSelect={setSelectedTalent}
                    canRequestIntro={canRequestIntro}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-24"
              >
                <Search size={40} className="text-gray-200 mx-auto mb-4" />
                <p className="font-black text-gray-400 uppercase tracking-widest text-sm">No talent found</p>
                <p className="text-gray-400 text-xs font-medium mt-2">Try adjusting your filters or search query.</p>
                <button onClick={() => { setSearch(''); setActivedept('all'); clearFilters(); }}
                  className="mt-6 px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red transition-colors">
                  Reset All
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Talent Detail Modal */}
      {selectedTalent && (
        <TalentModal
          talent={selectedTalent}
          onClose={() => setSelectedTalent(null)}
          canRequestIntro={canRequestIntro}
        />
      )}
    </div>
  );
};

export default TalentDirectoryPage;

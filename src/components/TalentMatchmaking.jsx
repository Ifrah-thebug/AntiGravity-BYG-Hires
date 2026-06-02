import React, { useState } from 'react';
import { formatDisplayName } from '../lib/formatDisplayName';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, Star, ArrowRight, X, Briefcase, Award, CheckCircle2, Moon, Zap } from 'lucide-react';

import { talentService } from '../services/talentService';

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
const TalentModal = ({ talent, onClose }) => {
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
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={14} className="text-green-400" />
                  <span className="text-green-400 text-[9px] font-black uppercase tracking-wider">Verified</span>
                </div>
                <h2 className="text-2xl font-black tracking-tight" title={talent.name}>{formatDisplayName(talent.name)}</h2>
                <p className="text-red font-bold text-sm uppercase tracking-wide">{talent.role}</p>
                <div className="flex items-center gap-3 mt-2 text-gray-400 text-xs font-semibold">
                  <span className="flex items-center gap-1"><Briefcase size={10} />{talent.experience} experience</span>
                </div>
              </div>
            </div>
            {/* Score bar */}
            <div className="mt-6 relative z-10">
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                <span>Assessment Score</span><span className="text-white">{talent.score}/100</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${talent.score}%` }} transition={{ delay: 0.3, duration: 0.7 }}
                  className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-300" />
              </div>
            </div>
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

            {/* CTA */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => navigate(`/request-intro?id=${talent.id}`)}
                className="flex-1 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-colors text-center flex items-center justify-center gap-2 shadow-lg"
              >
                Request Intro <ArrowRight size={14} />
              </button>
              <button
                onClick={onClose}
                className="px-6 py-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest rounded-2xl transition-colors"
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
  const [selected, setSelected] = useState('All');
  const [selectedTalent, setSelectedTalent] = useState(null);
  const navigate = useNavigate();

  const displayed = talentService.getFeaturedTalents({ industry: selected });

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
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 mb-14"
          >
            {displayed.slice(0, 5).map((talent, i) => {
              const showMatchBadge = Boolean(talent.verified) && Number(talent.match) > 0;
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
                  <img
                    src={talent.photo}
                    alt={talent.name}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Availability Badge */}
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm border border-gray-100 text-black text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm z-10">
                    <span className={`w-1.5 h-1.5 rounded-full ${talent.availability === 'immediate' ? 'bg-green-500 animate-pulse' : talent.availability === '2weeks' ? 'bg-yellow-500' : talent.availability === 'july' ? 'bg-indigo-500' : 'bg-gray-400'}`} />
                    <span>{talent.availability === 'immediate' ? 'Available Now' : talent.availability === '2weeks' ? 'In 2 Weeks' : talent.availability === 'july' ? 'From July' : 'In 1 Month'}</span>
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

                  {/* Skills */}
                  <div className="h-[24px] flex flex-wrap gap-1.5 items-start overflow-hidden">
                    {talent.tags && talent.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="px-2 py-1 bg-gray-50 border border-gray-100 text-gray-600 font-bold text-[9px] uppercase tracking-widest rounded-lg whitespace-nowrap">
                        {tag}
                      </span>
                    ))}
                    {talent.tags && talent.tags.length > 2 && (
                      <span className="px-2 py-1 text-gray-400 font-bold text-[9px] whitespace-nowrap">
                        +{talent.tags.length - 2} more
                      </span>
                    )}
                  </div>

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

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/request-intro?id=${talent.id}`);
                    }}
                    className="w-full py-3.5 bg-black text-white text-[10px] font-black tracking-widest uppercase rounded-xl hover:bg-red transition-all duration-200 text-center shadow-md shadow-black/5"
                  >
                    Request Intro
                  </button>
                </div>
              </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Explore CTA */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/talent')}
            className="group flex items-center gap-3 px-10 py-5 border-2 border-red text-red font-black text-xl tracking-wide rounded-2xl hover:bg-red hover:text-white transition-all duration-300"
          >
            Explore the Matchmaking
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Talent Detail Modal */}
      {selectedTalent && <TalentModal talent={selectedTalent} onClose={() => setSelectedTalent(null)} />}
    </section>
  );
};

export default TalentMatchmaking;

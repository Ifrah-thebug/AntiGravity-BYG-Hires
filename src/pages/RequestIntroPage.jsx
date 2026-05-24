// src/pages/RequestIntroPage.jsx
import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Star, CheckCircle2, Briefcase, Clock, Zap, Moon, Award
} from 'lucide-react';
import { TALENTS } from '../data/talentData';

const CALENDLY_URL = 'https://calendly.com/recruitment-bnyahyagroup/30min';

// ─── Avatar initials (fallback when no photo) ─────────────────────────────────
const Avatar = ({ name, size = 96 }) => {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(1) * 17) % 360;
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

// ─── Role type badge ──────────────────────────────────────────────────────────
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

// ─── Availability label ───────────────────────────────────────────────────────
const availLabel = (a) => {
  const map = { immediate: 'Available Now', '2weeks': 'In 2 Weeks', '1month': 'In 1 Month' };
  return map[a] || a;
};

const RequestIntroPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const talentId = searchParams.get('id');
  const talent = TALENTS.find(t => t.id === talentId);

  if (!talent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-28 font-sans text-black">
        <div className="text-center max-w-md">
          <Award size={48} className="text-red mx-auto mb-6" />
          <h2 className="text-2xl font-black uppercase mb-3">Talent Not Found</h2>
          <p className="text-gray-500 font-medium text-sm mb-6">The profile you're looking for is not available.</p>
          <button onClick={() => navigate('/talent-browse')} className="px-8 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors">
            Browse All Talent
          </button>
        </div>
      </div>
    );
  }

  const scoreColor = talent.score >= 90 ? 'text-green-500' : talent.score >= 80 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="min-h-screen bg-gray-50 pt-24 font-sans text-black">
      {/* Back button */}
      <div className="max-w-7xl mx-auto px-6 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-black font-bold text-sm transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-5 gap-8 items-start">

          {/* ─── LEFT: Profile Card (2 cols) ─────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden sticky top-28"
          >
            {/* Profile header */}
            <div className="bg-black text-white p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-red rounded-full blur-[90px] opacity-20 -mr-12 -mt-12 pointer-events-none" />
              <div className="flex items-center gap-5 relative z-10">
                {talent.photo ? (
                  <img src={talent.photo} alt={talent.name} className="w-20 h-20 rounded-2xl object-cover object-top shadow-lg border-2 border-white/10" />
                ) : (
                  <Avatar name={talent.name} size={80} />
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={14} className="text-green-400" />
                    <span className="text-green-400 text-[9px] font-black uppercase tracking-wider">Verified</span>
                  </div>
                  <h2 className="text-xl font-black tracking-tight">{talent.name}</h2>
                  <p className="text-red font-bold text-xs uppercase tracking-wide">{talent.role}</p>
                </div>
              </div>
              {/* Score bar */}
              <div className="mt-6 relative z-10">
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  <span>Assessment Score</span>
                  <span className={scoreColor}>{talent.score}/100</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${talent.score}%` }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-300"
                  />
                </div>
              </div>
            </div>

            {/* Profile body */}
            <div className="p-7 space-y-6">
              {/* Bio */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">About</p>
                <p className="text-gray-700 text-sm font-medium leading-relaxed">{talent.bio}</p>
              </div>

              {/* Skills */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Skills & Expertise</p>
                <div className="flex flex-wrap gap-2">
                  {talent.tags.map(tag => (
                    <span key={tag} className="px-3 py-1.5 bg-red/5 border border-red/10 text-red font-bold text-[10px] uppercase tracking-wide rounded-xl">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Monthly Fee</p>
                  <p className="font-black text-gray-900 text-base">${talent.fee.toLocaleString()}<span className="text-gray-400 text-xs font-semibold">{talent.period}</span></p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Availability</p>
                  <p className="font-black text-gray-900 text-sm">{availLabel(talent.availability)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Experience</p>
                  <p className="font-black text-gray-900 text-sm">{talent.experience}</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Role Type</p>
                  <RoleTypeBadge type={talent.roleType} />
                </div>
              </div>
            </div>
          </motion.div>

          {/* ─── RIGHT: Calendly Widget (3 cols) ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-3"
          >
            <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-8 py-6 border-b border-gray-100">
                <h3 className="font-black text-lg uppercase tracking-wide text-gray-900">Schedule an Introduction</h3>
                <p className="text-gray-500 text-sm font-medium mt-1">
                  Book a 30-minute intro call with our team to discuss hiring <span className="font-bold text-black">{talent.name}</span>
                </p>
              </div>

              {/* Calendly iframe */}
              <div className="w-full" style={{ minHeight: '700px' }}>
                <iframe
                  src={`${CALENDLY_URL}?hide_gdpr_banner=1&background_color=ffffff&text_color=1a1a1a&primary_color=e11d48`}
                  width="100%"
                  height="700"
                  frameBorder="0"
                  title="Schedule Introduction"
                  className="w-full"
                  style={{ border: 'none', minHeight: '700px' }}
                />
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default RequestIntroPage;

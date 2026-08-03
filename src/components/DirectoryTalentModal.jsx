// Exact profile detail visitors see when opening a talent card on the public directory.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, X } from 'lucide-react';
import { formatDisplayName } from '../lib/formatDisplayName';
import { formatAvailabilityLabel } from '../lib/profileContentPolicy';
import ProfileVerificationBadge from './ProfileVerificationBadge';
import AiInterviewVerifiedBadge from './AiInterviewVerifiedBadge';
import AmbassadorReferredBadge from './AmbassadorReferredBadge';
import TalentModalSkillTags from './TalentModalSkillTags';
import { SHOW_ASSESSMENT_SCORE } from '../lib/talentVerification';

const ROLE_TYPE_LABELS = {
  night: 'Night Role',
  flexible: 'Flexible Hours',
  fulltime: 'Full-Time Remote',
  parttime: 'Part-Time',
};

const Avatar = ({ name, photo, size = 'w-16 h-16 text-lg' }) => {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
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

/**
 * @param {'overlay' | 'page'} variant
 *   overlay — directory popup (backdrop + fixed)
 *   page — same card centered on a page (View Public Profile)
 */
export default function DirectoryTalentModal({
  talent,
  onClose,
  canRequestIntro = true,
  variant = 'overlay',
  footerExtra = null,
}) {
  const navigate = useNavigate();
  if (!talent) return null;

  const card = (
    <motion.div
      key="modal"
      initial={variant === 'overlay' ? { scale: 0.92, opacity: 0, y: 32 } : { opacity: 0, y: 16 }}
      animate={variant === 'overlay' ? { scale: 1, opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      exit={variant === 'overlay' ? { scale: 0.92, opacity: 0, y: 32 } : { opacity: 0 }}
      transition={
        variant === 'overlay'
          ? { type: 'spring', stiffness: 280, damping: 26 }
          : { duration: 0.35 }
      }
      className="bg-white rounded-[2.5rem] max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-black text-white p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-red rounded-full blur-[100px] opacity-20 -mr-16 -mt-16 pointer-events-none" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="absolute top-5 right-5 z-20 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        )}
        <div className="flex items-start gap-6 relative z-10">
          <Avatar name={talent.name} photo={talent.photo} size="w-48 h-48 text-5xl" />
          <div>
            <ProfileVerificationBadge talent={talent} variant="dark" />
            <AiInterviewVerifiedBadge talent={talent} variant="dark" />
            {talent.ambassadorReferred ? (
              <div className="mb-2">
                <AmbassadorReferredBadge variant="dark" />
              </div>
            ) : null}
            <h2 className="text-2xl font-black tracking-tight" title={talent.name}>
              {formatDisplayName(talent.name)}
            </h2>
            <p className="text-red font-bold text-sm uppercase tracking-wide">{talent.role}</p>
            <div className="flex items-center gap-3 mt-2 text-gray-400 text-xs font-semibold">
              <span className="flex items-center gap-1">
                <Briefcase size={10} />
                {talent.experience} experience
              </span>
            </div>
          </div>
        </div>
        {SHOW_ASSESSMENT_SCORE && talent.score > 0 && (
          <div className="mt-6 relative z-10">
            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              <span>Assessment Score</span>
              <span className="text-white">{talent.score}/100</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${talent.score}%` }}
                transition={{ delay: 0.3, duration: 0.7 }}
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-300"
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-8 space-y-6">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">About</p>
          <p className="text-gray-700 text-sm font-medium leading-relaxed">{talent.bio}</p>
        </div>

        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
            Skills & Expertise
          </p>
          <TalentModalSkillTags tags={talent.tags} skillScores={talent.skillScores} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            {
              label: 'Monthly Fee',
              value: `$${(talent.fee || 0).toLocaleString()}${talent.period || '/mo'}`,
            },
            { label: 'Availability', value: formatAvailabilityLabel(talent.availability) },
            {
              label: 'Role Type',
              value: ROLE_TYPE_LABELS[talent.roleType] || 'Flexible Hours',
            },
            { label: 'Experience', value: talent.experience },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                {label}
              </p>
              <p className="font-black text-gray-900 text-sm">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {canRequestIntro && (
            <button
              type="button"
              onClick={() => navigate(`/request-intro?id=${talent.id}`)}
              className="flex-1 min-w-[10rem] py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-colors text-center flex items-center justify-center gap-2 shadow-lg"
            >
              Request Intro <ArrowRight size={14} />
            </button>
          )}
          {footerExtra}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`${canRequestIntro || footerExtra ? 'px-6' : 'flex-1'} py-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest rounded-2xl transition-colors`}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );

  if (variant === 'page') {
    return (
      <div className="min-h-screen bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 pt-28 pb-16">
        {card}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {card}
      </motion.div>
    </AnimatePresence>
  );
}

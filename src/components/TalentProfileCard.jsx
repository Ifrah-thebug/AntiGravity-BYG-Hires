// src/components/TalentProfileCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase } from 'lucide-react';
import { formatDisplayName } from '../lib/formatDisplayName';

const TalentProfileCard = ({ profile }) => {
  const navigate = useNavigate();
  const { id, name, job_title, skills, about, experience_years, photo_url } = profile;
  const displayName = formatDisplayName(name);

  // Generate initials + gradient from name
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const hue = name
    ? (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360
    : 200;

  const aboutSnippet = about
    ? about.length > 90 ? about.slice(0, 90) + '…' : about
    : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22 }}
      onClick={() => navigate(`/talent/${id}`)}
      className="group bg-white border border-gray-100 rounded-3xl overflow-hidden hover:border-red/30 hover:shadow-xl hover:shadow-red/5 transition-all duration-300 flex flex-col cursor-pointer"
    >
      {/* Photo */}
      <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-50">
        {photo_url ? (
          <img
            src={photo_url}
            alt={name}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white font-black text-5xl select-none"
            style={{
              background: `linear-gradient(135deg, hsl(${hue},55%,42%), hsl(${hue + 40},60%,32%))`,
            }}
          >
            {initials}
          </div>
        )}

        {/* Experience badge */}
        {experience_years > 0 && (
          <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm border border-gray-100 text-black text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <Briefcase size={9} />
            <span>{experience_years} yrs</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Name & Title */}
        <div className="h-[52px] flex flex-col justify-start overflow-hidden">
          <p className="text-black font-black text-sm leading-tight line-clamp-1" title={name}>{displayName}</p>
          <p className="text-gray-500 text-[11px] font-normal mt-1 line-clamp-2 leading-snug">{job_title}</p>
        </div>

        {/* About snippet */}
        {aboutSnippet && (
          <p className="text-gray-400 text-[10px] font-medium leading-relaxed line-clamp-2">{aboutSnippet}</p>
        )}

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 items-start min-h-[24px]">
          {skills && skills.slice(0, 2).map((skill) => (
            <span
              key={skill}
              className="px-2 py-1 bg-gray-50 border border-gray-100 text-gray-600 font-bold text-[9px] uppercase tracking-widest rounded-lg whitespace-nowrap"
            >
              {skill}
            </span>
          ))}
          {skills && skills.length > 2 && (
            <span className="px-2 py-1 text-gray-400 font-bold text-[9px] whitespace-nowrap">
              +{skills.length - 2} more
            </span>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/talent/${id}`);
          }}
          className="mt-auto w-full py-3.5 bg-black text-white text-[10px] font-black tracking-widest uppercase rounded-xl hover:bg-red transition-all duration-200 text-center shadow-md shadow-black/5 flex items-center justify-center gap-2"
        >
          View Profile <ArrowRight size={11} />
        </button>
      </div>
    </motion.div>
  );
};

export default TalentProfileCard;

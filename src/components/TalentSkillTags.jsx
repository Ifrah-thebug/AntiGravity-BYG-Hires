import React from 'react';
import { Flame } from 'lucide-react';
import { resolveBestSkill, countOtherSkills } from '../lib/talentSkillsDisplay';

/**
 * Directory card skills: best skill with fire + "+N more" for the rest.
 */
export default function TalentSkillTags({ tags = [], bestSkill, className = '' }) {
  const skills = (tags || []).map((s) => String(s).trim()).filter(Boolean);
  const best = resolveBestSkill(bestSkill, skills);
  const otherCount = countOtherSkills(skills, best);

  if (!best && otherCount === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 items-center overflow-hidden ${className}`}>
      {best && (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red/5 border border-red/25 text-red font-black text-[9px] uppercase tracking-widest rounded-lg whitespace-nowrap max-w-full">
          <Flame size={10} className="shrink-0 fill-red/30 text-red" aria-hidden />
          <span className="truncate">{best}</span>
        </span>
      )}
      {otherCount > 0 && (
        <span className="px-2 py-1 text-gray-400 font-bold text-[9px] whitespace-nowrap">
          +{otherCount} more
        </span>
      )}
    </div>
  );
}

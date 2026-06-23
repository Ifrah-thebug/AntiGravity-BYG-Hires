import React from 'react';
import { Flame } from 'lucide-react';
import { resolveBestSkill, countOtherSkills, getSkillScore } from '../lib/talentSkillsDisplay';
import { scoreBadgeClass } from '../lib/skillAssessmentDisplay';
import { SHOW_ASSESSMENT_SCORE } from '../lib/talentVerification';

/**
 * Directory card skills: best skill with fire + "+N more" for the rest.
 * Wraps to a second row when needed so long skill names are never truncated.
 */
export default function TalentSkillTags({ tags = [], bestSkill, skillScores = {}, className = '' }) {
  const skills = (tags || []).map((s) => String(s).trim()).filter(Boolean);
  const best = resolveBestSkill(bestSkill, skills);
  const otherCount = countOtherSkills(skills, best);
  const bestScore = best ? getSkillScore(skillScores, best) : null;

  if (!best && otherCount === 0) return null;

  return (
    <div className={`flex flex-wrap gap-x-1.5 gap-y-1 items-center content-start min-h-[24px] max-w-full ${className}`}>
      {best && (
        <span className="inline-flex items-center gap-1 max-w-full min-w-0 px-2 py-1 bg-red/5 border border-red/25 text-red font-black text-[9px] uppercase tracking-widest rounded-lg">
          <Flame size={10} className="shrink-0 fill-red/30 text-red" aria-hidden />
          <span className="truncate min-w-0" title={best}>
            {best}
          </span>
          {SHOW_ASSESSMENT_SCORE && bestScore != null && (
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded-md border text-[8px] font-black tabular-nums ${scoreBadgeClass(bestScore)}`}
            >
              {bestScore}
            </span>
          )}
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

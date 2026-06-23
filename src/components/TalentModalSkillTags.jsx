import React from 'react';
import { scoreBadgeClass } from '../lib/skillAssessmentDisplay';
import { getSkillScore } from '../lib/talentSkillsDisplay';
import { SHOW_ASSESSMENT_SCORE } from '../lib/talentVerification';

/** Skill chips with per-skill assessment scores (profile modals). */
export default function TalentModalSkillTags({ tags = [], skillScores = {} }) {
  if (!tags?.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const skillScore = getSkillScore(skillScores, tag);
        return (
          <span
            key={tag}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-red/5 border border-red/10 text-red font-bold text-[10px] uppercase tracking-wide rounded-xl"
          >
            {tag}
            {SHOW_ASSESSMENT_SCORE && skillScore != null && (
              <span className={`shrink-0 px-1.5 py-0.5 rounded-md border text-[9px] font-black tabular-nums ${scoreBadgeClass(skillScore)}`}>
                {skillScore}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

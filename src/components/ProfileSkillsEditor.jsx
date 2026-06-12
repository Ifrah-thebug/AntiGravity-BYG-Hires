import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, Plus, X, ClipboardCheck } from 'lucide-react';
import { resolveBestSkill } from '../lib/talentSkillsDisplay';
import { scoreBadgeClass } from '../lib/skillAssessmentDisplay';

/**
 * Skills list + editable "best skill" (AI-suggested, candidate can change).
 */
export default function ProfileSkillsEditor({
  skills = [],
  bestSkill = '',
  onSkillsChange,
  onBestSkillChange,
  newSkill = '',
  onNewSkillChange,
  onAddSkill,
  onRemoveSkill,
  skillScores = {},
  inProgressSkill = '',
  disabled = false,
  maxSkills = 8,
  showAssessmentLink = false,
}) {
  const isInProgressSkill = (skill) =>
    inProgressSkill &&
    String(skill).trim().toLowerCase() === String(inProgressSkill).trim().toLowerCase();
  const resolvedBest = resolveBestSkill(bestSkill, skills);

  const setAsBest = (skill) => {
    if (!disabled) onBestSkillChange?.(skill);
  };

  const handleRemove = (skill) => {
    if (disabled) return;
    const next = skills.filter((s) => s !== skill);
    onSkillsChange?.(next);
    if (resolvedBest === skill) {
      onBestSkillChange?.(next[0] || '');
    } else {
      onBestSkillChange?.(resolveBestSkill(bestSkill, next));
    }
    onRemoveSkill?.(skill);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          Top skill — shown on directory
        </label>
        <p className="text-[10px] text-gray-400 font-medium">
          Picked from your CV by AI. Tap the flame on any skill below to change it.
        </p>
        {skills.length > 0 ? (
          <select
            value={resolvedBest}
            disabled={disabled}
            onChange={(e) => onBestSkillChange?.(e.target.value)}
            className="block w-full px-4 py-3 bg-gray-50 border border-red/30 rounded-xl text-sm font-bold text-gray-900 focus:border-red focus:bg-white outline-none disabled:opacity-60"
          >
            {skills.map((skill) => (
              <option key={skill} value={skill}>
                {skill}{skillScores[skill] != null ? ` — ${skillScores[skill]}/100` : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-400 font-medium">Add skills below first.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          All skills ({skills.length}/{maxSkills})
        </label>
        <div className="flex flex-wrap gap-2 min-h-[40px]">
          {skills.map((skill) => {
            const isBest = skill === resolvedBest;
            const assessedScore = skillScores[skill];
            const inProgress = isInProgressSkill(skill);
            return (
              <span
                key={skill}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase rounded-full ${
                  inProgress
                    ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-300'
                    : isBest
                      ? 'bg-red text-white ring-2 ring-red/40'
                      : 'bg-black text-white'
                }`}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setAsBest(skill)}
                  title={isBest ? 'Top skill' : 'Set as top skill'}
                  className={`shrink-0 ${disabled ? 'opacity-50' : 'hover:scale-110'} transition-transform`}
                >
                  <Flame
                    size={11}
                    className={isBest ? 'fill-white text-white' : 'text-white/50'}
                  />
                </button>
                {skill}
                {inProgress && (
                  <span className="px-1.5 py-0.5 rounded-md border border-amber-400 bg-amber-200/80 text-[8px] ml-0.5">
                    In progress
                  </span>
                )}
                {assessedScore != null && (
                  <span className={`px-1.5 py-0.5 rounded-md border text-[8px] ml-0.5 ${scoreBadgeClass(assessedScore)}`}>
                    {assessedScore}
                  </span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(skill)}
                    className="hover:text-red-200 ml-0.5"
                  >
                    <X size={9} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
        {!disabled && (
          <div className="flex gap-2">
            <input
              value={newSkill}
              onChange={(e) => onNewSkillChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddSkill?.();
                }
              }}
              placeholder="Add a skill…"
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
            />
            <button
              type="button"
              onClick={onAddSkill}
              disabled={!newSkill?.trim() || skills.length >= maxSkills}
              className="px-4 py-2.5 bg-black text-white text-xs font-black rounded-xl disabled:opacity-40"
            >
              <Plus size={12} className="inline" /> Add
            </button>
          </div>
        )}
        {showAssessmentLink && (
          <Link
            to="/assessment"
            className="inline-flex items-center gap-2 mt-2 text-[10px] font-black text-red uppercase tracking-widest hover:text-black transition-colors"
          >
            <ClipboardCheck size={12} /> Take skills test
          </Link>
        )}
      </div>
    </div>
  );
}

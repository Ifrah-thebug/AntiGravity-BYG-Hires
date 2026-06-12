import { resolveBestSkill } from './talentSkillsDisplay';

const VERIFIED_THRESHOLD = 70;

export function getBestSkillScore(talent) {
  const scores = talent?.skillScores || {};
  const best = resolveBestSkill(talent?.bestSkill, talent?.tags || talent?.skills || []);
  if (best && scores[best] != null) return scores[best];
  const vals = Object.values(scores);
  if (!vals.length) return 0;
  return Math.max(...vals);
}

export function isSkillAssessed(skillScores, skill) {
  if (!skill || !skillScores) return false;
  return skillScores[skill] != null;
}

export function isTalentAssessed(talent) {
  const scores = talent?.skillScores || {};
  return Object.keys(scores).length > 0;
}

export function isTalentVerifiedByAssessment(talent) {
  if (!isTalentAssessed(talent)) return false;
  const bestScore = getBestSkillScore(talent);
  if (bestScore >= VERIFIED_THRESHOLD) return true;
  return Object.values(talent.skillScores).some((s) => s >= VERIFIED_THRESHOLD);
}

export function scoreBadgeClass(score) {
  if (score >= 85) return 'bg-green-500/15 text-green-700 border-green-500/30';
  if (score >= 70) return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
  if (score >= 50) return 'bg-amber-500/15 text-amber-800 border-amber-500/30';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

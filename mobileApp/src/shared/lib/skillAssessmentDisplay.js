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

/**
 * Colors for a score chip — same bands as web `scoreBadgeClass`.
 * @returns {{ backgroundColor: string, color: string, borderColor: string }}
 */
export function scoreBadgeColors(score) {
  if (score >= 85) return { backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d', borderColor: 'rgba(34,197,94,0.3)' };
  if (score >= 70) return { backgroundColor: 'rgba(16,185,129,0.15)', color: '#047857', borderColor: 'rgba(16,185,129,0.3)' };
  if (score >= 50) return { backgroundColor: 'rgba(245,158,11,0.15)', color: '#92400e', borderColor: 'rgba(245,158,11,0.3)' };
  return { backgroundColor: '#f3f4f6', color: '#4b5563', borderColor: '#e5e7eb' };
}

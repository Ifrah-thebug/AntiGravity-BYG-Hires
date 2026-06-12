import { getBestSkillScore, isTalentVerifiedByAssessment } from './skillAssessmentDisplay';

/** Show assessment scores and verified badges on public talent UI. */
export const SHOW_ASSESSMENT_SCORE = true;

export function isTalentVerified(talent) {
  if (!SHOW_ASSESSMENT_SCORE) return false;
  return isTalentVerifiedByAssessment(talent);
}

/** Keep per-skill scores; normalize headline score from best assessed skill. */
export function sanitizeTalentForPublicDisplay(talent) {
  if (!talent) return talent;
  const bestScore = getBestSkillScore(talent);
  return {
    ...talent,
    score: bestScore,
    match: bestScore,
    verified: isTalentVerifiedByAssessment(talent),
  };
}

export function sanitizeTalentList(list) {
  return (list || []).map(sanitizeTalentForPublicDisplay);
}

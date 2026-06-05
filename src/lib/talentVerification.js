/**
 * Phase 1: public talent UI shows no assessment scores; all profiles unverified.
 * Set SHOW_ASSESSMENT_SCORE true when assessment integration ships.
 */
export const SHOW_ASSESSMENT_SCORE = false;

export function isTalentVerified(_talent) {
  if (!SHOW_ASSESSMENT_SCORE) return false;
  const t = _talent || {};
  return Boolean(t.verified) && Number(t.score) > 0;
}

/** Strip score/verified for directory, browse, request intro (demo + Supabase). */
export function sanitizeTalentForPublicDisplay(talent) {
  if (!talent) return talent;
  return {
    ...talent,
    score: 0,
    match: 0,
    verified: false,
  };
}

export function sanitizeTalentList(list) {
  return (list || []).map(sanitizeTalentForPublicDisplay);
}

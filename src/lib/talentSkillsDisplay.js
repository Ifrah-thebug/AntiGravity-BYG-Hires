/**
 * Resolve directory "best skill" from stored value + skills list.
 */
export function resolveBestSkill(bestSkill, skills = []) {
  const list = (skills || []).map((s) => String(s).trim()).filter(Boolean);
  if (!list.length) return '';

  const raw = String(bestSkill || '').trim();
  if (raw) {
    const match = list.find((s) => s.toLowerCase() === raw.toLowerCase());
    if (match) return match;
  }
  return list[0];
}

/** Count of skills excluding the highlighted best skill. */
export function countOtherSkills(skills = [], bestSkill) {
  const list = (skills || []).map((s) => String(s).trim()).filter(Boolean);
  const best = resolveBestSkill(bestSkill, list);
  if (!best) return list.length;
  return list.filter((s) => s !== best).length;
}

/** Case-insensitive score lookup for profile skill labels vs assessment keys. */
export function getSkillScore(skillScores, skill) {
  if (!skillScores || !skill) return null;
  if (skillScores[skill] != null) return skillScores[skill];
  const target = String(skill).trim().toLowerCase();
  const key = Object.keys(skillScores).find((k) => k.trim().toLowerCase() === target);
  return key != null ? skillScores[key] : null;
}

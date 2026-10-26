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

/** Case-insensitive score lookup for profile skill labels vs assessment keys. */
export function getSkillScore(skillScores, skill) {
  if (!skillScores || !skill) return null;
  if (skillScores[skill] != null) return skillScores[skill];
  const target = String(skill).trim().toLowerCase();
  const key = Object.keys(skillScores).find((k) => k.trim().toLowerCase() === target);
  return key != null ? skillScores[key] : null;
}

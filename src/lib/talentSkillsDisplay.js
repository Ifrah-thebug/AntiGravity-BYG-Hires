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

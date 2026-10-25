/**
 * Deep-link into client Workforce hire tab with a directory profile id.
 * Workforce resolves id → email via talent-options.
 */
export function clientHireUrl({ talentId, talentName } = {}) {
  const params = new URLSearchParams();
  if (talentId) params.set('hire', String(talentId));
  if (talentName) params.set('name', String(talentName));
  const qs = params.toString();
  return qs ? `/client/workforce?${qs}` : '/client/workforce';
}

/**
 * Build the URL talent should share externally (LinkedIn, GitHub bio, email, etc.)
 */
export function buildPortfolioShareUrl({
  profileId,
  portfolioPublicEnabled = true,
  shareToken = '',
  origin = typeof window !== 'undefined' ? window.location.origin : '',
} = {}) {
  if (!profileId) return '';
  const base = `${String(origin).replace(/\/$/, '')}/talent/${profileId}/portfolio`;
  if (portfolioPublicEnabled) return base;
  if (shareToken) return `${base}?share=${encodeURIComponent(shareToken)}`;
  return base;
}

export function buildPortfolioPrivateShareUrl({ profileId, shareToken, origin }) {
  if (!profileId || !shareToken) return '';
  const base = `${String(origin || '').replace(/\/$/, '')}/talent/${profileId}/portfolio`;
  return `${base}?share=${encodeURIComponent(shareToken)}`;
}

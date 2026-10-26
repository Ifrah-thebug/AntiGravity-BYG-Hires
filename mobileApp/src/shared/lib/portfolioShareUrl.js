import { env } from '@/core/config/env';

/**
 * Build the URL talent should share externally (LinkedIn, GitHub bio, email, etc.)
 * Points at the public web app — the portfolio storybook lives there for visitors.
 */
export function buildPortfolioShareUrl({
  profileId,
  portfolioPublicEnabled = true,
  shareToken = '',
  origin = env.webAppUrl,
} = {}) {
  if (!profileId) return '';
  const base = `${String(origin).replace(/\/$/, '')}/talent/${profileId}/portfolio`;
  if (portfolioPublicEnabled) return base;
  if (shareToken) return `${base}?share=${encodeURIComponent(shareToken)}`;
  return base;
}

export function buildPortfolioPrivateShareUrl({ profileId, shareToken, origin = env.webAppUrl }) {
  if (!profileId || !shareToken) return '';
  const base = `${String(origin || '').replace(/\/$/, '')}/talent/${profileId}/portfolio`;
  return `${base}?share=${encodeURIComponent(shareToken)}`;
}

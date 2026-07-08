/** When true, show "View Portfolio" in directory / public hire profile. Direct /talent/:id/portfolio links always work when shared. */
export const PUBLIC_PORTFOLIO_ENABLED =
  String(import.meta.env.VITE_PUBLIC_PORTFOLIO_ENABLED || '').trim().toLowerCase() === 'true';

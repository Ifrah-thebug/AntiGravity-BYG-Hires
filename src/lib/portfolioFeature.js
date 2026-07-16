/** Directory / profile may link to portfolio; viewing is gated per-client unless owner. */
export const PUBLIC_PORTFOLIO_ENABLED =
  String(import.meta.env.VITE_PUBLIC_PORTFOLIO_ENABLED || '').trim().toLowerCase() === 'true';

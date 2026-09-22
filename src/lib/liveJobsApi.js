/** Prefer same-origin `/api` (Vite proxy) so the browser never hits CORS on :5001. */
const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

function jobsUrl(path) {
  // In Vite dev, relative /api is proxied. Absolute BASE is for production builds.
  if (BASE && typeof window !== 'undefined' && !import.meta.env.DEV) {
    return `${BASE}${path}`;
  }
  return path;
}

/**
 * @param {{ category?: string, limit?: number }} [opts]
 */
export async function fetchLiveJobs(opts = {}) {
  const qs = new URLSearchParams();
  if (opts.category) qs.set('category', opts.category);
  if (opts.limit) qs.set('limit', String(opts.limit));
  const url = `${jobsUrl('/api/jobs/live')}${qs.toString() ? `?${qs}` : ''}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not load live jobs.');
  }
  return {
    source: data.source || 'remotive',
    jobs: Array.isArray(data.jobs) ? data.jobs : [],
    fetchedAt: data.fetchedAt || null,
  };
}

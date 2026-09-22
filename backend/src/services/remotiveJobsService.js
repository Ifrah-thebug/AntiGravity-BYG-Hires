/**
 * Free Remotive remote-jobs proxy with short in-memory cache.
 * Docs: https://remotive.com/api/remote-jobs
 */
const REMOTIVE_URL = 'https://remotive.com/api/remote-jobs';
const CACHE_TTL_MS = 12 * 60 * 1000;

let cache = {
  fetchedAt: 0,
  jobs: [],
  byCategory: {},
};

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapJob(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? raw.url ?? '');
  if (!id) return null;
  const salary = String(raw.salary || '').trim() || null;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
    : [];
  const description = stripHtml(raw.description).slice(0, 600);
  const logo = String(raw.company_logo || raw.logo || '').trim() || null;
  return {
    id,
    title: String(raw.title || 'Remote role').trim(),
    company: String(raw.company_name || raw.company || 'Company').trim(),
    companyLogo: logo,
    category: String(raw.category || '').trim() || 'Remote',
    tags,
    salary,
    url: String(raw.url || '').trim() || null,
    publishedAt: raw.publication_date || null,
    description: description || null,
  };
}

async function fetchRemotiveJobs({ category, limit = 40 } = {}) {
  const lim = Math.min(80, Math.max(1, Number(limit) || 40));
  const cat = String(category || '').trim();
  const now = Date.now();
  const cacheFresh = now - cache.fetchedAt < CACHE_TTL_MS && cache.jobs.length > 0;

  if (!cacheFresh) {
    const resp = await fetch(`${REMOTIVE_URL}?limit=100`, {
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) {
      throw new Error(`Remotive API error (${resp.status})`);
    }
    const data = await resp.json().catch(() => ({}));
    const list = Array.isArray(data?.jobs) ? data.jobs : [];
    const mapped = list.map(mapJob).filter((j) => j && j.url);
    cache = {
      fetchedAt: now,
      jobs: mapped,
      byCategory: {},
    };
  }

  let jobs = cache.jobs;
  if (cat) {
    const key = cat.toLowerCase();
    jobs = jobs.filter(
      (j) =>
        j.category.toLowerCase().includes(key) ||
        j.tags.some((t) => t.toLowerCase().includes(key)) ||
        j.title.toLowerCase().includes(key)
    );
  }

  return {
    source: 'remotive',
    cached: cacheFresh,
    fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    jobs: jobs.slice(0, lim),
  };
}

module.exports = {
  fetchRemotiveJobs,
};

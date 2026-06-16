const { SitemapStream, streamToPromise } = require('sitemap');
const { createGzip } = require('zlib');
const { supabaseAdmin } = require('../middleware/requireAdmin');

const DEFAULT_SITE_URL = 'https://byghires.com';
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Public indexable static routes — keep in sync with Navbar PUBLIC_NAV_LINKS + Footer links.
 * Do not add legacy/orphan routes that still exist in App.jsx but are not linked on the site.
 */
const STATIC_ROUTES = [
  { url: '/', changefreq: 'daily', priority: 1.0 },
  { url: '/how-it-works', changefreq: 'monthly', priority: 0.8 },
  { url: '/about', changefreq: 'monthly', priority: 0.8 },
  { url: '/talent', changefreq: 'daily', priority: 0.9 },
  { url: '/talent/signup', changefreq: 'weekly', priority: 0.8 },
  { url: '/privacy', changefreq: 'yearly', priority: 0.3 },
];

function getSiteUrl() {
  if (process.env.SITE_URL) {
    return String(process.env.SITE_URL).replace(/\/$/, '');
  }
  const frontend = process.env.FRONTEND_URL;
  if (frontend && !/localhost|127\.0\.0\.1/i.test(frontend)) {
    return String(frontend).replace(/\/$/, '');
  }
  // Never use CLIENT_URI here — it is usually the Vite dev server (localhost:5173).
  return DEFAULT_SITE_URL;
}

function getCacheTtlMs() {
  const parsed = Number(process.env.SITEMAP_CACHE_TTL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CACHE_TTL_MS;
}

async function fetchPublicTalentProfileUrls() {
  if (!supabaseAdmin) {
    console.warn('[sitemap] Supabase admin not configured — static routes only');
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, updated_at, created_at, name, job_title')
    .not('id', 'is', null)
    .not('name', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[sitemap] profiles query failed:', error.message);
    return [];
  }

  return (data || [])
    .filter((row) => String(row.name || '').trim() && String(row.id || '').trim())
    .map((row) => ({
      url: `/talent/${encodeURIComponent(row.id)}`,
      changefreq: 'weekly',
      priority: 0.85,
      lastmod: row.updated_at || row.created_at || undefined,
    }));
}

async function buildSitemapGzipBuffer() {
  const hostname = getSiteUrl();
  const smStream = new SitemapStream({ hostname });
  const pipeline = smStream.pipe(createGzip());

  for (const route of STATIC_ROUTES) {
    smStream.write(route);
  }

  const talentRoutes = await fetchPublicTalentProfileUrls();
  for (const route of talentRoutes) {
    smStream.write(route);
  }

  smStream.end();
  return streamToPromise(pipeline);
}

let sitemapCache = null;

async function getSitemapGzip({ force = false } = {}) {
  const ttl = getCacheTtlMs();
  const now = Date.now();

  if (!force && sitemapCache && now - sitemapCache.generatedAt < ttl) {
    return sitemapCache.buffer;
  }

  const buffer = await buildSitemapGzipBuffer();
  sitemapCache = { buffer, generatedAt: now };
  return buffer;
}

function clearSitemapCache() {
  sitemapCache = null;
}

function getRobotsTxt() {
  const siteUrl = getSiteUrl();
  return `User-agent: *
Allow: /

# Private / authenticated / legacy orphan pages — not for indexing
Disallow: /admin
Disallow: /portal
Disallow: /login
Disallow: /client
Disallow: /talent/setup
Disallow: /talent/activate
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /assessment
Disallow: /case-studies
Disallow: /why-us
Disallow: /remote-sales-team
Disallow: /remote-support-team

Sitemap: ${siteUrl}/sitemap.xml
`;
}

module.exports = {
  STATIC_ROUTES,
  getSiteUrl,
  getRobotsTxt,
  getSitemapGzip,
  clearSitemapCache,
  buildSitemapGzipBuffer,
};

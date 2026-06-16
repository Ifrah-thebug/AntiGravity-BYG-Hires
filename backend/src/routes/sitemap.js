const express = require('express');
const { getSitemapGzip, getSiteUrl } = require('../services/sitemapService');

const router = express.Router();

router.get('/sitemap.xml', async (req, res) => {
  try {
    const buffer = await getSitemapGzip();
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    console.error('[sitemap] generation failed:', error);
    res.status(500).type('text/plain').send('Sitemap unavailable');
  }
});

/** Plain-text index for debugging (lists hostname + route count). */
router.get('/sitemap-info', async (_req, res) => {
  try {
    const buffer = await getSitemapGzip();
    res.json({
      ok: true,
      siteUrl: getSiteUrl(),
      sitemapUrl: `${getSiteUrl()}/sitemap.xml`,
      gzipBytes: buffer.length,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;

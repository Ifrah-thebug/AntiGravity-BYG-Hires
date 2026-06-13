/**
 * Protects internal cron endpoints (VPS crontab → POST with shared secret).
 */

function requireCronSecret(req, res, next) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return res.status(503).json({ error: 'Cron is not configured (CRON_SECRET missing).' });
  }

  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const cronHeader = String(req.headers['x-cron-secret'] || '').trim();
  const token = bearer || cronHeader;

  if (!token || token !== secret) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  return next();
}

module.exports = { requireCronSecret };

const { supabaseAdmin } = require('./requireAdmin');

/** Authenticated Supabase user (any role). Sets req.user. */
async function requireUser(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Server database is not configured.' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Authorization required.' });
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
    req.user = user;
    req.authToken = token;
    return next();
  } catch (err) {
    console.error('[requireUser]', err?.message || err);
    return res.status(500).json({ error: 'Could not verify session.' });
  }
}

module.exports = { requireUser };

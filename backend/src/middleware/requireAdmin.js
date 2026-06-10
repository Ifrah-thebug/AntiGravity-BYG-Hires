const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function requireAdmin(req, res, next) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(503).json({ error: 'Server database is not configured.' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Authorization required.' });
  }

  try {
    // Use the caller's JWT (same as frontend) — avoids service_role "permission denied" on admins RLS.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error } = await userClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    const { data: isAdmin, error: rpcErr } = await userClient.rpc('is_admin_user');
    if (rpcErr) throw rpcErr;
    if (!isAdmin) {
      return res.status(403).json({ error: 'Super admin access required.' });
    }

    req.adminUser = user;
    req.adminAccessToken = token;
    return next();
  } catch (err) {
    console.error('[requireAdmin]', err?.message || err);
    const msg = String(err?.message || '');
    if (/fetch failed|connect timeout|UND_ERR_CONNECT_TIMEOUT/i.test(msg)) {
      return res.status(503).json({
        error: 'Could not reach Supabase. Check your network and try again.',
      });
    }
    return res.status(500).json({ error: 'Could not verify admin access.' });
  }
}

module.exports = { requireAdmin, supabaseAdmin };

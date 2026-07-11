const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('./requireAdmin');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function requireTalentChat(req, res, next) {
  if (!supabaseAdmin || !supabaseUrl || !supabaseAnonKey) {
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin_user');
    if (adminErr) throw adminErr;
    if (isAdmin) {
      return res.status(403).json({ error: 'Chat is for talent accounts only.' });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileErr) throw profileErr;

    if (!profile) {
      const { data: client, error: clientErr } = await supabaseAdmin
        .from('clients')
        .select('id, user_id, account_confirmed_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (clientErr) throw clientErr;
      if (client?.account_confirmed_at) {
        return res.status(403).json({ error: 'Chat is for talent accounts only.' });
      }
    }

    req.authUser = user;
    req.authToken = token;
    req.talentProfileId = profile?.id || null;
    return next();
  } catch (err) {
    console.error('[requireTalentChat]', err?.message || err);
    return res.status(500).json({ error: 'Could not verify access.' });
  }
}

module.exports = { requireTalentChat };

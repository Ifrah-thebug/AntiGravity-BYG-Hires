const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('./requireAdmin');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function requireTalent(req, res, next) {
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

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, name, job_title, skills, best_skill, experience_years, department')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!profile?.user_id) {
      return res.status(403).json({ error: 'Complete your talent profile before taking an assessment.' });
    }

    const talentId = profile.id || profile.user_id;

    req.authUser = user;
    req.authToken = token;
    req.talentProfile = { ...profile, talent_id: talentId };
    return next();
  } catch (err) {
    console.error('[requireTalent]', err?.message || err);
    return res.status(500).json({ error: 'Could not verify talent access.' });
  }
}

module.exports = { requireTalent };

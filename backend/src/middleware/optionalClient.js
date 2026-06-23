const { supabaseAdmin } = require('./requireAdmin');
const introSlots = require('../services/introSlotsService');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Resolve hiring client from Bearer token and/or body email (guest booking flow).
 */
async function resolveClientIdentity(req) {
  const body = req.body || {};
  let client = null;
  let authUser = null;

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (token && supabaseAdmin && supabaseUrl && supabaseAnonKey) {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && user) {
      authUser = user;
      const { data, error: clientErr } = await supabaseAdmin
        .from('clients')
        .select('id, email, name, company, user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (clientErr) throw clientErr;
      client = data || null;
    }
  }

  const bodyEmail = normalizeEmail(body.email || body.clientEmail);
  const bodyName = String(body.name || body.clientName || '').trim();
  const bodyCompany = String(body.company || '').trim();

  if (!client && bodyEmail) {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('id, email, name, company, user_id')
        .ilike('email', bodyEmail)
        .maybeSingle();
      if (error) throw error;
      client = data || null;
    }
  }

  const email = normalizeEmail(client?.email || bodyEmail || authUser?.email);
  const name =
    String(client?.name || bodyName || authUser?.user_metadata?.full_name || '').trim() ||
    (email ? email.split('@')[0] : 'Client');
  const company = String(client?.company || bodyCompany || '').trim();

  if (!email) {
    const err = new Error('Client email is required.');
    err.code = 'CLIENT_EMAIL_REQUIRED';
    throw err;
  }

  let clientId = client?.id || null;
  if (!clientId && supabaseAdmin) {
    clientId = await introSlots.upsertClientByEmail({ email, name, company });
  }

  return {
    authUser,
    clientId,
    email,
    name,
    company,
  };
}

module.exports = { resolveClientIdentity, normalizeEmail };

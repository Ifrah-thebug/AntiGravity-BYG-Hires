const { supabaseAdmin } = require('./requireAdmin');
const clientActivation = require('../services/clientActivationService');

async function requireActivatedClient(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Server database is not configured.' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({
      error: 'Sign in with an activated hiring client account to request an AI interview.',
      code: 'CLIENT_LOGIN_REQUIRED',
    });
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid or expired session. Please sign in again.',
        code: 'CLIENT_LOGIN_REQUIRED',
      });
    }

    const { data: clientRow, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, email, name, company, user_id, account_confirmed_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (clientErr) throw clientErr;

    if (!clientRow) {
      return res.status(403).json({
        error: 'Only activated hiring clients can request AI interviews. Intro booking is still available without an account.',
        code: 'CLIENT_ACCOUNT_REQUIRED',
      });
    }

    const client = {
      id: clientRow.id,
      email: String(clientRow.email || '').trim().toLowerCase(),
      name: clientRow.name || null,
      company: clientRow.company || null,
      userId: clientRow.user_id,
      accountConfirmedAt: clientRow.account_confirmed_at || null,
    };

    if (!clientActivation.isClientActivated(client)) {
      return res.status(403).json({
        error: 'Activate your client account using the link in your intro email before requesting an AI interview.',
        code: 'CLIENT_ACTIVATION_REQUIRED',
      });
    }

    req.authUser = user;
    req.authToken = token;
    req.client = client;
    return next();
  } catch (err) {
    console.error('[requireActivatedClient]', err?.message || err);
    return res.status(500).json({ error: 'Could not verify client access.' });
  }
}

module.exports = { requireActivatedClient };

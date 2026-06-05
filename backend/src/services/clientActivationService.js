/**
 * Post-intro client activation: token issue, email, Supabase auth user + password.
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const db = require('./dbService');
const { sendClientActivationEmail } = require('./resendEmailService');

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

function getTokenTtlHours() {
  const n = parseInt(process.env.CLIENT_ACTIVATION_TOKEN_HOURS, 10);
  return Number.isFinite(n) && n > 0 && n <= 168 ? n : 72;
}

function mapClientRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: (row.email || '').toLowerCase(),
    name: row.name || null,
    company: row.company || null,
    userId: row.user_id || row.userId || null,
    accountConfirmedAt: row.account_confirmed_at || row.accountConfirmedAt || null,
    confirmationToken: row.confirmation_token || row.confirmationToken || null,
    confirmationTokenExpiresAt:
      row.confirmation_token_expires_at || row.confirmationTokenExpiresAt || null,
  };
}

function isClientActivated(client) {
  return Boolean(client?.accountConfirmedAt);
}

async function getClientById(clientId) {
  if (!clientId) return null;

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select(
        'id, email, name, company, user_id, account_confirmed_at, confirmation_token, confirmation_token_expires_at'
      )
      .eq('id', clientId)
      .maybeSingle();
    if (error) throw error;
    return mapClientRow(data);
  }

  const row = await db.getClientById(clientId);
  return mapClientRow(row);
}

async function getClientByToken(token) {
  const normalized = String(token || '').trim();
  if (!normalized) return null;

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select(
        'id, email, name, company, user_id, account_confirmed_at, confirmation_token, confirmation_token_expires_at'
      )
      .eq('confirmation_token', normalized)
      .maybeSingle();
    if (error) throw error;
    return mapClientRow(data);
  }

  const row = await db.getClientByToken(normalized);
  return mapClientRow(row);
}

async function updateClientRecord(clientId, patch) {
  if (!clientId) throw new Error('Client id required');

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from('clients').update(patch).eq('id', clientId);
    if (error) throw error;
    return;
  }

  await db.updateClient(clientId, patch);
}

async function issueActivationToken(clientId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + getTokenTtlHours() * 3600000).toISOString();
  const now = new Date().toISOString();

  await updateClientRecord(clientId, {
    confirmation_token: token,
    confirmation_token_expires_at: expiresAt,
    updated_at: now,
  });

  return token;
}

async function verifyActivationToken(token) {
  const client = await getClientByToken(token);
  if (!client) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'This activation link is invalid.' };
  }

  if (isClientActivated(client)) {
    return {
      ok: false,
      code: 'ALREADY_ACTIVE',
      message: 'This account is already activated. Please log in.',
      email: client.email,
      name: client.name,
    };
  }

  const expires = client.confirmationTokenExpiresAt
    ? new Date(client.confirmationTokenExpiresAt).getTime()
    : 0;
  if (!expires || Date.now() > expires) {
    return {
      ok: false,
      code: 'TOKEN_EXPIRED',
      message: 'This activation link has expired. Book another intro or contact support.',
    };
  }

  if (client.confirmationToken !== String(token || '').trim()) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'This activation link is invalid.' };
  }

  return {
    ok: true,
    client: {
      email: client.email,
      name: client.name,
    },
  };
}

async function findAuthUserIdByEmail(email) {
  if (!supabaseAdmin) return null;

  const normalized = String(email || '').trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((u) => (u.email || '').toLowerCase() === normalized);
    if (match?.id) return match.id;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function ensureSupabaseAuthUser({ email, password, name, existingUserId }) {
  if (!supabaseAdmin) {
    throw new Error('Supabase is not configured on the server.');
  }

  const metadata = { role: 'client', full_name: name || undefined };

  if (existingUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    return data.user?.id || existingUserId;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error) {
    return data.user?.id;
  }

  const msg = String(error.message || '');
  if (/already registered|already exists|duplicate/i.test(msg)) {
    const existingId = await findAuthUserIdByEmail(email);
    if (!existingId) throw error;
    const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      existingId,
      { password, email_confirm: true, user_metadata: metadata }
    );
    if (updateErr) throw updateErr;
    return updated.user?.id || existingId;
  }

  throw error;
}

async function completeClientActivation({ token, password }) {
  const pwd = String(password || '');
  if (pwd.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const verification = await verifyActivationToken(token);
  if (!verification.ok) {
    const err = new Error(verification.message);
    err.code = verification.code;
    throw err;
  }

  const client = await getClientByToken(token);
  if (!client) {
    const err = new Error('This activation link is invalid.');
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const userId = await ensureSupabaseAuthUser({
    email: client.email,
    password: pwd,
    name: client.name,
    existingUserId: client.userId,
  });

  const now = new Date().toISOString();
  await updateClientRecord(client.id, {
    user_id: userId,
    account_confirmed_at: now,
    confirmation_token: null,
    confirmation_token_expires_at: null,
    updated_at: now,
  });

  return {
    email: client.email,
    name: client.name,
    userId,
  };
}

/**
 * After intro booking — send activation email if client has no active account yet.
 */
async function sendPostBookingActivation({ clientId, clientEmail, clientName, talentName }) {
  if (!clientId) {
    return { sent: false, reason: 'no_client_id' };
  }

  const client = await getClientById(clientId);
  if (!client) {
    return { sent: false, reason: 'client_not_found' };
  }

  if (isClientActivated(client)) {
    return { sent: false, reason: 'already_active' };
  }

  const token = await issueActivationToken(clientId);
  const mailResult = await sendClientActivationEmail({
    to: clientEmail || client.email,
    name: clientName || client.name,
    talentName,
    token,
  });

  return {
    sent: true,
    emailId: mailResult.id,
    devActivationUrl:
      process.env.NODE_ENV !== 'production' ? mailResult.activationUrl : undefined,
    redirectedTo: mailResult.redirectedTo,
  };
}

module.exports = {
  getClientById,
  verifyActivationToken,
  completeClientActivation,
  sendPostBookingActivation,
  isClientActivated,
  findAuthUserIdByEmail,
};

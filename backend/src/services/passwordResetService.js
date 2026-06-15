const crypto = require('crypto');
const { supabaseAdmin } = require('../middleware/requireAdmin');
const { findAuthUserIdByEmail } = require('./clientActivationService');
const store = require('./passwordResetStore');
const { sendPasswordResetEmail } = require('./resendEmailService');

const GENERIC_SUCCESS =
  'If an account exists for that email, we sent a password reset link.';

function getTokenTtlHours() {
  const n = parseInt(process.env.PASSWORD_RESET_TOKEN_HOURS, 10);
  return Number.isFinite(n) && n > 0 && n <= 24 ? n : 1;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '').trim()).digest('hex');
}

function tokensMatch(providedToken, storedHash) {
  const providedHash = hashToken(providedToken);
  try {
    const a = Buffer.from(providedHash, 'hex');
    const b = Buffer.from(String(storedHash || ''), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function resolveDisplayName(userId, email) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('user_id', userId)
    .maybeSingle();
  if (profile?.name) return profile.name;

  const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) return '';
  const meta = userData?.user?.user_metadata || {};
  return meta.full_name || meta.name || '';
}

async function requestPasswordReset(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return { ok: true, message: GENERIC_SUCCESS };
  }

  if (!supabaseAdmin) {
    throw new Error('Supabase is not configured on the server.');
  }

  const userId = await findAuthUserIdByEmail(normalized);
  if (!userId) {
    return { ok: true, message: GENERIC_SUCCESS };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + getTokenTtlHours() * 3600000).toISOString();

  await store.invalidateActiveTokensForUser(userId);
  await store.insertToken({
    userId,
    email: normalized,
    tokenHash,
    expiresAt,
  });

  const displayName = await resolveDisplayName(userId, normalized);
  const mailResult = await sendPasswordResetEmail({
    to: normalized,
    name: displayName,
    token: rawToken,
    tokenHours: getTokenTtlHours(),
  });

  return {
    ok: true,
    message: GENERIC_SUCCESS,
    devResetUrl:
      process.env.NODE_ENV !== 'production' ? mailResult.resetUrl : undefined,
  };
}

async function verifyResetToken(token) {
  const trimmed = String(token || '').trim();
  if (!trimmed) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'Missing reset token.' };
  }

  const tokenHash = hashToken(trimmed);
  const row = await store.getActiveByTokenHash(tokenHash);
  if (!row || !tokensMatch(trimmed, row.tokenHash)) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'This reset link is invalid.' };
  }

  const expires = row.expiresAt ? new Date(row.expiresAt).getTime() : 0;
  if (!expires || Date.now() > expires) {
    return {
      ok: false,
      code: 'TOKEN_EXPIRED',
      message: 'This reset link has expired. Request a new one.',
      email: row.email,
    };
  }

  return { ok: true, email: row.email };
}

async function completePasswordReset({ token, password }) {
  const pwd = String(password || '');
  if (pwd.length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    err.code = 'WEAK_PASSWORD';
    throw err;
  }

  const verification = await verifyResetToken(token);
  if (!verification.ok) {
    const err = new Error(verification.message);
    err.code = verification.code;
    throw err;
  }

  const tokenHash = hashToken(token);
  const row = await store.getActiveByTokenHash(tokenHash);
  if (!row) {
    const err = new Error('This reset link is invalid.');
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(row.userId, {
    password: pwd,
  });
  if (error) {
    const err = new Error(error.message || 'Could not update password.');
    err.code = 'RESET_FAILED';
    throw err;
  }

  await store.markUsed(row.id);
  await store.invalidateActiveTokensForUser(row.userId);

  return { ok: true, email: row.email };
}

module.exports = {
  requestPasswordReset,
  verifyResetToken,
  completePasswordReset,
  getTokenTtlHours,
  GENERIC_SUCCESS,
};

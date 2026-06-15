const { supabaseAdmin } = require('../middleware/requireAdmin');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email ? row.email.toLowerCase() : null,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at || null,
    createdAt: row.created_at,
  };
}

async function insertToken({ userId, email, tokenHash, expiresAt }) {
  const { data, error } = await supabaseAdmin
    .from('password_reset_tokens')
    .insert({
      user_id: userId,
      email: String(email || '').trim().toLowerCase(),
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

async function invalidateActiveTokensForUser(userId) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('password_reset_tokens')
    .update({ used_at: now })
    .eq('user_id', userId)
    .is('used_at', null);
  if (error) throw error;
}

async function getActiveByTokenHash(tokenHash) {
  const { data, error } = await supabaseAdmin
    .from('password_reset_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .maybeSingle();
  if (error) throw error;
  return mapRow(data);
}

async function markUsed(id) {
  const { data, error } = await supabaseAdmin
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

module.exports = {
  insertToken,
  invalidateActiveTokensForUser,
  getActiveByTokenHash,
  markUsed,
  mapRow,
};

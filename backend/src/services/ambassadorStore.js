const { supabaseAdmin } = require('../middleware/requireAdmin');

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function mapAmbassador(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name || '',
    email: row.email ? normalizeEmail(row.email) : null,
    userId: row.user_id || null,
    promoTitle: row.promo_title || 'Ambassador perk',
    promoDescription: row.promo_description || '',
    promoReward: row.promo_reward || '',
    active: row.active !== false,
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getByCode(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const { data, error } = await supabaseAdmin
    .from('ambassadors')
    .select('*')
    .ilike('code', normalized)
    .maybeSingle();
  if (error) throw error;
  return mapAmbassador(data);
}

async function getByUserId(userId) {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from('ambassadors')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return mapAmbassador(data);
}

async function getById(id) {
  if (!id) return null;
  const { data, error } = await supabaseAdmin
    .from('ambassadors')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return mapAmbassador(data);
}

async function listAmbassadors(limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('ambassadors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapAmbassador);
}

async function createAmbassador({
  code,
  name,
  email,
  promoTitle,
  promoDescription,
  promoReward,
  notes,
}) {
  const normalized = normalizeCode(code);
  if (!/^[A-Z0-9-]{4,32}$/.test(normalized)) {
    const err = new Error('Code must be 4–32 chars: A–Z, 0–9, hyphens only.');
    err.code = 'INVALID_CODE';
    throw err;
  }

  const { data, error } = await supabaseAdmin
    .from('ambassadors')
    .insert({
      code: normalized,
      name: String(name || '').trim() || 'Ambassador',
      email: email ? normalizeEmail(email) : null,
      promo_title: String(promoTitle || 'Ambassador perk').trim(),
      promo_description: String(
        promoDescription || 'Earn rewards when talent you invite join BYG Hires.'
      ).trim(),
      promo_reward: String(
        promoReward || 'Exclusive ambassador recognition + priority support'
      ).trim(),
      notes: notes || null,
      active: true,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message || '')) {
      const err = new Error('That ambassador code is already taken.');
      err.code = 'CODE_TAKEN';
      throw err;
    }
    throw error;
  }
  return mapAmbassador(data);
}

async function claimAmbassador({ ambassadorId, userId, email, name }) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('ambassadors')
    .update({
      user_id: userId,
      email: normalizeEmail(email),
      name: String(name || '').trim() || 'Ambassador',
      updated_at: now,
    })
    .eq('id', ambassadorId)
    .is('user_id', null)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const err = new Error('This ambassador code was already claimed.');
    err.code = 'ALREADY_CLAIMED';
    throw err;
  }
  return mapAmbassador(data);
}

async function updateAmbassador(ambassadorId, patch = {}) {
  if (!ambassadorId) {
    const err = new Error('Ambassador id is required.');
    err.code = 'INVALID_ID';
    throw err;
  }

  const updates = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const name = String(patch.name || '').trim();
    if (!name) {
      const err = new Error('Name cannot be empty.');
      err.code = 'INVALID_NAME';
      throw err;
    }
    updates.name = name;
  }
  if (patch.email !== undefined) {
    updates.email = patch.email ? normalizeEmail(patch.email) : null;
  }
  if (patch.promoTitle !== undefined) {
    updates.promo_title = String(patch.promoTitle || '').trim() || 'Ambassador perk';
  }
  if (patch.promoDescription !== undefined) {
    updates.promo_description = String(patch.promoDescription || '').trim();
  }
  if (patch.promoReward !== undefined) {
    updates.promo_reward = String(patch.promoReward || '').trim();
  }
  if (patch.notes !== undefined) {
    updates.notes = patch.notes || null;
  }
  if (patch.active !== undefined) {
    updates.active = Boolean(patch.active);
  }

  const { data, error } = await supabaseAdmin
    .from('ambassadors')
    .update(updates)
    .eq('id', ambassadorId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const err = new Error('Ambassador not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return mapAmbassador(data);
}

async function deleteAmbassador(ambassadorId) {
  if (!ambassadorId) {
    const err = new Error('Ambassador id is required.');
    err.code = 'INVALID_ID';
    throw err;
  }

  const existing = await getById(ambassadorId);
  if (!existing) {
    const err = new Error('Ambassador not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const { error } = await supabaseAdmin
    .from('ambassadors')
    .delete()
    .eq('id', ambassadorId);

  if (error) throw error;
  return { deleted: true, id: ambassadorId, code: existing.code };
}

async function countInvitesByAmbassador(ambassadorId) {
  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .select('id, status, activated_at, email, name, invited_at, created_at, original_filename, user_id')
    .eq('ambassador_id', ambassadorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data || [];
  return {
    invites: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      status: r.status,
      userId: r.user_id || null,
      originalFilename: r.original_filename || null,
      invitedAt: r.invited_at,
      activatedAt: r.activated_at,
      createdAt: r.created_at,
    })),
    totals: {
      invited: rows.filter((r) => ['invited', 'activated'].includes(r.status)).length,
      activated: rows.filter((r) => r.status === 'activated' || r.activated_at).length,
      pending: rows.filter((r) => r.status === 'invited' && !r.activated_at).length,
      total: rows.length,
    },
  };
}

function mapPlacement(row) {
  if (!row) return null;
  return {
    id: row.id,
    ambassadorId: row.ambassador_id,
    talentUserId: row.talent_user_id || null,
    talentEmail: row.talent_email || null,
    talentName: row.talent_name || null,
    inviteId: row.invite_id || null,
    placementCycle: row.placement_cycle,
    rewardUsd: Number(row.reward_usd),
    status: row.status || 'demo',
    notes: row.notes || null,
    placedAt: row.placed_at,
    createdAt: row.created_at,
  };
}

async function listPlacements(ambassadorId) {
  const { data, error } = await supabaseAdmin
    .from('ambassador_placements')
    .select('*')
    .eq('ambassador_id', ambassadorId)
    .order('placed_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapPlacement);
}

async function countPlacementsForTalent(ambassadorId, talentEmail) {
  const email = normalizeEmail(talentEmail);
  if (!email) return 0;
  const { data, error } = await supabaseAdmin
    .from('ambassador_placements')
    .select('id')
    .eq('ambassador_id', ambassadorId)
    .ilike('talent_email', email);
  if (error) throw error;
  return (data || []).length;
}

async function createPlacement({
  ambassadorId,
  talentUserId,
  talentEmail,
  talentName,
  inviteId,
  placementCycle,
  rewardUsd,
  status = 'demo',
  notes,
}) {
  const { data, error } = await supabaseAdmin
    .from('ambassador_placements')
    .insert({
      ambassador_id: ambassadorId,
      talent_user_id: talentUserId || null,
      talent_email: talentEmail ? normalizeEmail(talentEmail) : null,
      talent_name: talentName || null,
      invite_id: inviteId || null,
      placement_cycle: placementCycle,
      reward_usd: rewardUsd,
      status: status || 'demo',
      notes: notes || null,
      placed_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapPlacement(data);
}

async function listRecentPlacements(limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('ambassador_placements')
    .select('*')
    .order('placed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapPlacement);
}

async function findLatestAmbassadorInviteByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .select('id, ambassador_id, email, name, user_id, status, activated_at')
    .ilike('email', normalized)
    .not('ambassador_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    ambassadorId: data.ambassador_id,
    email: data.email,
    name: data.name,
    userId: data.user_id,
    status: data.status,
    activatedAt: data.activated_at,
  };
}

module.exports = {
  normalizeCode,
  normalizeEmail,
  mapAmbassador,
  getByCode,
  getByUserId,
  getById,
  listAmbassadors,
  createAmbassador,
  claimAmbassador,
  updateAmbassador,
  deleteAmbassador,
  countInvitesByAmbassador,
  mapPlacement,
  listPlacements,
  listRecentPlacements,
  countPlacementsForTalent,
  createPlacement,
  findLatestAmbassadorInviteByEmail,
};

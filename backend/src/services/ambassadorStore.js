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

function normalizeKind(kind) {
  return String(kind || 'circle').trim().toLowerCase() === 'internal' ? 'internal' : 'circle';
}

function isMissingKindColumn(error) {
  const msg = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return /column .*kind/i.test(msg) || /ambassadors\.kind/i.test(msg);
}

function mapAmbassador(row) {
  if (!row) return null;
  const kind = normalizeKind(row.kind);
  return {
    id: row.id,
    code: row.code,
    name: row.name || '',
    email: row.email ? normalizeEmail(row.email) : null,
    userId: row.user_id || null,
    kind,
    isInternal: kind === 'internal',
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
  kind,
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

  const row = {
    code: normalized,
    name: String(name || '').trim() || 'Ambassador',
    email: email ? normalizeEmail(email) : null,
    kind: normalizeKind(kind),
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
  };

  let { data, error } = await supabaseAdmin.from('ambassadors').insert(row).select('*').single();

  if (error && isMissingKindColumn(error)) {
    delete row.kind;
    ({ data, error } = await supabaseAdmin.from('ambassadors').insert(row).select('*').single());
  }

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
  if (patch.kind !== undefined) {
    updates.kind = normalizeKind(patch.kind);
  }

  let { data, error } = await supabaseAdmin
    .from('ambassadors')
    .update(updates)
    .eq('id', ambassadorId)
    .select('*')
    .maybeSingle();

  if (error && isMissingKindColumn(error) && updates.kind !== undefined) {
    const err = new Error(
      'Ambassador role column is missing. Run supabase/ambassadors_internal.sql in Supabase, then try again.'
    );
    err.code = 'KIND_COLUMN_MISSING';
    throw err;
  }

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

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const profileByUserId = {};
  if (userIds.length) {
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, user_id, name, email, job_title, about, skills, photo_url, experience_years, monthly_fee_usd, directory_fee_usd, availability, role_type, directory_status, cv_url, cal_username, updated_at, created_at, ambassador_id'
      )
      .in('user_id', userIds);
    if (pErr) {
      console.warn('[ambassador] invite profile enrich:', pErr.message);
    } else {
      for (const p of profiles || []) {
        if (p.user_id) profileByUserId[p.user_id] = p;
      }
    }
  }

  return {
    invites: rows.map((r) => {
      const profile = r.user_id ? profileByUserId[r.user_id] || null : null;
      return {
        id: r.id,
        email: r.email,
        name: r.name || profile?.name || null,
        status: r.status,
        userId: r.user_id || null,
        originalFilename: r.original_filename || null,
        invitedAt: r.invited_at,
        activatedAt: r.activated_at,
        createdAt: r.created_at,
        profile: profile
          ? {
              id: profile.id,
              userId: profile.user_id,
              name: profile.name || '',
              email: profile.email || r.email || '',
              jobTitle: profile.job_title || '',
              about: profile.about || '',
              skills: Array.isArray(profile.skills) ? profile.skills : [],
              photoUrl: profile.photo_url || null,
              experienceYears: profile.experience_years ?? null,
              monthlyFeeUsd: profile.monthly_fee_usd ?? null,
              directoryFeeUsd: profile.directory_fee_usd ?? null,
              availability: profile.availability || '',
              roleType: profile.role_type || '',
              directoryStatus: profile.directory_status || 'draft',
              cvUrl: profile.cv_url || '',
              calConnected: Boolean(profile.cal_username),
              updatedAt: profile.updated_at || null,
              createdAt: profile.created_at || null,
              ambassadorReferred: Boolean(profile.ambassador_id),
            }
          : null,
      };
    }),
    totals: {
      // Pipeline totals — include ready/uploaded CV rows, not only emailed invites
      invited: rows.filter((r) => !['skipped', 'expired'].includes(r.status)).length,
      // Activated = completed signup with a linked auth user (not status-only orphans)
      activated: rows.filter(
        (r) => (r.status === 'activated' || r.activated_at) && r.user_id
      ).length,
      pending: rows.filter(
        (r) =>
          ['ready', 'invited', 'uploaded'].includes(r.status) && !r.activated_at && !r.user_id
      ).length,
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
  normalizeKind,
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

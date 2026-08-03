const { supabaseAdmin } = require('../middleware/requireAdmin');
const store = require('./ambassadorStore');
const inviteStore = require('./talentInviteStore');
const { sendInviteEmail, uploadCvToStorage } = require('./talentActivationService');
const { findAuthUserIdByEmail } = require('./clientActivationService');
const { extractEmailFromCv } = require('./cvEmailExtract');
const {
  REWARD_SCHEDULE,
  rewardForCycle,
  buildBrandingKit,
} = require('./ambassadorRewards');
const { v4: uuidv4 } = require('uuid');

function sumRewards(placements, predicate = () => true) {
  return (placements || [])
    .filter(predicate)
    .reduce((sum, p) => sum + (Number(p.rewardUsd) || 0), 0);
}

function buildEarningsSummary(placements, activatedInvites) {
  const list = placements || [];
  const lifetimeEarnedUsd = sumRewards(list);
  const demoUsd = sumRewards(list, (p) => p.status === 'demo');
  const pendingUsd = sumRewards(list, (p) => p.status === 'pending');
  const paidUsd = sumRewards(list, (p) => p.status === 'paid');

  const placementCountsByEmail = {};
  for (const p of list) {
    const key = store.normalizeEmail(p.talentEmail);
    if (!key) continue;
    placementCountsByEmail[key] = (placementCountsByEmail[key] || 0) + 1;
  }

  const pipeline = (activatedInvites || [])
    .filter((inv) => inv.email)
    .map((inv) => {
      const email = store.normalizeEmail(inv.email);
      const nextCycle = (placementCountsByEmail[email] || 0) + 1;
      return {
        inviteId: inv.id,
        email: inv.email,
        name: inv.name,
        activatedAt: inv.activatedAt,
        nextCycle,
        nextRewardUsd: rewardForCycle(nextCycle),
      };
    });

  return {
    demoMode: true,
    paymentsIntegrated: false,
    schedule: REWARD_SCHEDULE,
    totals: {
      lifetimeEarnedUsd,
      demoUsd,
      pendingUsd,
      paidUsd,
      placementCount: list.length,
      pipelineCount: pipeline.length,
    },
    placements: list,
    pipeline,
  };
}

function publicAmbassador(ambassador, extras = {}) {
  if (!ambassador) return null;
  return {
    id: ambassador.id,
    code: ambassador.code,
    name: ambassador.name,
    email: ambassador.email,
    claimed: Boolean(ambassador.userId),
    promoTitle: ambassador.promoTitle,
    promoDescription: ambassador.promoDescription,
    promoReward: ambassador.promoReward,
    active: ambassador.active,
    ...extras,
  };
}

async function verifyCode(code) {
  const ambassador = await store.getByCode(code);
  if (!ambassador || !ambassador.active) {
    return { ok: false, code: 'INVALID_CODE', message: 'That ambassador code is not valid.' };
  }
  return {
    ok: true,
    ambassador: publicAmbassador(ambassador, {
      needsClaim: !ambassador.userId,
      emailHint: ambassador.email
        ? `${ambassador.email.slice(0, 2)}•••@${ambassador.email.split('@')[1] || ''}`
        : null,
    }),
  };
}

async function claimWithPassword({ code, name, email, password }) {
  const pwd = String(password || '');
  if (pwd.length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    err.code = 'WEAK_PASSWORD';
    throw err;
  }

  const verification = await verifyCode(code);
  if (!verification.ok) {
    const err = new Error(verification.message);
    err.code = verification.code;
    throw err;
  }

  const ambassador = await store.getByCode(code);
  if (ambassador.userId) {
    const err = new Error('This code is already linked to an account. Please sign in.');
    err.code = 'ALREADY_CLAIMED';
    throw err;
  }

  const cleanEmail = store.normalizeEmail(email);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    const err = new Error('Enter a valid email.');
    err.code = 'INVALID_EMAIL';
    throw err;
  }

  const existingUserId = await findAuthUserIdByEmail(cleanEmail);
  if (existingUserId) {
    const other = await store.getByUserId(existingUserId);
    if (other && other.id !== ambassador.id) {
      const err = new Error('This email is already linked to another ambassador.');
      err.code = 'EMAIL_IN_USE';
      throw err;
    }
  }

  // Block if email already has talent profile or is admin - keep roles clean
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('user_id')
    .eq('email', cleanEmail)
    .maybeSingle();
  if (profile?.user_id) {
    const err = new Error('This email is already used as talent. Use a different email for ambassador.');
    err.code = 'EMAIL_TALENT';
    throw err;
  }

  let userId = existingUserId;
  if (userId) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: pwd,
      email_confirm: true,
      user_metadata: { role: 'ambassador', full_name: name || ambassador.name },
    });
    if (error) throw error;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: pwd,
      email_confirm: true,
      user_metadata: { role: 'ambassador', full_name: name || ambassador.name },
    });
    if (error) throw error;
    userId = data.user?.id;
  }

  const claimed = await store.claimAmbassador({
    ambassadorId: ambassador.id,
    userId,
    email: cleanEmail,
    name: name || ambassador.name,
  });

  return {
    ambassador: publicAmbassador(claimed),
    email: cleanEmail,
    userId,
  };
}

async function getDashboardForUser(userId) {
  const ambassador = await store.getByUserId(userId);
  if (!ambassador || !ambassador.active) {
    const err = new Error('Ambassador account not found.');
    err.code = 'NOT_AMBASSADOR';
    throw err;
  }

  const { invites, totals } = await store.countInvitesByAmbassador(ambassador.id);
  let placements = [];
  try {
    placements = await store.listPlacements(ambassador.id);
  } catch (err) {
    console.warn(
      '[ambassador] placements table unavailable — run supabase/ambassadors_rewards.sql:',
      err?.message || err
    );
  }
  const activatedInvites = invites.filter(
    (inv) => inv.status === 'activated' || inv.activatedAt
  );
  const earnings = buildEarningsSummary(placements, activatedInvites);
  const promoUnlocked = totals.activated > 0 || earnings.totals.placementCount > 0;

  return {
    ambassador: publicAmbassador(ambassador),
    stats: totals,
    invites,
    earnings,
    branding: buildBrandingKit(ambassador),
    promotion: {
      title: ambassador.promoTitle,
      description: ambassador.promoDescription,
      reward: ambassador.promoReward,
      unlocked: promoUnlocked,
      unlockedCount: totals.activated,
      nextHint: promoUnlocked
        ? 'Keep inviting — every activated or placed talent grows your residual earnings.'
        : 'Invite talent. When they activate and get placed, decaying rewards start stacking.',
    },
  };
}

async function recordHireByAdmin({ talentEmail, clientName, notes }) {
  const cleanEmail = store.normalizeEmail(talentEmail);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    const err = new Error('Enter a valid talent email.');
    err.code = 'INVALID_EMAIL';
    throw err;
  }

  const profile = await inviteStore.findProfileByEmail(cleanEmail);
  if (!profile?.user_id) {
    const err = new Error('No talent profile found for that email.');
    err.code = 'TALENT_NOT_FOUND';
    throw err;
  }

  let ambassadorId = profile.ambassador_id || null;
  let inviteId = null;

  if (!ambassadorId) {
    const invite = await store.findLatestAmbassadorInviteByEmail(cleanEmail);
    if (invite?.ambassadorId) {
      ambassadorId = invite.ambassadorId;
      inviteId = invite.id;
      // Backfill attribution for future hires
      try {
        await supabaseAdmin
          .from('profiles')
          .update({ ambassador_id: ambassadorId, updated_at: new Date().toISOString() })
          .eq('user_id', profile.user_id);
      } catch (attrErr) {
        console.warn('[ambassador] hire backfill attribution:', attrErr?.message || attrErr);
      }
    }
  }

  if (!ambassadorId) {
    const err = new Error(
      'This talent is not linked to an ambassador. Attribution is required before recording a hire reward.'
    );
    err.code = 'NO_AMBASSADOR';
    throw err;
  }

  const ambassador = await store.getById(ambassadorId);
  if (!ambassador || !ambassador.active) {
    const err = new Error('Linked ambassador is missing or inactive.');
    err.code = 'AMBASSADOR_INACTIVE';
    throw err;
  }

  const prior = await store.countPlacementsForTalent(ambassador.id, cleanEmail);
  const placementCycle = prior + 1;
  const rewardUsd = rewardForCycle(placementCycle);
  const client = String(clientName || '').trim();
  const extra = String(notes || '').trim();
  const noteParts = [
    'Admin recorded successful hire.',
    client ? `Client: ${client}.` : null,
    extra || null,
  ].filter(Boolean);

  const placement = await store.createPlacement({
    ambassadorId: ambassador.id,
    talentUserId: profile.user_id,
    talentEmail: cleanEmail,
    talentName: profile.name || null,
    inviteId,
    placementCycle,
    rewardUsd,
    status: 'pending',
    notes: noteParts.join(' '),
  });

  return {
    placement,
    rewardUsd,
    placementCycle,
    ambassador: publicAmbassador(ambassador),
    talent: {
      email: cleanEmail,
      name: profile.name || null,
      userId: profile.user_id,
    },
  };
}

async function listHiresForAdmin(limit = 40) {
  const placements = await store.listRecentPlacements(limit);
  const ambassadors = await store.listAmbassadors(200);
  const byId = Object.fromEntries(ambassadors.map((a) => [a.id, a]));
  return placements.map((p) => ({
    ...p,
    ambassadorCode: byId[p.ambassadorId]?.code || null,
    ambassadorName: byId[p.ambassadorId]?.name || null,
  }));
}

async function listHireableTalentForAdmin() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('user_id, email, name, job_title, directory_status, ambassador_id, updated_at')
    .eq('directory_status', 'approved')
    .not('ambassador_id', 'is', null)
    .order('name', { ascending: true });
  if (error) throw error;

  const ambassadors = await store.listAmbassadors(200);
  const byId = Object.fromEntries(ambassadors.map((a) => [a.id, a]));

  return (data || [])
    .filter((row) => row.email && row.ambassador_id)
    .map((row) => {
      const amb = byId[row.ambassador_id];
      return {
        userId: row.user_id,
        email: store.normalizeEmail(row.email),
        name: row.name || null,
        jobTitle: row.job_title || null,
        directoryStatus: row.directory_status,
        ambassadorId: row.ambassador_id,
        ambassadorCode: amb?.code || null,
        ambassadorName: amb?.name || null,
        updatedAt: row.updated_at,
      };
    });
}

async function inviteTalent({ userId, email, name }) {
  const ambassador = await store.getByUserId(userId);
  if (!ambassador || !ambassador.active) {
    const err = new Error('Ambassador account not found.');
    err.code = 'NOT_AMBASSADOR';
    throw err;
  }

  const cleanEmail = store.normalizeEmail(email);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    const err = new Error('Enter a valid talent email.');
    err.code = 'INVALID_EMAIL';
    throw err;
  }

  const existingProfile = await inviteStore.findProfileByEmail(cleanEmail);
  if (existingProfile) {
    const err = new Error('That email already has a BYG Hires talent profile.');
    err.code = 'ALREADY_REGISTERED';
    throw err;
  }

  const batch = await inviteStore.createBatch({
    invitedBy: userId,
    label: `Ambassador ${ambassador.code} · ${new Date().toISOString().slice(0, 10)}`,
  });

  const invite = await inviteStore.insertInvite({
    batch_id: batch.id,
    email: cleanEmail,
    name: String(name || '').trim() || null,
    original_filename: null,
    cv_storage_path: null,
    cv_mime_type: null,
    parse_status: 'not_started',
    email_extract_status: 'manual',
    invited_by: userId,
    ambassador_id: ambassador.id,
    status: 'ready',
  });

  const sendResult = await sendInviteEmail(invite);
  const refreshed = await inviteStore.getInviteById(invite.id);

  return {
    invite: {
      id: refreshed.id,
      email: refreshed.email,
      name: refreshed.name,
      status: refreshed.status,
      invitedAt: refreshed.invitedAt,
      activatedAt: refreshed.activatedAt,
    },
    sendResult,
  };
}

async function uploadTalentCvs({ userId, files, autoSend = true }) {
  const ambassador = await store.getByUserId(userId);
  if (!ambassador || !ambassador.active) {
    const err = new Error('Ambassador account not found.');
    err.code = 'NOT_AMBASSADOR';
    throw err;
  }

  const list = Array.isArray(files) ? files : [];
  if (!list.length) {
    const err = new Error('No CV files uploaded.');
    err.code = 'NO_FILES';
    throw err;
  }

  const batch = await inviteStore.createBatch({
    invitedBy: userId,
    label: `Ambassador ${ambassador.code} CVs · ${new Date().toISOString().slice(0, 10)}`,
  });

  const results = [];

  for (const file of list) {
    const mime = file.mimetype || 'application/pdf';
    const original = file.originalname || 'cv.pdf';
    const ext = (String(original).match(/\.([^.]+)$/)?.[1] || 'pdf').toLowerCase();

    if (ext !== 'pdf' && !String(mime).includes('pdf')) {
      results.push({ filename: original, ok: false, error: 'Only PDF files are supported.' });
      continue;
    }

    const inviteId = uuidv4();
    const storagePath = `invites/${inviteId}/cv.${ext}`;

    try {
      await uploadCvToStorage(storagePath, file.buffer, mime);
      const extracted = await extractEmailFromCv(file.buffer, mime, original);
      const email = extracted.email;
      const name = extracted.name || null;

      let status = email ? 'ready' : 'uploaded';
      let skipReason = null;
      if (email) {
        const existingProfile = await inviteStore.findProfileByEmail(email);
        if (existingProfile) {
          status = 'skipped';
          skipReason = 'already_registered';
        }
      }

      let invite = await inviteStore.insertInvite({
        id: inviteId,
        batch_id: batch.id,
        email: email || null,
        name,
        original_filename: original,
        cv_storage_path: storagePath,
        cv_mime_type: mime,
        email_extract_status: extracted.emailExtractStatus,
        invited_by: userId,
        ambassador_id: ambassador.id,
        status,
      });

      let sendResult = null;
      if (autoSend && status === 'ready') {
        sendResult = await sendInviteEmail(invite);
        invite = await inviteStore.getInviteById(invite.id);
      }

      results.push({
        ok: true,
        invite: {
          id: invite.id,
          email: invite.email,
          name: invite.name,
          status: invite.status,
          originalFilename: invite.originalFilename,
        },
        skipReason,
        sendResult,
      });
    } catch (err) {
      results.push({
        filename: original,
        ok: false,
        error: err?.message || 'Upload failed',
      });
    }
  }

  return { batchId: batch.id, results };
}

async function updateProfileForUser(userId, { name }) {
  const ambassador = await store.getByUserId(userId);
  if (!ambassador || !ambassador.active) {
    const err = new Error('Ambassador account not found.');
    err.code = 'NOT_AMBASSADOR';
    throw err;
  }

  const updated = await store.updateAmbassador(ambassador.id, { name });

  if (ambassador.userId) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(ambassador.userId, {
        user_metadata: { role: 'ambassador', full_name: updated.name },
      });
    } catch (metaErr) {
      console.warn('[ambassador] name metadata sync:', metaErr?.message || metaErr);
    }
  }

  return { ambassador: publicAmbassador(updated) };
}

async function updateInviteForUser(userId, { inviteId, email, name, send = true }) {
  const ambassador = await store.getByUserId(userId);
  if (!ambassador || !ambassador.active) {
    const err = new Error('Ambassador account not found.');
    err.code = 'NOT_AMBASSADOR';
    throw err;
  }

  const invite = await inviteStore.getInviteById(inviteId);
  if (!invite || invite.ambassadorId !== ambassador.id) {
    const err = new Error('Invite not found for this ambassador.');
    err.code = 'INVITE_NOT_FOUND';
    throw err;
  }

  if (['activated', 'skipped', 'expired'].includes(invite.status)) {
    const err = new Error('This invite can no longer be edited.');
    err.code = 'NOT_EDITABLE';
    throw err;
  }

  const patch = {};

  if (email !== undefined) {
    const cleanEmail = store.normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const err = new Error('Enter a valid email address.');
      err.code = 'INVALID_EMAIL';
      throw err;
    }

    const existingProfile = await inviteStore.findProfileByEmail(cleanEmail);
    if (existingProfile) {
      const err = new Error('That email already has a BYG Hires talent profile.');
      err.code = 'ALREADY_REGISTERED';
      throw err;
    }

    patch.email = cleanEmail;
    patch.email_extract_status = 'manual';
    if (!['invited', 'activated', 'skipped', 'expired'].includes(invite.status)) {
      patch.status = 'ready';
    }
  }

  if (name !== undefined) {
    patch.name = String(name || '').trim() || null;
  }

  if (!Object.keys(patch).length && !send) {
    const err = new Error('No changes provided.');
    err.code = 'NO_CHANGES';
    throw err;
  }

  let updated = Object.keys(patch).length
    ? await inviteStore.updateInvite(invite.id, patch)
    : invite;

  if (send && !updated.email) {
    const err = new Error('Add an email address before sending.');
    err.code = 'INVALID_EMAIL';
    throw err;
  }

  let sendResult = null;
  if (send) {
    sendResult = await sendInviteEmail(updated);
    updated = await inviteStore.getInviteById(invite.id);
  }

  return {
    invite: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      status: updated.status,
      originalFilename: updated.originalFilename,
      invitedAt: updated.invitedAt,
      activatedAt: updated.activatedAt,
    },
    sendResult,
  };
}

module.exports = {
  verifyCode,
  claimWithPassword,
  getDashboardForUser,
  recordHireByAdmin,
  listHiresForAdmin,
  listHireableTalentForAdmin,
  updateProfileForUser,
  updateInviteForUser,
  /** @deprecated use updateInviteForUser */
  updateInviteEmailForUser: (userId, opts) => updateInviteForUser(userId, opts),
  inviteTalent,
  uploadTalentCvs,
  publicAmbassador,
  REWARD_SCHEDULE,
};

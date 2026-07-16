const { supabaseAdmin } = require('../middleware/requireAdmin');
const introSlots = require('./introSlotsService');
const voiceInterviewRequestStore = require('./voiceInterviewRequestStore');
const { randomUUID } = require('crypto');

const PORTFOLIO_COLUMNS =
  'id, profile_id, user_id, title, description, cover_image_url, project_url, tags, sort_order, published, created_at, updated_at';

function assertAdmin() {
  if (!supabaseAdmin) {
    const err = new Error('Supabase admin is not configured.');
    err.code = 'NO_DB';
    throw err;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isMissingTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('portfolio_access_requests') ||
    message.includes('does not exist')
  );
}

function normalizeProject(row) {
  if (!row) return null;
  return {
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : [],
    project_url: String(row.project_url || '').trim(),
    cover_image_url: String(row.cover_image_url || '').trim(),
  };
}

async function resolveTalentKey(talentId) {
  const ctx = await introSlots.resolveTalentContext(talentId);
  return ctx?.talentKey || null;
}

async function getTalentNotificationContact(talentId) {
  return voiceInterviewRequestStore.getTalentNotificationEmail(talentId);
}

async function getClientRequestRow(talentId, clientEmail) {
  assertAdmin();
  const talentKey = await resolveTalentKey(talentId);
  if (!talentKey) return null;

  const email = normalizeEmail(clientEmail);
  if (!email) return null;

  const { data, error } = await supabaseAdmin
    .from('portfolio_access_requests')
    .select('id, talent_id, status, requested_at, responded_at, access_token, client_email, client_name, company')
    .eq('talent_id', talentKey)
    .ilike('client_email', email)
    .in('status', ['pending', 'approved'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data;
}

async function getClientAccessState(talentId, clientEmail) {
  try {
    const row = await getClientRequestRow(talentId, clientEmail);
    if (!row) {
      return { status: 'none', requested: false, approved: false, requestedAt: null, respondedAt: null };
    }
    return {
      status: row.status,
      requested: row.status === 'pending' || row.status === 'approved',
      approved: row.status === 'approved',
      requestedAt: row.requested_at || null,
      respondedAt: row.responded_at || null,
      requestId: row.id,
    };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { status: 'none', requested: false, approved: false, requestedAt: null, respondedAt: null };
    }
    throw err;
  }
}

async function countPendingForTalent(talentId) {
  try {
    assertAdmin();
    const talentKey = await resolveTalentKey(talentId);
    if (!talentKey) return 0;

    const { count, error } = await supabaseAdmin
      .from('portfolio_access_requests')
      .select('id', { count: 'exact', head: true })
      .eq('talent_id', talentKey)
      .eq('status', 'pending');

    if (error) {
      if (isMissingTableError(error)) return 0;
      throw error;
    }
    return count || 0;
  } catch (err) {
    if (isMissingTableError(err)) return 0;
    throw err;
  }
}

async function createRequest({ talentId, clientId, clientEmail, clientName, company }) {
  assertAdmin();
  const talentKey = await resolveTalentKey(talentId);
  if (!talentKey) {
    const err = new Error('Talent profile not found.');
    err.code = 'TALENT_NOT_FOUND';
    throw err;
  }

  const email = normalizeEmail(clientEmail);
  if (!email) {
    const err = new Error('Client email is required.');
    err.code = 'EMAIL_REQUIRED';
    throw err;
  }

  const existing = await getClientRequestRow(talentKey, email);
  if (existing?.status === 'approved') {
    return {
      created: false,
      duplicate: true,
      alreadyApproved: true,
      talentId: talentKey,
      requestId: existing.id,
      requestedAt: existing.requested_at,
    };
  }
  if (existing?.status === 'pending') {
    return {
      created: false,
      duplicate: true,
      alreadyApproved: false,
      talentId: talentKey,
      requestId: existing.id,
      requestedAt: existing.requested_at,
    };
  }

  const { data: declinedRow } = await supabaseAdmin
    .from('portfolio_access_requests')
    .select('id')
    .eq('talent_id', talentKey)
    .ilike('client_email', email)
    .eq('status', 'declined')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const payload = {
    talent_id: talentKey,
    client_id: clientId || null,
    client_email: email,
    client_name: String(clientName || '').trim() || null,
    company: String(company || '').trim() || null,
    status: 'pending',
    access_token: null,
    requested_at: now,
    responded_at: null,
    updated_at: now,
  };

  let data;
  let error;

  if (declinedRow?.id) {
    ({ data, error } = await supabaseAdmin
      .from('portfolio_access_requests')
      .update(payload)
      .eq('id', declinedRow.id)
      .select('id, talent_id, requested_at, client_name, company')
      .single());
  } else {
    ({ data, error } = await supabaseAdmin
      .from('portfolio_access_requests')
      .insert(payload)
      .select('id, talent_id, requested_at, client_name, company')
      .single());
  }

  if (error) throw error;

  return {
    created: true,
    duplicate: false,
    alreadyApproved: false,
    talentId: talentKey,
    requestId: data.id,
    requestedAt: data.requested_at,
    clientName: data.client_name,
    company: data.company,
  };
}

async function listRequestsForTalent(talentId, { status } = {}) {
  try {
    assertAdmin();
    const talentKey = await resolveTalentKey(talentId);
    if (!talentKey) return [];

    let query = supabaseAdmin
      .from('portfolio_access_requests')
      .select('id, talent_id, client_id, client_email, client_name, company, status, requested_at, responded_at')
      .eq('talent_id', talentKey)
      .order('requested_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
    return data || [];
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

async function listRequestsForClient({ clientEmail, clientId }) {
  try {
    assertAdmin();
    const email = normalizeEmail(clientEmail);
    if (!email && !clientId) return [];

    let rows = [];

    if (clientId) {
      const { data, error } = await supabaseAdmin
        .from('portfolio_access_requests')
        .select('id, talent_id, status, requested_at, responded_at, client_email, client_id')
        .eq('client_id', clientId)
        .in('status', ['pending', 'approved'])
        .order('requested_at', { ascending: false });

      if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
      }
      rows = data || [];
    }

    if (email) {
      const { data, error } = await supabaseAdmin
        .from('portfolio_access_requests')
        .select('id, talent_id, status, requested_at, responded_at, client_email, client_id')
        .ilike('client_email', email)
        .in('status', ['pending', 'approved'])
        .order('requested_at', { ascending: false });

      if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
      }

      const seen = new Set(rows.map((r) => r.id));
      for (const row of data || []) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          rows.push(row);
        }
      }
    }

    rows.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));
    if (!rows.length) return [];

    const talentIds = [...new Set(rows.map((r) => r.talent_id).filter(Boolean))];
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, name, job_title')
      .in('id', talentIds);

    if (profileErr && !isMissingTableError(profileErr)) throw profileErr;
    const profileById = new Map((profiles || []).map((p) => [p.id, p]));

    return rows.map((row) => {
      const profile = profileById.get(row.talent_id);
      return {
        requestId: row.id,
        talentId: row.talent_id,
        talentName: profile?.name || null,
        talentRole: profile?.job_title || null,
        status: row.status,
        requestedAt: row.requested_at,
        respondedAt: row.responded_at || null,
        approved: row.status === 'approved',
        pending: row.status === 'pending',
      };
    });
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

async function getRequestForTalent(talentId, requestId) {
  assertAdmin();
  const talentKey = await resolveTalentKey(talentId);
  if (!talentKey) return null;

  const { data, error } = await supabaseAdmin
    .from('portfolio_access_requests')
    .select('id, talent_id, client_id, client_email, client_name, company, status, requested_at, responded_at')
    .eq('id', requestId)
    .eq('talent_id', talentKey)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data;
}

async function respondToRequest({ talentId, requestId, decision }) {
  assertAdmin();
  const row = await getRequestForTalent(talentId, requestId);
  if (!row) {
    const err = new Error('Portfolio request not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (row.status !== 'pending') {
    const err = new Error('This request was already handled.');
    err.code = 'ALREADY_HANDLED';
    throw err;
  }

  const now = new Date().toISOString();
  const patch = {
    status: decision === 'approve' ? 'approved' : 'declined',
    responded_at: now,
    updated_at: now,
    access_token: decision === 'approve' ? randomUUID() : null,
  };

  const { data, error } = await supabaseAdmin
    .from('portfolio_access_requests')
    .update(patch)
    .eq('id', requestId)
    .select('id, status, responded_at, access_token, client_email, client_name, company')
    .single();

  if (error) throw error;
  return data;
}

async function clientHasApprovedAccess(talentId, clientEmail) {
  const row = await getClientRequestRow(talentId, clientEmail);
  return row?.status === 'approved';
}

async function fetchPublishedProjectsForTalent(talentId) {
  assertAdmin();
  const talentKey = await resolveTalentKey(talentId);
  if (!talentKey) return [];

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, directory_status, name, job_title, portfolio_public_enabled, portfolio_share_token')
    .eq('id', talentKey)
    .maybeSingle();

  if (profileErr) throw profileErr;
  if (!profile || String(profile.directory_status || '').toLowerCase() !== 'approved') {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('talent_portfolio_projects')
    .select(PORTFOLIO_COLUMNS)
    .eq('profile_id', talentKey)
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeProject);
}

async function getSharingProfile(talentId) {
  assertAdmin();
  const talentKey = await resolveTalentKey(talentId);
  if (!talentKey) return null;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, directory_status, portfolio_public_enabled, portfolio_share_token')
    .eq('id', talentKey)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data;
}

async function ensureShareToken(talentKey) {
  const profile = await getSharingProfile(talentKey);
  if (!profile) return null;

  if (profile.portfolio_share_token) {
    return {
      portfolioPublicEnabled: profile.portfolio_public_enabled !== false,
      shareToken: profile.portfolio_share_token,
      directoryStatus: profile.directory_status,
    };
  }

  const token = randomUUID();
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ portfolio_share_token: token, updated_at: new Date().toISOString() })
    .eq('id', talentKey)
    .select('portfolio_public_enabled, portfolio_share_token, directory_status')
    .single();

  if (error) throw error;
  return {
    portfolioPublicEnabled: data.portfolio_public_enabled !== false,
    shareToken: data.portfolio_share_token,
    directoryStatus: data.directory_status,
  };
}

async function getTalentSharingSettings(talentId) {
  const talentKey = await resolveTalentKey(talentId);
  if (!talentKey) {
    const err = new Error('Talent profile not found.');
    err.code = 'TALENT_NOT_FOUND';
    throw err;
  }
  return ensureShareToken(talentKey);
}

async function updateTalentSharingSettings(talentId, { portfolioPublicEnabled }) {
  assertAdmin();
  const talentKey = await resolveTalentKey(talentId);
  if (!talentKey) {
    const err = new Error('Talent profile not found.');
    err.code = 'TALENT_NOT_FOUND';
    throw err;
  }

  await ensureShareToken(talentKey);

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      portfolio_public_enabled: Boolean(portfolioPublicEnabled),
      updated_at: new Date().toISOString(),
    })
    .eq('id', talentKey)
    .select('portfolio_public_enabled, portfolio_share_token, directory_status')
    .single();

  if (error) throw error;

  return {
    portfolioPublicEnabled: data.portfolio_public_enabled !== false,
    shareToken: data.portfolio_share_token,
    directoryStatus: data.directory_status,
  };
}

async function rotateTalentShareToken(talentId) {
  assertAdmin();
  const talentKey = await resolveTalentKey(talentId);
  if (!talentKey) {
    const err = new Error('Talent profile not found.');
    err.code = 'TALENT_NOT_FOUND';
    throw err;
  }

  const token = randomUUID();
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      portfolio_share_token: token,
      updated_at: new Date().toISOString(),
    })
    .eq('id', talentKey)
    .select('portfolio_public_enabled, portfolio_share_token, directory_status')
    .single();

  if (error) throw error;

  return {
    portfolioPublicEnabled: data.portfolio_public_enabled !== false,
    shareToken: data.portfolio_share_token,
    directoryStatus: data.directory_status,
  };
}

function normalizeShareToken(value) {
  return String(value || '').trim().toLowerCase();
}

async function resolveViewAccess({ talentId, viewerUserId, viewerEmail, isTalentOwner, shareToken }) {
  const talentKey = await resolveTalentKey(talentId);
  if (!talentKey) {
    return { allowed: false, reason: 'not_found', status: 'none' };
  }

  if (isTalentOwner) {
    return { allowed: true, asOwner: true, status: 'owner', talentId: talentKey };
  }

  const sharing = await getSharingProfile(talentKey);
  const directoryApproved =
    sharing && String(sharing.directory_status || '').toLowerCase() === 'approved';

  if (directoryApproved) {
    const publicEnabled = sharing.portfolio_public_enabled !== false;
    const tokenOk =
      sharing.portfolio_share_token &&
      normalizeShareToken(shareToken) === normalizeShareToken(sharing.portfolio_share_token);

    if (publicEnabled || tokenOk) {
      const projects = await fetchPublishedProjectsForTalent(talentKey);
      return {
        allowed: true,
        asOwner: false,
        status: publicEnabled ? 'public' : 'share_link',
        talentId: talentKey,
        projects,
        portfolioPublicEnabled: publicEnabled,
      };
    }
  }

  const email = normalizeEmail(viewerEmail);
  if (email) {
    const state = await getClientAccessState(talentKey, email);
    if (state.approved) {
      const projects = await fetchPublishedProjectsForTalent(talentKey);
      return {
        allowed: true,
        asOwner: false,
        status: 'approved',
        talentId: talentKey,
        projects,
      };
    }

    return {
      allowed: false,
      reason: state.status === 'pending' ? 'pending' : 'not_requested',
      status: state.status,
      talentId: talentKey,
      requestedAt: state.requestedAt,
      portfolioPublicEnabled: sharing?.portfolio_public_enabled !== false,
    };
  }

  return {
    allowed: false,
    reason: directoryApproved && sharing?.portfolio_public_enabled === false ? 'share_required' : 'login_required',
    status: directoryApproved && sharing?.portfolio_public_enabled === false ? 'share_required' : 'login_required',
    talentId: talentKey,
    portfolioPublicEnabled: sharing?.portfolio_public_enabled !== false,
  };
}

module.exports = {
  createRequest,
  getClientAccessState,
  listRequestsForTalent,
  listRequestsForClient,
  respondToRequest,
  countPendingForTalent,
  fetchPublishedProjectsForTalent,
  resolveViewAccess,
  getTalentSharingSettings,
  updateTalentSharingSettings,
  rotateTalentShareToken,
  getTalentNotificationContact,
  resolveTalentKey,
  normalizeEmail,
  isMissingTableError,
};

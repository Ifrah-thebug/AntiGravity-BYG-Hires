const { supabaseAdmin } = require('../middleware/requireAdmin');
const introSlots = require('./introSlotsService');
const voiceInterviewStore = require('./voiceInterviewStore');

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
    message.includes('voice_interview_requests') ||
    message.includes('does not exist')
  );
}

async function resolveTalentKey(talentId) {
  const ctx = await introSlots.resolveTalentContext(talentId);
  return ctx?.talentKey || null;
}

async function hasActiveRequest(talentId) {
  try {
    assertAdmin();
    const talentKey = await resolveTalentKey(talentId);
    if (!talentKey) return false;

    const { data, error } = await supabaseAdmin
      .from('voice_interview_requests')
      .select('id')
      .eq('talent_id', talentKey)
      .eq('status', 'active')
      .limit(1);

    if (error) {
      if (isMissingTableError(error)) return false;
      throw error;
    }
    return (data || []).length > 0;
  } catch (err) {
    if (isMissingTableError(err)) return false;
    throw err;
  }
}

async function getClientRequestState(talentId, clientEmail) {
  try {
    assertAdmin();
    const talentKey = await resolveTalentKey(talentId);
    if (!talentKey) return { requested: false, requestedAt: null };

    const email = normalizeEmail(clientEmail);
    if (!email) return { requested: false, requestedAt: null };

    const { data, error } = await supabaseAdmin
      .from('voice_interview_requests')
      .select('id, requested_at, status')
      .eq('talent_id', talentKey)
      .eq('status', 'active')
      .ilike('client_email', email)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) return { requested: false, requestedAt: null };
      throw error;
    }

    return {
      requested: Boolean(data),
      requestedAt: data?.requested_at || null,
    };
  } catch (err) {
    if (isMissingTableError(err)) return { requested: false, requestedAt: null };
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

  const existing = await getClientRequestState(talentKey, email);
  if (existing.requested) {
    return { created: false, duplicate: true, talentId: talentKey, requestedAt: existing.requestedAt };
  }

  const payload = {
    talent_id: talentKey,
    client_id: clientId || null,
    client_email: email,
    client_name: String(clientName || '').trim() || null,
    company: String(company || '').trim() || null,
    status: 'active',
    requested_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('voice_interview_requests')
    .insert(payload)
    .select('id, talent_id, requested_at')
    .single();

  if (error) throw error;
  return { created: true, duplicate: false, talentId: talentKey, requestId: data.id, requestedAt: data.requested_at };
}

async function listActiveRequestsForClient({ clientEmail, clientId }) {
  try {
    assertAdmin();
    const email = normalizeEmail(clientEmail);
    if (!email && !clientId) return [];

    let rows = [];

    if (clientId) {
      const { data, error } = await supabaseAdmin
        .from('voice_interview_requests')
        .select('id, talent_id, requested_at, status, client_email, client_id')
        .eq('status', 'active')
        .eq('client_id', clientId)
        .order('requested_at', { ascending: false });

      if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
      }
      rows = data || [];
    }

    if (email) {
      const { data, error } = await supabaseAdmin
        .from('voice_interview_requests')
        .select('id, talent_id, requested_at, status, client_email, client_id')
        .eq('status', 'active')
        .ilike('client_email', email)
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
      .select('id, name, job_title, email, user_id')
      .in('id', talentIds);

    if (profileErr && !isMissingTableError(profileErr)) throw profileErr;
    const profileById = new Map((profiles || []).map((p) => [p.id, p]));

    const emailsByTalentId = {};
    for (const profile of profiles || []) {
      let talentEmail = String(profile.email || '').trim();
      if (!talentEmail && profile.user_id) {
        const { data, error: authErr } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        if (!authErr && data?.user?.email) {
          talentEmail = String(data.user.email).trim();
        }
      }
      if (talentEmail) emailsByTalentId[profile.id] = talentEmail;
    }

    const latestByTalent = await voiceInterviewStore.getLatestResultsByTalentIds(
      talentIds,
      emailsByTalentId
    );

    return rows.map((row) => {
      const latest = latestByTalent[row.talent_id] || null;
      const score = latest?.interview_score ?? null;
      const profile = profileById.get(row.talent_id);
      return {
        requestId: row.id,
        talentId: row.talent_id,
        talentName: profile?.name || null,
        talentRole: profile?.job_title || null,
        requestedAt: row.requested_at,
        hasCompleted: Boolean(latest),
        interviewScore: score,
        completedAt: latest?.completed_at || null,
        aiInterviewVerified: voiceInterviewStore.isScoreVerified(score),
      };
    });
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

async function getTalentNotificationEmail(talentId) {
  const ctx = await introSlots.resolveTalentContext(talentId);
  if (!ctx) return { email: '', name: '' };

  let email = String(ctx.email || '').trim();
  if (!email && ctx.userId) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(ctx.userId);
    if (!error && data?.user?.email) {
      email = String(data.user.email).trim();
    }
  }

  return {
    email,
    name: String(ctx.name || '').trim(),
    talentKey: ctx.talentKey,
  };
}

module.exports = {
  hasActiveRequest,
  getClientRequestState,
  createRequest,
  listActiveRequestsForClient,
  getTalentNotificationEmail,
  resolveTalentKey,
  normalizeEmail,
};

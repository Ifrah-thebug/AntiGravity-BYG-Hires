const { supabaseAdmin } = require('../middleware/requireAdmin');

const RESULT_COLUMNS =
  'id, candidate_email, talent_id, role_title, vapi_call_id, interview_score, interview_summary, experience, motivation, communication, problem_solving, work_style_and_collaboration, created_at';

const AI_INTERVIEW_VERIFIED_THRESHOLD = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function filterValidTalentIds(talentIds) {
  return [...new Set((talentIds || []).map((id) => String(id || '').trim()).filter(isValidUuid))];
}

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

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    interview_score: toNumber(row.interview_score),
    interview_summary: String(row.interview_summary || '').trim() || null,
    role_title: String(row.role_title || '').trim() || null,
    completed_at: row.created_at,
    dimensions: {
      experience: toNumber(row.experience),
      motivation: toNumber(row.motivation),
      communication: toNumber(row.communication),
      problem_solving: toNumber(row.problem_solving),
      work_style_and_collaboration: toNumber(row.work_style_and_collaboration),
    },
  };
}

function isMissingTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('voice_interview_results') ||
    message.includes('does not exist')
  );
}

async function listResultsForTalent({ email, talentId }) {
  assertAdmin();
  const normalizedEmail = normalizeEmail(email);
  const collected = [];
  const seen = new Set();

  const pushRows = (rows) => {
    for (const row of rows || []) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      collected.push(row);
    }
  };

  if (talentId && isValidUuid(talentId)) {
    const { data, error } = await supabaseAdmin
      .from('voice_interview_results')
      .select(RESULT_COLUMNS)
      .eq('talent_id', talentId)
      .order('created_at', { ascending: false });

    if (error && !isMissingTableError(error)) throw error;
    if (!error) pushRows(data);
  }

  if (normalizedEmail) {
    const { data, error } = await supabaseAdmin
      .from('voice_interview_results')
      .select(RESULT_COLUMNS)
      .ilike('candidate_email', normalizedEmail)
      .order('created_at', { ascending: false });

    if (error && !isMissingTableError(error)) throw error;
    if (!error) pushRows(data);
  }

  collected.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return collected;
}

async function getInterviewStatus({ email, talentId, interviewUnlocked = false }) {
  try {
    const rows = await listResultsForTalent({ email, talentId });
    const latest = rows[0] ? mapRow(rows[0]) : null;
    return {
      attemptCount: rows.length,
      hasCompleted: rows.length > 0,
      latestResult: latest,
      interviewUnlocked,
      aiInterviewVerified: isScoreVerified(latest?.interview_score),
    };
  } catch (err) {
    if (isMissingTableError(err)) {
      return {
        attemptCount: 0,
        hasCompleted: false,
        latestResult: null,
        interviewUnlocked,
        aiInterviewVerified: false,
      };
    }
    throw err;
  }
}

function isScoreVerified(score) {
  const n = toNumber(score);
  return n != null && n > AI_INTERVIEW_VERIFIED_THRESHOLD;
}

async function getLatestResultForTalent({ talentId, email = '' }) {
  try {
    const rows = await listResultsForTalent({ email, talentId });
    return rows[0] ? mapRow(rows[0]) : null;
  } catch (err) {
    if (isMissingTableError(err)) return null;
    throw err;
  }
}

/** @deprecated Use getLatestResultForTalent — kept for callers passing id only. */
async function getLatestResultForTalentId(talentId, email = '') {
  return getLatestResultForTalent({ talentId, email });
}

/** Latest mapped result per talent id (matches by talent_id or candidate email). */
async function getLatestResultsByTalentIds(talentIds, emailsByTalentId = {}) {
  try {
    assertAdmin();
    const ids = filterValidTalentIds(talentIds);
    if (!ids.length) return {};

    const collected = [];
    const seen = new Set();

    const pushRows = (rows) => {
      for (const row of rows || []) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        collected.push(row);
      }
    };

    const { data: byTalentId, error: idErr } = await supabaseAdmin
      .from('voice_interview_results')
      .select(RESULT_COLUMNS)
      .in('talent_id', ids)
      .order('created_at', { ascending: false });

    if (idErr && !isMissingTableError(idErr)) throw idErr;
    pushRows(byTalentId);

    const emails = [
      ...new Set(ids.map((id) => normalizeEmail(emailsByTalentId[id])).filter(Boolean)),
    ];

    for (const email of emails) {
      const { data, error } = await supabaseAdmin
        .from('voice_interview_results')
        .select(RESULT_COLUMNS)
        .ilike('candidate_email', email)
        .order('created_at', { ascending: false });

      if (error && !isMissingTableError(error)) throw error;
      pushRows(data);
    }

    const map = {};
    for (const id of ids) {
      const email = normalizeEmail(emailsByTalentId[id]);
      const matching = collected.filter(
        (row) =>
          row.talent_id === id ||
          (email && normalizeEmail(row.candidate_email) === email)
      );
      matching.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (matching[0]) map[id] = mapRow(matching[0]);
    }
    return map;
  } catch (err) {
    if (isMissingTableError(err)) return {};
    throw err;
  }
}

/** Latest result per talent where score > threshold — for public profile badges. */
async function getPublicAiVerifiedByTalentIds(talentIds) {
  try {
    assertAdmin();
    const ids = filterValidTalentIds(talentIds);
    if (!ids.length) return {};

    const collected = [];
    const seen = new Set();

    const pushRows = (rows) => {
      for (const row of rows || []) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        collected.push(row);
      }
    };

    const { data, error } = await supabaseAdmin
      .from('voice_interview_results')
      .select('id, talent_id, candidate_email, interview_score, created_at')
      .in('talent_id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) return {};
      if (String(error.message || '').includes('invalid input syntax for type uuid')) return {};
      throw error;
    }
    pushRows(data);

    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, user_id')
      .in('id', ids);

    if (profileErr && !isMissingTableError(profileErr)) throw profileErr;

    const emailsByTalentId = {};
    for (const profile of profiles || []) {
      let email = normalizeEmail(profile.email);
      if (!email && profile.user_id) {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(
          profile.user_id
        );
        if (!authErr && authData?.user?.email) {
          email = normalizeEmail(authData.user.email);
        }
      }
      if (email) emailsByTalentId[profile.id] = email;
    }

    const emails = [...new Set(ids.map((id) => emailsByTalentId[id]).filter(Boolean))];
    for (const email of emails) {
      const { data: emailRows, error: emailErr } = await supabaseAdmin
        .from('voice_interview_results')
        .select('id, talent_id, candidate_email, interview_score, created_at')
        .ilike('candidate_email', email)
        .order('created_at', { ascending: false });

      if (emailErr && !isMissingTableError(emailErr)) throw emailErr;
      pushRows(emailRows);
    }

    const map = {};
    for (const id of ids) {
      const email = normalizeEmail(emailsByTalentId[id]);
      const matching = collected.filter(
        (row) => row.talent_id === id || (email && normalizeEmail(row.candidate_email) === email)
      );
      matching.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latest = matching[0];
      if (!latest) continue;
      const score = toNumber(latest.interview_score);
      map[id] = {
        aiInterviewVerified: score != null && score > AI_INTERVIEW_VERIFIED_THRESHOLD,
        interviewScore: score,
      };
    }
    return map;
  } catch (err) {
    if (isMissingTableError(err)) return {};
    throw err;
  }
}

module.exports = {
  getInterviewStatus,
  listResultsForTalent,
  getLatestResultForTalent,
  getLatestResultForTalentId,
  getLatestResultsByTalentIds,
  mapRow,
  isScoreVerified,
  getPublicAiVerifiedByTalentIds,
  AI_INTERVIEW_VERIFIED_THRESHOLD,
  isValidUuid,
  filterValidTalentIds,
};

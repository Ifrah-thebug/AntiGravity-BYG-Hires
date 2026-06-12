const { supabaseAdmin } = require('../middleware/requireAdmin');

function assertAdmin() {
  if (!supabaseAdmin) {
    const err = new Error('Supabase admin is not configured.');
    err.code = 'NO_DB';
    throw err;
  }
}

function normalizeSkill(skill) {
  return String(skill || '').trim();
}

async function getLatestCompletedByTalent(talentId) {
  assertAdmin();
  const { data, error } = await supabaseAdmin
    .from('skill_assessments')
    .select('id, skill, total_score, submitted_at, status')
    .eq('talent_id', talentId)
    .eq('status', 'completed')
    .order('submitted_at', { ascending: false });

  if (error) throw error;

  const bySkill = {};
  for (const row of data || []) {
    const key = normalizeSkill(row.skill).toLowerCase();
    if (!bySkill[key]) {
      bySkill[key] = {
        id: row.id,
        skill: row.skill,
        total_score: row.total_score,
        submitted_at: row.submitted_at,
      };
    }
  }
  return bySkill;
}

async function getActiveSession(talentId) {
  assertAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('skill_assessments')
    .select('*')
    .eq('talent_id', talentId)
    .eq('status', 'in_progress')
    .gt('expires_at', now)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getSessionById(sessionId, talentId) {
  assertAdmin();
  const { data, error } = await supabaseAdmin
    .from('skill_assessments')
    .select('*')
    .eq('id', sessionId)
    .eq('talent_id', talentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function expireStaleSessions(talentId) {
  assertAdmin();
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('skill_assessments')
    .update({ status: 'expired', updated_at: now })
    .eq('talent_id', talentId)
    .eq('status', 'in_progress')
    .lt('expires_at', now);
}

/** Abandon any live in-progress session so a new test can start with fresh questions. */
async function abandonActiveSessions(talentId) {
  assertAdmin();
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('skill_assessments')
    .update({ status: 'expired', updated_at: now })
    .eq('talent_id', talentId)
    .eq('status', 'in_progress')
    .gt('expires_at', now);
}

async function createSession({
  talentId,
  userId,
  skill,
  questions,
  durationMinutes = 25,
}) {
  assertAdmin();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from('skill_assessments')
    .insert({
      talent_id: talentId,
      user_id: userId,
      skill: normalizeSkill(skill),
      status: 'in_progress',
      questions,
      answers: {},
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function saveDraft(sessionId, talentId, answers) {
  assertAdmin();
  const { data, error } = await supabaseAdmin
    .from('skill_assessments')
    .update({
      answers,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('talent_id', talentId)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function completeSession(sessionId, talentId, {
  answers,
  scoreBreakdown,
  totalScore,
  feedbackSummary,
}) {
  assertAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('skill_assessments')
    .update({
      answers,
      score_breakdown: scoreBreakdown,
      total_score: totalScore,
      feedback_summary: feedbackSummary,
      status: 'completed',
      submitted_at: now,
      updated_at: now,
    })
    .eq('id', sessionId)
    .eq('talent_id', talentId)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getCompletedScoresForTalents(talentIds) {
  assertAdmin();
  if (!talentIds?.length) return [];

  const { data, error } = await supabaseAdmin
    .from('skill_assessments')
    .select('talent_id, skill, total_score, submitted_at')
    .in('talent_id', talentIds)
    .eq('status', 'completed')
    .order('submitted_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

module.exports = {
  getLatestCompletedByTalent,
  getActiveSession,
  getSessionById,
  expireStaleSessions,
  abandonActiveSessions,
  createSession,
  saveDraft,
  completeSession,
  getCompletedScoresForTalents,
  normalizeSkill,
};

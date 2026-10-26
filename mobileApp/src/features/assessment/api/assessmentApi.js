import { supabase } from '@/core/api/supabase';
import { apiUrl, authHeaders, isNetworkError, parseJsonOrThrow } from '@/core/api/http';

async function jsonHeaders() {
  return { ...(await authHeaders()), 'Content-Type': 'application/json' };
}

async function apiRequest(path, options) {
  try {
    const res = await fetch(apiUrl(path), options);
    return parseJsonOrThrow(res);
  } catch (err) {
    if (isNetworkError(err)) {
      throw new Error('Could not reach the assessment server. Make sure the backend is running, then try again.');
    }
    throw err;
  }
}

export async function fetchAssessmentStatus() {
  return apiRequest('/api/assessment/status', { headers: await jsonHeaders() });
}

export async function startAssessment(skill) {
  return apiRequest('/api/assessment/start', {
    method: 'POST',
    headers: await jsonHeaders(),
    body: JSON.stringify({ skill }),
  });
}

export async function fetchAssessmentSession(sessionId) {
  return apiRequest(`/api/assessment/session/${sessionId}`, { headers: await jsonHeaders() });
}

export async function saveAssessmentDraft(sessionId, answers) {
  return apiRequest(`/api/assessment/session/${sessionId}/draft`, {
    method: 'PATCH',
    headers: await jsonHeaders(),
    body: JSON.stringify({ answers }),
  });
}

export async function submitAssessment(sessionId, answers) {
  return apiRequest('/api/assessment/submit', {
    method: 'POST',
    headers: await jsonHeaders(),
    body: JSON.stringify({ sessionId, answers }),
  });
}

/** Public: latest completed scores per skill (used on the portfolio storybook). */
export async function fetchPublicSkillScores(talentIds) {
  if (!talentIds?.length) return {};

  const { data, error } = await supabase
    .from('skill_assessments')
    .select('talent_id, skill, total_score, submitted_at')
    .in('talent_id', talentIds)
    .eq('status', 'completed')
    .order('submitted_at', { ascending: false });

  if (error) {
    console.warn('[fetchPublicSkillScores]', error.message);
    return {};
  }

  const map = {};
  for (const row of data || []) {
    const tid = row.talent_id;
    if (!map[tid]) map[tid] = {};
    const skillKey = String(row.skill).toLowerCase();
    if (!map[tid][skillKey]) {
      map[tid][skillKey] = { skill: row.skill, score: row.total_score };
    }
  }
  return map;
}

export function buildTalentSkillScores(scoreMap, talentId, skills = []) {
  const out = {};
  const bySkill = scoreMap?.[talentId] || {};
  for (const skill of skills) {
    const entry = bySkill[String(skill).toLowerCase()];
    if (entry) out[skill] = entry.score;
  }
  return out;
}

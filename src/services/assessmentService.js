import { supabase } from '../lib/supabase';

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Please log in to continue.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    err.retryable = data.retryable !== false;
    throw err;
  }
  return data;
}

async function apiRequest(url, options) {
  try {
    const res = await fetch(url, options);
    return parseJson(res);
  } catch (err) {
    const msg = String(err?.message || '');
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
      throw new Error(
        'Could not reach the assessment server. Make sure the backend is running, then try again.'
      );
    }
    throw err;
  }
}

export async function fetchAssessmentStatus() {
  return apiRequest(`${BASE}/api/assessment/status`, {
    headers: await authHeaders(),
  });
}

export async function startAssessment(skill) {
  return apiRequest(`${BASE}/api/assessment/start`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ skill }),
  });
}

export async function fetchAssessmentSession(sessionId) {
  return apiRequest(`${BASE}/api/assessment/session/${sessionId}`, {
    headers: await authHeaders(),
  });
}

export async function saveAssessmentDraft(sessionId, answers) {
  return apiRequest(`${BASE}/api/assessment/session/${sessionId}/draft`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ answers }),
  });
}

export async function submitAssessment(sessionId, answers) {
  return apiRequest(`${BASE}/api/assessment/submit`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ sessionId, answers }),
  });
}

/** Public: latest completed scores per skill for directory profiles. */
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
      map[tid][skillKey] = {
        skill: row.skill,
        score: row.total_score,
      };
    }
  }
  return map;
}

export function skillScoreForTalent(scoreMap, talentId, skill) {
  if (!scoreMap?.[talentId] || !skill) return null;
  const entry = scoreMap[talentId][String(skill).toLowerCase()];
  return entry?.score ?? null;
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

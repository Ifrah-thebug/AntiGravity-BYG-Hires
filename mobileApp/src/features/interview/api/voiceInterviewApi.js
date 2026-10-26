import { apiUrl, authHeaders, parseJsonOrThrow } from '@/core/api/http';

async function jsonHeaders() {
  return { ...(await authHeaders()), 'Content-Type': 'application/json' };
}

export async function fetchVoiceInterviewContext() {
  const res = await fetch(apiUrl('/api/voice-interview/context'), { headers: await jsonHeaders() });
  return parseJsonOrThrow(res);
}

export async function fetchVoiceInterviewStatus() {
  const res = await fetch(apiUrl('/api/voice-interview/status'), { headers: await jsonHeaders() });
  return parseJsonOrThrow(res);
}

export async function fetchPublicAiInterviewBadges(talentIds) {
  if (!talentIds?.length) return {};
  const params = new URLSearchParams({ talentIds: talentIds.join(',') });
  const res = await fetch(apiUrl(`/api/voice-interview/public-badges?${params}`));
  const data = await parseJsonOrThrow(res);
  return data.badges || {};
}

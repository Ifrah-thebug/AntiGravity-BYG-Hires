import { apiUrl, readJson } from '@/core/api/http';

/** Cal.com OAuth start — opened in the system browser (same URL as web). */
export function buildConnectCalendarUrl(user) {
  if (!user?.id) return '';
  return apiUrl(
    `/api/cal/connect/start?talentId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email || '')}`
  );
}

/** True when the talent has at least one open/held intro slot. */
export async function fetchIntroSlotsPublished(talentId) {
  if (!talentId) return false;
  try {
    const resp = await fetch(apiUrl(`/api/intro/my-slots/${encodeURIComponent(talentId)}`));
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return false;
    return (data.slots || []).some((s) => s.status === 'open' || s.status === 'held');
  } catch {
    return false;
  }
}

/** Mutual HR ∩ talent availability from Cal + already published slots. */
export async function fetchPublishGrid(talentId, timeZone) {
  const params = new URLSearchParams({ timeZone });
  const resp = await fetch(apiUrl(`/api/intro/publish-grid/${encodeURIComponent(talentId)}?${params}`));
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not load availability');
  return data;
}

export async function saveIntroSlots(talentId, { slots, timeZone }) {
  const resp = await fetch(apiUrl(`/api/intro/my-slots/${encodeURIComponent(talentId)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots, timeZone }),
  });
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not save');
  return data;
}

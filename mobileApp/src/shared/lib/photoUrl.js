/** Append ?v= so caches fetch a new object after storage upsert to the same path. */
export function withPhotoCacheBust(url, version) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const v = version != null ? version : Date.now();
  try {
    const parsed = new URL(raw);
    parsed.searchParams.set('v', String(v));
    return parsed.toString();
  } catch {
    const base = raw.split('?')[0];
    return `${base}?v=${encodeURIComponent(v)}`;
  }
}

/** Display URL for stored photos — bust cache when DB row has no ?v= yet. */
export function photoUrlForDisplay(url, updatedAt) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/[?&]v=/.test(raw)) return raw;
  const stamp = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  return withPhotoCacheBust(raw, stamp);
}

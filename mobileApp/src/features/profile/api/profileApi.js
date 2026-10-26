import { supabase } from '@/core/api/supabase';
import { apiUrl, authHeaders, readJson } from '@/core/api/http';

/** Upsert the talent profile row (onConflict user_id) — same columns as the web portal/setup. */
export async function upsertTalentProfile(row) {
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function submitProfileForReview() {
  const headers = await authHeaders('Not signed in.');
  const resp = await fetch(apiUrl('/api/talent/profile/submit-review'), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not submit profile for review.');
  return data.profile;
}

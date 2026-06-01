import { supabase } from './supabase';
import { talentService } from '../services/talentService';

/** Shape expected by RequestIntroPage */
export function mapProfileToRequestIntroTalent(row) {
  const id = row.user_id || row.id;
  return {
    id,
    name: row.name || 'Candidate',
    role: row.job_title || 'Professional',
    bio: row.about || 'No bio provided.',
    tags: Array.isArray(row.skills) ? row.skills : [],
    photo: row.photo_url || null,
    score: 95,
    fee: 0,
    period: '/mo',
    experience: row.experience_years ? `${row.experience_years} yrs` : '—',
    availability: 'immediate',
    roleType: 'flexible',
    isReal: true,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve mock directory talent or Supabase profile by id */
export async function resolveRequestIntroTalent(id) {
  if (!id) return null;

  const mock = talentService.getAllBrowseTalents().find((t) => t.id === id);
  if (mock) return mock;

  if (!UUID_RE.test(id)) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, name, job_title, about, skills, experience_years, photo_url')
    .eq('user_id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfileToRequestIntroTalent(data);
}

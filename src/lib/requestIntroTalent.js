import { supabase } from './supabase';
import { talentService } from '../services/talentService';
import { calculateDirectoryFeeUsd } from './profileContentPolicy';
import { sanitizeTalentForPublicDisplay } from './talentVerification';

/** Shape expected by RequestIntroPage */
export function mapProfileToRequestIntroTalent(row) {
  const id = row.user_id || row.id;
  const baseFee = Number(row.monthly_fee_usd) || 0;
  return {
    id,
    name: row.name || 'Candidate',
    role: row.job_title || 'Professional',
    bio: row.about || 'No bio provided.',
    tags: Array.isArray(row.skills) ? row.skills : [],
    bestSkill: row.best_skill || row.skills?.[0] || '',
    photo: row.photo_url || null,
    score: 0,
    verified: false,
    fee: Number(row.directory_fee_usd) || calculateDirectoryFeeUsd(baseFee),
    period: '/mo',
    experience: row.experience_years ? `${row.experience_years} yrs` : '—',
    availability: row.availability || 'immediate',
    roleType: row.role_type || 'flexible',
    isReal: true,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve mock directory talent or Supabase profile by id */
export async function resolveRequestIntroTalent(id) {
  if (!id) return null;

  const mock = talentService.getAllBrowseTalents().find((t) => t.id === id);
  if (mock) return sanitizeTalentForPublicDisplay(mock);

  if (!UUID_RE.test(id)) return null;

  const profileFields =
    'id, user_id, name, job_title, about, skills, best_skill, experience_years, photo_url, monthly_fee_usd, directory_fee_usd, availability, role_type';

  const { data: byProfileId } = await supabase
    .from('profiles')
    .select(profileFields)
    .eq('id', id)
    .maybeSingle();

  if (byProfileId) return sanitizeTalentForPublicDisplay(mapProfileToRequestIntroTalent(byProfileId));

  const { data: byUserId } = await supabase
    .from('profiles')
    .select(profileFields)
    .eq('user_id', id)
    .maybeSingle();

  if (byUserId) return sanitizeTalentForPublicDisplay(mapProfileToRequestIntroTalent(byUserId));
  return null;
}

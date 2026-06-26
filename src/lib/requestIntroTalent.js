import { supabase } from './supabase';
import { talentService } from '../services/talentService';
import { calculateDirectoryFeeUsd } from './profileContentPolicy';
import { sanitizeTalentForPublicDisplay } from './talentVerification';
import { isDirectoryStatusColumnMissing } from './profileDirectoryCompat';
import { fetchPublicSkillScores, buildTalentSkillScores } from '../services/assessmentService';
import { fetchPublicAiInterviewBadges } from '../services/voiceInterviewService';

/** Shape expected by RequestIntroPage */
export function mapProfileToRequestIntroTalent(row, aiBadgeMap = {}) {
  const aiMeta = aiBadgeMap[row.id] || {};
  const baseFee = Number(row.monthly_fee_usd) || 0;
  return {
    id: row.id,
    name: row.name || 'Candidate',
    role: row.job_title || 'Professional',
    bio: row.about || 'No bio provided.',
    tags: Array.isArray(row.skills) ? row.skills : [],
    bestSkill: row.best_skill || row.skills?.[0] || '',
    photo: row.photo_url || null,
    score: 0,
    verified: false,
    aiInterviewVerified: Boolean(aiMeta.aiInterviewVerified),
    aiInterviewScore: aiMeta.interviewScore ?? null,
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
    'id, user_id, name, job_title, about, skills, best_skill, experience_years, photo_url, monthly_fee_usd, directory_fee_usd, availability, role_type, directory_status';

  let { data: byProfileId, error: err1 } = await supabase
    .from('profiles')
    .select(profileFields)
    .eq('id', id)
    .eq('directory_status', 'approved')
    .maybeSingle();

  if (err1 && isDirectoryStatusColumnMissing(err1)) {
    ({ data: byProfileId } = await supabase
      .from('profiles')
      .select(profileFields.replace(', directory_status', ''))
      .eq('id', id)
      .maybeSingle());
  } else if (err1) {
    throw err1;
  }

  if (byProfileId) {
    const badgeMap = await fetchPublicAiInterviewBadges([byProfileId.id]).catch(() => ({}));
    return sanitizeTalentForPublicDisplay(mapProfileToRequestIntroTalent(byProfileId, badgeMap));
  }

  let { data: byUserId, error: err2 } = await supabase
    .from('profiles')
    .select(profileFields)
    .eq('user_id', id)
    .eq('directory_status', 'approved')
    .maybeSingle();

  if (err2 && isDirectoryStatusColumnMissing(err2)) {
    ({ data: byUserId } = await supabase
      .from('profiles')
      .select(profileFields.replace(', directory_status', ''))
      .eq('user_id', id)
      .maybeSingle());
  } else if (err2) {
    throw err2;
  }

  if (byUserId) {
    const badgeMap = await fetchPublicAiInterviewBadges([byUserId.id]).catch(() => ({}));
    return sanitizeTalentForPublicDisplay(mapProfileToRequestIntroTalent(byUserId, badgeMap));
  }
  return null;
}

import { supabase } from './supabase';
import { formatDisplayName } from './formatDisplayName';
import { DEFAULT_MONTHLY_FEE_USD } from './profileContentPolicy';
import { normalizeTalentDepartment } from './talentDepartments';
import { fetchPublicSkillScores, buildTalentSkillScores } from '../services/assessmentService';
import { fetchPublicAiInterviewBadges } from '../services/voiceInterviewService';
import { isDirectoryStatusColumnMissing } from './profileDirectoryCompat';
import { photoUrlForDisplay } from './talentStorage';

export const LIVE_PROFILE_COLUMNS =
  'id, name, job_title, skills, best_skill, about, experience_years, photo_url, monthly_fee_usd, directory_fee_usd, availability, role_type, department, ambassador_id, created_at, updated_at';

export function mapProfileToDirectoryTalent(profile, scoreMap = {}, aiBadgeMap = {}) {
  const skills = profile.skills || [];
  const aiMeta = aiBadgeMap[profile.id] || {};
  return {
    id: profile.id,
    name: formatDisplayName(profile.name) || 'Anonymous',
    photo: photoUrlForDisplay(profile.photo_url, profile.updated_at || profile.created_at) || null,
    score: 0,
    verified: false,
    aiInterviewVerified: Boolean(aiMeta.aiInterviewVerified),
    aiInterviewScore: aiMeta.interviewScore ?? null,
    ambassadorReferred: Boolean(profile.ambassador_id),
    role: profile.job_title || 'Professional',
    experience: profile.experience_years ? `${profile.experience_years} yrs` : 'Flexible',
    tags: skills,
    bestSkill: profile.best_skill || skills[0] || '',
    skillScores: buildTalentSkillScores(scoreMap, profile.id, skills),
    fee:
      Number(profile.directory_fee_usd) ||
      Math.round((Number(profile.monthly_fee_usd) || DEFAULT_MONTHLY_FEE_USD) * 1.1),
    availability: profile.availability || 'immediate',
    department: normalizeTalentDepartment(profile.department),
    roleType: profile.role_type || 'flexible',
    bio: profile.about || 'No bio provided.',
    period: '/mo',
  };
}

export async function fetchLiveDirectoryTalents() {
  let { data, error } = await supabase
    .from('profiles')
    .select(LIVE_PROFILE_COLUMNS)
    .eq('directory_status', 'approved')
    .order('created_at', { ascending: false });

  if (error && isDirectoryStatusColumnMissing(error)) {
    ({ data, error } = await supabase
      .from('profiles')
      .select(LIVE_PROFILE_COLUMNS)
      .order('created_at', { ascending: false }));
  }

  if (error) throw new Error(error.message);

  const profiles = data || [];
  const profileIds = profiles.map((p) => p.id).filter(Boolean);
  const [scoreMap, aiBadgeMap] = await Promise.all([
    fetchPublicSkillScores(profileIds),
    fetchPublicAiInterviewBadges(profileIds).catch(() => ({})),
  ]);
  return profiles.map((p) => mapProfileToDirectoryTalent(p, scoreMap, aiBadgeMap));
}

function talentHaystack(talent) {
  return [talent.name, talent.role, talent.bestSkill, talent.bio, ...(talent.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Top N live profiles — optional department (directory) or industry keyword (homepage). */
export function pickFeaturedTalents(talents, { department, industry, limit = 5 } = {}) {
  let list = [...(talents || [])];

  if (department && department !== 'all') {
    list = list.filter((t) => t.department === department);
  }

  if (industry && industry !== 'All') {
    const terms = industry.toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(Boolean);
    list = list.filter((t) => {
      const haystack = talentHaystack(t);
      return terms.every((term) => haystack.includes(term));
    });
  }

  list.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return list.slice(0, limit);
}

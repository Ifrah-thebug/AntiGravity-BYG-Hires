import { formatDisplayName } from '@/shared/lib/formatDisplayName';
import { normalizeTalentDepartment } from '@/shared/lib/talentDepartments';
import { photoUrlForDisplay } from '@/shared/lib/photoUrl';
import { DEFAULT_MONTHLY_FEE_USD } from './profileContentPolicy';

/** Same shape the web directory card / "View Public Profile" modal renders. */
export function mapProfileToDirectoryTalent(profile, aiBadgeMap = {}) {
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
    skillScores: {},
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

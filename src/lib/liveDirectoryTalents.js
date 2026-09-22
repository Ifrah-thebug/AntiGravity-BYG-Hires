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

const CACHE_TTL_MS = 45_000;
let memoryCache = {
  at: 0,
  profiles: null,
  enriched: null,
};

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

async function fetchApprovedProfiles({ limit } = {}) {
  let query = supabase
    .from('profiles')
    .select(LIVE_PROFILE_COLUMNS)
    .eq('directory_status', 'approved')
    .order('created_at', { ascending: false });

  if (limit && Number(limit) > 0) {
    query = query.limit(Number(limit));
  }

  let { data, error } = await query;

  if (error && isDirectoryStatusColumnMissing(error)) {
    let fallback = supabase
      .from('profiles')
      .select(LIVE_PROFILE_COLUMNS)
      .order('created_at', { ascending: false });
    if (limit && Number(limit) > 0) fallback = fallback.limit(Number(limit));
    ({ data, error } = await fallback);
  }

  if (error) throw new Error(error.message);
  return data || [];
}

async function enrichProfiles(profiles) {
  const profileIds = profiles.map((p) => p.id).filter(Boolean);
  const [scoreMap, aiBadgeMap] = await Promise.all([
    fetchPublicSkillScores(profileIds).catch(() => ({})),
    fetchPublicAiInterviewBadges(profileIds).catch(() => ({})),
  ]);
  return profiles.map((p) => mapProfileToDirectoryTalent(p, scoreMap, aiBadgeMap));
}

/**
 * Fast directory fetch.
 * - Shows profiles ASAP (no skill/badge wait)
 * - Optionally enriches in the background via onPartial / enrich
 * - Short memory cache shared by homepage + /talent
 *
 * @param {{
 *   enrich?: boolean,
 *   limit?: number,
 *   useCache?: boolean,
 *   onPartial?: (talents: any[]) => void,
 * }} [opts]
 */
export async function fetchLiveDirectoryTalents(opts = {}) {
  const { enrich = true, limit, useCache = true, onPartial } = opts;
  const now = Date.now();
  const limited = Boolean(limit && Number(limit) > 0);

  // Limited fetches (homepage cards) must not poison the full /talent cache.
  if (!limited) {
    const cacheFresh = useCache && memoryCache.profiles && now - memoryCache.at < CACHE_TTL_MS;
    if (cacheFresh && enrich && memoryCache.enriched) {
      return memoryCache.enriched;
    }
    if (cacheFresh) {
      const fast = memoryCache.profiles.map((p) => mapProfileToDirectoryTalent(p));
      if (typeof onPartial === 'function') onPartial(fast);
      if (!enrich) return fast;
      const enriched = await enrichProfiles(memoryCache.profiles);
      memoryCache = { at: Date.now(), profiles: memoryCache.profiles, enriched };
      return enriched;
    }
  }

  const profiles = await fetchApprovedProfiles({ limit });
  const fast = profiles.map((p) => mapProfileToDirectoryTalent(p));
  if (!limited) {
    memoryCache = { at: now, profiles, enriched: null };
  }

  if (typeof onPartial === 'function') onPartial(fast);
  if (!enrich) return fast;

  const enriched = await enrichProfiles(profiles);
  if (!limited) {
    memoryCache = { at: Date.now(), profiles, enriched };
  }
  return enriched;
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

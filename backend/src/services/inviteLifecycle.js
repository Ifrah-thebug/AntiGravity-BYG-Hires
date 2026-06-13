/**
 * Join talent_invites with profiles + skill_assessments for admin funnel views.
 */

const { supabaseAdmin } = require('../middleware/requireAdmin');

function isProfileComplete(profile) {
  return Boolean(String(profile?.name || '').trim() && String(profile?.job_title || '').trim());
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function fetchProfilesForInvites(invites) {
  const userIds = [...new Set((invites || []).map((i) => i.userId).filter(Boolean))];
  const emails = [...new Set((invites || []).map((i) => normalizeEmail(i.email)).filter(Boolean))];

  const byUserId = {};
  const byEmail = {};

  if (userIds.length) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id, id, email, name, job_title, created_at')
      .in('user_id', userIds);
    if (error) throw error;
    for (const row of data || []) {
      byUserId[row.user_id] = row;
      if (row.email) byEmail[normalizeEmail(row.email)] = row;
    }
  }

  const missingEmails = emails.filter((e) => !byEmail[e]);
  for (const email of missingEmails) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id, id, email, name, job_title, created_at')
      .ilike('email', email)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      byEmail[email] = data;
      if (data.user_id) byUserId[data.user_id] = data;
    }
  }

  return { byUserId, byEmail };
}

async function fetchCompletedAssessmentSummary(userIds) {
  const summary = {};
  if (!userIds?.length) return summary;

  const { data, error } = await supabaseAdmin
    .from('skill_assessments')
    .select('user_id, skill, total_score, submitted_at')
    .in('user_id', userIds)
    .eq('status', 'completed')
    .order('submitted_at', { ascending: false });

  if (error) throw error;

  for (const row of data || []) {
    const uid = row.user_id;
    if (!summary[uid]) {
      summary[uid] = {
        count: 0,
        skills: [],
        latestSubmittedAt: null,
        bestScore: null,
      };
    }
    const entry = summary[uid];
    entry.count += 1;
    entry.skills.push({
      skill: row.skill,
      score: row.total_score,
      submittedAt: row.submitted_at,
    });
    if (!entry.latestSubmittedAt) entry.latestSubmittedAt = row.submitted_at;
    if (row.total_score != null) {
      entry.bestScore =
        entry.bestScore == null ? row.total_score : Math.max(entry.bestScore, row.total_score);
    }
  }

  return summary;
}

function resolveProfileForInvite(invite, { byUserId, byEmail }) {
  if (invite.userId && byUserId[invite.userId]) return byUserId[invite.userId];
  const email = normalizeEmail(invite.email);
  if (email && byEmail[email]) return byEmail[email];
  return null;
}

function buildLifecycleFields(invite, profile, assessmentSummary) {
  const profileComplete = isProfileComplete(profile);
  const assessedCount = assessmentSummary?.count || 0;
  const assessmentDone = assessedCount >= 1;

  return {
    profileComplete,
    profileCompletedAt: profileComplete
      ? profile.updated_at || profile.created_at || null
      : null,
    assessmentDone,
    assessedSkillCount: assessedCount,
    latestAssessmentAt: assessmentSummary?.latestSubmittedAt || null,
    bestAssessmentScore: assessmentSummary?.bestScore ?? null,
    assessedSkills: (assessmentSummary?.skills || []).slice(0, 5),
  };
}

async function enrichInvitesWithLifecycle(invites) {
  if (!invites?.length) return [];

  const { byUserId, byEmail } = await fetchProfilesForInvites(invites);
  const profileUserIds = [
    ...new Set(
      invites
        .map((inv) => resolveProfileForInvite(inv, { byUserId, byEmail })?.user_id || inv.userId)
        .filter(Boolean)
    ),
  ];
  const assessmentByUser = await fetchCompletedAssessmentSummary(profileUserIds);

  return invites.map((invite) => {
    const profile = resolveProfileForInvite(invite, { byUserId, byEmail });
    const uid = profile?.user_id || invite.userId;
    const lifecycle = buildLifecycleFields(invite, profile, uid ? assessmentByUser[uid] : null);
    return { ...invite, lifecycle };
  });
}

module.exports = {
  isProfileComplete,
  enrichInvitesWithLifecycle,
  buildLifecycleFields,
};

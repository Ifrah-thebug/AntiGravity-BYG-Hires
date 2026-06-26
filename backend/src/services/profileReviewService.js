const { supabaseAdmin } = require('../middleware/requireAdmin');
const {
  sendProfileApprovedEmail,
  sendProfileChangesRequestedEmail,
  sendProfileSubmittedAdminEmail,
} = require('./resendEmailService');

const DIRECTORY_STATUSES = new Set([
  'draft',
  'pending_review',
  'changes_requested',
  'approved',
  'rejected',
]);

const REVIEW_ISSUE_CODES = new Set([
  'photo',
  'cv',
  'bio',
  'skills',
  'job_title',
  'pricing',
  'other',
]);

const ISSUE_LABELS = {
  photo: 'Profile photo',
  cv: 'CV / resume',
  bio: 'About / bio',
  skills: 'Skills',
  job_title: 'Job title',
  pricing: 'Pricing / availability',
  other: 'Other',
};

const PROFILE_REVIEW_COLUMNS =
  'id, user_id, email, name, job_title, about, skills, best_skill, experience_years, photo_url, cv_url, monthly_fee_usd, directory_fee_usd, availability, role_type, department, directory_status, review_notes, review_issues, submitted_at, reviewed_at, reviewed_by, approved_at, created_at, updated_at';

function normalizeIssues(issues) {
  if (!Array.isArray(issues)) return [];
  return [...new Set(issues.map((i) => String(i || '').trim().toLowerCase()).filter((i) => REVIEW_ISSUE_CODES.has(i)))];
}

function formatIssueBullets(issues, notes) {
  const bullets = (issues || []).map((code) => ISSUE_LABELS[code] || code);
  if (notes?.trim()) bullets.push(notes.trim());
  return bullets;
}

async function getProfileByKey(profileKey) {
  if (!supabaseAdmin) throw new Error('Database not configured.');
  const key = String(profileKey || '').trim();
  if (!key) return null;

  let { data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_REVIEW_COLUMNS)
    .eq('id', key)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  ({ data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_REVIEW_COLUMNS)
    .eq('user_id', key)
    .maybeSingle());
  if (error) throw error;
  return data;
}

async function listReviewQueue({ status = 'pending_review', limit = 100 } = {}) {
  if (!supabaseAdmin) throw new Error('Database not configured.');
  const statusFilter = status === 'all' ? null : status;

  let query = supabaseAdmin
    .from('profiles')
    .select(PROFILE_REVIEW_COLUMNS)
    .not('name', 'is', null)
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .limit(Math.min(Number(limit) || 100, 200));

  if (statusFilter) {
    query = query.eq('directory_status', statusFilter);
  } else {
    query = query.in('directory_status', ['pending_review', 'changes_requested', 'approved', 'rejected', 'draft']);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function submitProfileForReview(userId) {
  const profile = await getProfileByKey(userId);
  if (!profile) {
    const err = new Error('Complete your profile before submitting for review.');
    err.code = 'PROFILE_MISSING';
    throw err;
  }

  if (!String(profile.name || '').trim() || !String(profile.job_title || '').trim()) {
    const err = new Error('Name and job title are required before submitting for review.');
    err.code = 'PROFILE_INCOMPLETE';
    throw err;
  }

  if (!String(profile.photo_url || '').trim()) {
    const err = new Error('A profile photo is required before submitting for review.');
    err.code = 'PHOTO_REQUIRED';
    throw err;
  }

  const allowedFrom = new Set(['draft', 'changes_requested']);
  if (profile.directory_status === 'pending_review') {
    return profile;
  }
  if (!allowedFrom.has(profile.directory_status)) {
    const err = new Error('This profile cannot be submitted for review in its current state.');
    err.code = 'INVALID_STATUS';
    throw err;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      directory_status: 'pending_review',
      submitted_at: now,
    })
    .eq('user_id', userId)
    .select(PROFILE_REVIEW_COLUMNS)
    .single();

  if (error) throw error;

  try {
    await sendProfileSubmittedAdminEmail({
      talentName: data.name,
      talentEmail: data.email,
      profileId: data.id,
    });
  } catch (emailErr) {
    console.warn('[profileReview] admin notify failed:', emailErr?.message || emailErr);
  }

  return data;
}

async function approveProfile({ profileKey, adminUserId }) {
  const profile = await getProfileByKey(profileKey);
  if (!profile) {
    const err = new Error('Profile not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      directory_status: 'approved',
      reviewed_at: now,
      reviewed_by: adminUserId || null,
      approved_at: now,
      review_notes: null,
      review_issues: [],
    })
    .eq('user_id', profile.user_id)
    .select(PROFILE_REVIEW_COLUMNS)
    .single();

  if (error) throw error;

  let emailResult = { sent: false };
  if (data.email) {
    try {
      await sendProfileApprovedEmail({
        to: data.email,
        name: data.name,
        profileId: data.id,
      });
      emailResult = { sent: true };
    } catch (emailErr) {
      console.error('[profileReview] approval email failed:', emailErr?.message || emailErr);
      emailResult = { sent: false, error: emailErr?.message || 'Email could not be sent.' };
    }
  }

  return { profile: data, email: emailResult };
}

async function requestProfileChanges({ profileKey, adminUserId, issues, notes }) {
  const profile = await getProfileByKey(profileKey);
  if (!profile) {
    const err = new Error('Profile not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const normalizedIssues = normalizeIssues(issues);
  const reviewNotes = String(notes || '').trim();
  if (!normalizedIssues.length && !reviewNotes) {
    const err = new Error('Select at least one issue or provide review notes.');
    err.code = 'NOTES_REQUIRED';
    throw err;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      directory_status: 'changes_requested',
      review_issues: normalizedIssues,
      review_notes: reviewNotes || null,
      reviewed_at: now,
      reviewed_by: adminUserId || null,
      approved_at: null,
    })
    .eq('user_id', profile.user_id)
    .select(PROFILE_REVIEW_COLUMNS)
    .single();

  if (error) throw error;

  let emailResult = { sent: false };
  if (data.email) {
    try {
      await sendProfileChangesRequestedEmail({
        to: data.email,
        name: data.name,
        issues: normalizedIssues,
        notes: reviewNotes,
      });
      emailResult = { sent: true };
    } catch (emailErr) {
      console.error('[profileReview] changes-requested email failed:', emailErr?.message || emailErr);
      emailResult = { sent: false, error: emailErr?.message || 'Email could not be sent.' };
    }
  }

  return { profile: data, email: emailResult };
}

module.exports = {
  DIRECTORY_STATUSES,
  REVIEW_ISSUE_CODES,
  ISSUE_LABELS,
  PROFILE_REVIEW_COLUMNS,
  formatIssueBullets,
  listReviewQueue,
  submitProfileForReview,
  approveProfile,
  requestProfileChanges,
  getProfileByKey,
};

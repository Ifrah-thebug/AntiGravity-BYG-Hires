import { supabase } from './supabase';

const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

export const DIRECTORY_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const REVIEW_ISSUE_OPTIONS = [
  { code: 'photo', label: 'Profile photo' },
  { code: 'cv', label: 'CV / resume' },
  { code: 'bio', label: 'About / bio' },
  { code: 'skills', label: 'Skills' },
  { code: 'job_title', label: 'Job title' },
  { code: 'pricing', label: 'Pricing / availability' },
  { code: 'other', label: 'Other' },
];

export const STATUS_LABELS = {
  draft: 'Draft',
  pending_review: 'Pending review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const STATUS_BADGE_CLASS = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  pending_review: 'bg-amber-50 text-amber-900 border-amber-200',
  changes_requested: 'bg-orange-50 text-orange-900 border-orange-200',
  approved: 'bg-green-50 text-green-800 border-green-200',
  rejected: 'bg-red/5 text-red border-red/20',
};

export function canSubmitForReview(status) {
  return status === DIRECTORY_STATUS.DRAFT || status === DIRECTORY_STATUS.CHANGES_REQUESTED;
}

export function isDirectoryLive(status) {
  return status === DIRECTORY_STATUS.APPROVED;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in.');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function parseJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Invalid response from server.');
  }
}

export async function submitProfileForReview() {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE}/api/talent/profile/submit-review`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not submit profile for review.');
  return data.profile;
}

export async function fetchAdminReviewQueue(status = 'pending_review') {
  const headers = await authHeaders();
  const qs = new URLSearchParams({ status });
  const resp = await fetch(`${API_BASE}/api/admin/profile-review/queue?${qs}`, { headers });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not load review queue.');
  return data.profiles || [];
}

export async function approveProfileReview(profileKey) {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE}/api/admin/profile-review/${encodeURIComponent(profileKey)}/approve`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not approve profile.');
  return data;
}

export async function requestProfileChanges(profileKey, { issues, notes }) {
  const headers = await authHeaders();
  const resp = await fetch(
    `${API_BASE}/api/admin/profile-review/${encodeURIComponent(profileKey)}/request-changes`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ issues, notes }),
    }
  );
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not request changes.');
  return data;
}

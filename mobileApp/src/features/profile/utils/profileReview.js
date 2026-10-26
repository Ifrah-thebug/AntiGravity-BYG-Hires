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

export function canSubmitForReview(status) {
  return status === DIRECTORY_STATUS.DRAFT || status === DIRECTORY_STATUS.CHANGES_REQUESTED;
}

export function isDirectoryLive(status) {
  return status === DIRECTORY_STATUS.APPROVED;
}

export function isProfileComplete(profile) {
  return Boolean(profile?.name?.trim() && profile?.job_title?.trim());
}

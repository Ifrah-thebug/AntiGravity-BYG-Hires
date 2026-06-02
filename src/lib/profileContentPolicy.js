import { normalizeProfileName } from './formatDisplayName';

/** Shown under About / profile fields */
export const PROFILE_CONTENT_HINT =
  'Do not include phone numbers, email, LinkedIn URLs, or street addresses in your name, title, about, or skills.';

export const AVAILABILITY_OPTIONS = [
  { value: 'immediate', label: 'Available now' },
  { value: '2weeks', label: 'From 2 weeks' },
  { value: '1month', label: 'From 1 month' },
  { value: 'from_month', label: 'From specific date' },
];

export const ROLE_TYPE_OPTIONS = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'fulltime', label: '9-5' },
  { value: 'night', label: 'Night' },
  { value: 'parttime', label: 'Part-time' },
];

export function calculateDirectoryFeeUsd(monthlyFeeUsd) {
  const base = Number(monthlyFeeUsd) || 0;
  return Math.round(base * 1.1);
}

export function normalizeAvailabilityFromMonth(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

export function formatAvailabilityLabel(availability, availabilityFromMonth) {
  const value = String(availability || '').trim();
  if (value === 'immediate') return 'Available Now';
  if (value === '2weeks') return 'In 2 Weeks';
  if (value === '1month') return 'In 1 Month';
  if (/^\d{4}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const normalized = normalizeAvailabilityFromMonth(value);
    if (!normalized) return 'From selected date';
    const date = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(date.getTime())) return 'From selected date';
    return `From ${date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }
  if (value === 'from_month') {
    const normalized = normalizeAvailabilityFromMonth(availabilityFromMonth);
    if (!normalized) return 'From selected date';
    const date = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(date.getTime())) return 'From selected date';
    return `From ${date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }
  return value || 'Available Now';
}

const PHONE_PATTERNS = [
  /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{4,}/,
  /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/,
  /\b\d{3}[\s.-]\d{4}[\s.-]\d{4}\b/,
  /\b\d{10,}\b/,
];

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

const LINKEDIN_RE =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company|pub)\/[\w%-]+|(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[\w?=&%-]+|\blinkedin\s*[:@]\s*[\w-]+/i;

const ADDRESS_PATTERNS = [
  /\b\d{1,5}\s+(?:[A-Za-z0-9.]+\s+){0,6}(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|court|ct\.?|way|place|pl\.?|crescent|terrace)\b/i,
  /\bP\.?\s*O\.?\s*Box\s+#?\s*\d+/i,
  /\b(?:apt|apartment|suite|unit|flat)\s*[#.]?\s*\d+/i,
  /\b\d{1,5}\s+[A-Za-z0-9.]+\s+(?:street|st|road|rd|avenue|ave)\b/i,
];

const ISSUE_LABELS = {
  phone: 'phone number',
  email: 'email address',
  linkedin: 'LinkedIn URL or handle',
  address: 'street address',
};

/**
 * @returns {('phone'|'email'|'linkedin'|'address')[]}
 */
export function getRestrictedContentIssues(text) {
  if (!text || typeof text !== 'string' || !text.trim()) return [];

  const issues = [];
  const value = text.trim();

  if (PHONE_PATTERNS.some((re) => re.test(value))) issues.push('phone');
  if (EMAIL_RE.test(value)) issues.push('email');
  if (LINKEDIN_RE.test(value)) issues.push('linkedin');
  if (ADDRESS_PATTERNS.some((re) => re.test(value))) issues.push('address');

  return [...new Set(issues)];
}

function issuesToMessage(fieldLabel, issueKeys) {
  const labels = issueKeys.map((k) => ISSUE_LABELS[k]).join(', ');
  return `${fieldLabel}: remove ${labels}.`;
}

/**
 * @returns {string[]} Human-readable validation errors (empty = ok)
 */
export function validateProfileFields({ name, job_title, about, skills }) {
  const errors = [];

  const scalarFields = [
    { label: 'Name', value: name },
    { label: 'Professional title', value: job_title },
    { label: 'About', value: about },
  ];

  for (const { label, value } of scalarFields) {
    const issues = getRestrictedContentIssues(value);
    if (issues.length) errors.push(issuesToMessage(label, issues));
  }

  for (const skill of skills || []) {
    const issues = getRestrictedContentIssues(skill);
    if (issues.length) errors.push(issuesToMessage(`Skill "${skill}"`, issues));
  }

  return errors;
}

/**
 * Normalize name + validate publishable text before Supabase upsert.
 * @returns {{ ok: boolean, errors: string[], data: object | null }}
 */
export function prepareProfileForSave(fields) {
  const monthlyFeeUsd = Number(fields.monthly_fee_usd);
  const availability = String(fields.availability || 'immediate');
  const roleType = String(fields.role_type || 'flexible');
  const availabilityDate = normalizeAvailabilityFromMonth(fields.availability_from_month);

  const data = {
    name: normalizeProfileName(fields.name),
    job_title: (fields.job_title || '').trim(),
    about: (fields.about || '').trim(),
    skills: (fields.skills || []).map((s) => s.trim()).filter(Boolean),
    experience_years: Number(fields.experience_years) || 0,
    monthly_fee_usd: Number.isFinite(monthlyFeeUsd) ? Math.max(0, Math.round(monthlyFeeUsd)) : 0,
    directory_fee_usd: calculateDirectoryFeeUsd(monthlyFeeUsd),
    availability:
      availability === 'from_month'
        ? (availabilityDate || '')
        : (AVAILABILITY_OPTIONS.some((o) => o.value === availability) ? availability : 'immediate'),
    role_type: ROLE_TYPE_OPTIONS.some((o) => o.value === roleType) ? roleType : 'flexible',
  };

  if (!data.name) {
    return { ok: false, errors: ['Name is required.'], data: null };
  }
  if (!data.job_title) {
    return { ok: false, errors: ['Professional title is required.'], data: null };
  }
  if (monthlyFeeUsd < 0) {
    return { ok: false, errors: ['Monthly fee cannot be negative.'], data: null };
  }
  if (availability === 'from_month' && !availabilityDate) {
    return { ok: false, errors: ['Please select a date for availability.'], data: null };
  }

  const errors = validateProfileFields(data);
  if (errors.length) {
    return { ok: false, errors, data: null };
  }

  return { ok: true, errors: [], data };
}

export function formatProfileValidationErrors(errors) {
  return errors.join(' ');
}

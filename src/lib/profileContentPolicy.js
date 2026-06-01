import { normalizeProfileName } from './formatDisplayName';

/** Shown under About / profile fields */
export const PROFILE_CONTENT_HINT =
  'Do not include phone numbers, email, LinkedIn URLs, or street addresses in your name, title, about, or skills.';

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
  const data = {
    name: normalizeProfileName(fields.name),
    job_title: (fields.job_title || '').trim(),
    about: (fields.about || '').trim(),
    skills: (fields.skills || []).map((s) => s.trim()).filter(Boolean),
    experience_years: Number(fields.experience_years) || 0,
  };

  if (!data.name) {
    return { ok: false, errors: ['Name is required.'], data: null };
  }
  if (!data.job_title) {
    return { ok: false, errors: ['Professional title is required.'], data: null };
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

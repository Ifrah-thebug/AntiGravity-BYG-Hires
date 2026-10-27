/**
 * Job requisitions + candidate pipeline rules (pure — shared by routes and tests).
 */

const JOB_STATUSES = ['open', 'on_hold', 'filled', 'closed'];
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract'];
const STAGES = ['shortlisted', 'intro', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'];

/** `hired` is only set by the system when the engagement contract is fully signed. */
const CLIENT_SETTABLE_STAGES = ['shortlisted', 'intro', 'interview', 'offer', 'rejected'];
const ADMIN_SETTABLE_STAGES = ['shortlisted', 'intro', 'interview', 'offer', 'rejected', 'withdrawn'];

const SUPPORTED_CURRENCIES = ['USD', 'AED', 'SAR', 'KWD', 'BHD', 'QAR', 'OMR', 'EGP', 'EUR', 'GBP'];

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  throw err;
}

function cleanText(value, max) {
  const s = String(value ?? '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

function optionalMoney(value, label) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) fail('INVALID_BUDGET', `${label} must be a positive number`);
  return Math.round(n * 100) / 100;
}

/**
 * Validate + normalize a job body. `partial` allows PATCH with only some fields.
 */
function normalizeJobInput(body = {}, { partial = false } = {}) {
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has('title')) {
    out.title = cleanText(body.title, 140);
    if (!out.title) fail('TITLE_REQUIRED', 'Job title is required');
  }
  if (!partial || has('description')) out.description = cleanText(body.description, 5000) || null;
  if (!partial || has('skills')) {
    const raw = Array.isArray(body.skills) ? body.skills : String(body.skills || '').split(',');
    out.skills = [...new Set(raw.map((s) => cleanText(s, 40)).filter(Boolean))].slice(0, 20);
  }
  if (!partial || has('employmentType')) {
    out.employmentType = body.employmentType || 'full_time';
    if (!EMPLOYMENT_TYPES.includes(out.employmentType)) fail('INVALID_TYPE', 'Invalid employment type');
  }
  if (!partial || has('location')) out.location = cleanText(body.location, 120) || 'Remote';
  if (!partial || has('budgetMin')) out.budgetMin = optionalMoney(body.budgetMin, 'Minimum budget');
  if (!partial || has('budgetMax')) out.budgetMax = optionalMoney(body.budgetMax, 'Maximum budget');
  if (out.budgetMin != null && out.budgetMax != null && out.budgetMin > out.budgetMax) {
    fail('INVALID_BUDGET', 'Minimum budget cannot exceed maximum budget');
  }
  if (!partial || has('currency')) {
    out.currency = String(body.currency || 'USD').toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(out.currency)) fail('INVALID_CURRENCY', 'Unsupported currency');
  }
  if (!partial || has('headcount')) {
    out.headcount = body.headcount == null || body.headcount === '' ? 1 : Number(body.headcount);
    if (!Number.isInteger(out.headcount) || out.headcount < 1 || out.headcount > 100) {
      fail('INVALID_HEADCOUNT', 'Headcount must be between 1 and 100');
    }
  }
  if (has('status')) {
    if (!JOB_STATUSES.includes(body.status)) fail('INVALID_STATUS', 'Invalid job status');
    out.status = body.status;
  }
  return out;
}

function assertStageChange({ from, to, actor }) {
  const allowed = actor === 'admin' ? ADMIN_SETTABLE_STAGES : CLIENT_SETTABLE_STAGES;
  if (!STAGES.includes(to)) fail('INVALID_STAGE', 'Invalid pipeline stage');
  if (!allowed.includes(to)) fail('STAGE_LOCKED', `Stage "${to}" is set automatically`);
  if (from === 'hired') fail('STAGE_LOCKED', 'Hired candidates cannot be moved');
}

module.exports = {
  JOB_STATUSES,
  EMPLOYMENT_TYPES,
  STAGES,
  CLIENT_SETTABLE_STAGES,
  ADMIN_SETTABLE_STAGES,
  SUPPORTED_CURRENCIES,
  normalizeJobInput,
  assertStageChange,
};

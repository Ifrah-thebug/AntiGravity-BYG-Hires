/**
 * Custom ERP HR directory — server-only.
 * Never expose HR_DIRECTORY_API_KEY to the browser.
 */

const BASE =
  String(process.env.HR_DIRECTORY_BASE_URL || 'https://dashboard-api.byghires.com/api/v1/hr-directory').replace(
    /\/$/,
    ''
  );

function apiKey() {
  return String(process.env.HR_DIRECTORY_API_KEY || '').trim();
}

function isConfigured() {
  return Boolean(apiKey());
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

async function hrFetch(path) {
  if (!isConfigured()) {
    const err = new Error('HR directory is not configured');
    err.code = 'HR_UNCONFIGURED';
    throw err;
  }
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Hr-Directory-Key': apiKey(),
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text || '{}');
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HR directory ${res.status}`);
    err.code = 'HR_API_ERROR';
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Fields allowed for client hire preview + admin (never public directory). */
function toPublicHrDetails(employee) {
  if (!employee) return null;
  return {
    employeeCode: employee.employee_code || null,
    fullName: employee.full_name || null,
    address: employee.address_line || null,
    nationalId: employee.national_id_number || null,
    phone: employee.phone || null,
    dateOfBirth: employee.date_of_birth || null,
    nationality: employee.nationality || null,
    // light context (not on public directory either)
    department: employee.department || null,
    designation: employee.designation || null,
    matchedOn: employee._matchedOn || null,
  };
}

function emailsOf(employee) {
  return [employee.work_email, employee.personal_email].map(normalizeEmail).filter(Boolean);
}

/**
 * Find ERP employee by any email (work or personal).
 * @returns {{ details, found } }
 */
async function lookupByEmail(email) {
  const target = normalizeEmail(email);
  if (!target || !target.includes('@')) {
    return { found: false, details: null, reason: 'invalid_email' };
  }
  if (!isConfigured()) {
    return { found: false, details: null, reason: 'unconfigured' };
  }

  const data = await hrFetch('/employees?active_only=true');
  const items = data.items || [];
  const hit = items.find((e) => emailsOf(e).includes(target));
  if (!hit) {
    return { found: false, details: null, reason: 'not_in_hr' };
  }

  // Prefer single-record fetch for freshest detail
  let employee = hit;
  if (hit.employee_code) {
    try {
      employee = await hrFetch(`/employees/${encodeURIComponent(hit.employee_code)}`);
    } catch {
      employee = hit;
    }
  }

  const matchedOn = emailsOf(employee).includes(target)
    ? normalizeEmail(employee.work_email) === target
      ? 'work_email'
      : 'personal_email'
    : 'email';

  return {
    found: true,
    details: toPublicHrDetails({ ...employee, _matchedOn: matchedOn }),
    reason: null,
  };
}

module.exports = {
  isConfigured,
  lookupByEmail,
  toPublicHrDetails,
};

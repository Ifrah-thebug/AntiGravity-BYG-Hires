/**
 * Server-side CV parsing via Gemini (mirrors src/lib/geminiCV.js).
 */

const {
  TALENT_DEPARTMENT_IDS,
  DEFAULT_TALENT_DEPARTMENT,
  normalizeTalentDepartment,
  geminiDepartmentPromptLines,
} = require('../constants/talentDepartments');

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_CV_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CV_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const GENERIC_SKILLS = new Set([
  'communication', 'teamwork', 'team player', 'hard working', 'hardworking',
  'problem solving', 'leadership', 'microsoft office', 'ms office',
  'organisation', 'organization', 'time management', 'remote work',
  'multitasking', 'detail oriented', 'fast learner', 'self motivated', 'work ethic',
]);

const CV_PARSE_PROMPT = `You are a strict CV data extractor for a premium remote staffing agency.

Read the entire CV/resume document carefully. Extract real information from employment history, skills sections, tools, certifications, and role descriptions.

Return ONLY valid JSON matching this shape (no markdown):

{
  "name": "Full legal name",
  "job_title": "Most recent or target professional title",
  "employment": [
    { "title": "Job title", "company": "Company", "start": "YYYY-MM or YYYY", "end": "YYYY-MM, YYYY, or Present" }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6", "Skill 7", "Skill 8"],
  "best_skill": "Single strongest skill (must exactly match one item in skills)",
  "experience_years": 5,
  "department": "admin-operations",
  "about": "2-3 sentence first-person bio (I/my/me only)"
}

SKILLS rules:
- Extract 6 to 8 distinct skills that appear in the CV.
- Prefer concrete items: HubSpot, Salesforce, QuickBooks, Python, SEO, etc.
- Do NOT pad with vague soft skills unless the CV has almost nothing else.
- Title Case each skill. No duplicates.

EXPERIENCE rules:
- experience_years must be an INTEGER.
- Round to nearest whole year. Range: 0-40.

OTHER rules:
- job_title: headline or most recent role title.
- best_skill: must be copied exactly from the skills array.
- about: 2-3 sentences, first person, under 80 words, no contact details.

DEPARTMENT rules:
- department: pick the ONE closest talent department id from this list (primary job function, not every keyword):
${geminiDepartmentPromptLines()}
- Return only the id string (e.g. "it-technical"), not the label.`;

const CV_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    job_title: { type: 'string' },
    employment: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          company: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
        },
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
    best_skill: { type: 'string' },
    experience_years: { type: 'integer' },
    department: { type: 'string', enum: TALENT_DEPARTMENT_IDS },
    about: { type: 'string' },
  },
  required: ['name', 'job_title', 'skills', 'best_skill', 'experience_years', 'department', 'about'],
};

function mockData() {
  const skills = [
    'Project Management', 'CRM Administration', 'Process Optimisation',
    'Data Analysis', 'Client Onboarding', 'Remote Collaboration',
    'SOP Documentation', 'Vendor Management',
  ];
  return {
    name: '',
    job_title: 'Remote Operations Specialist',
    best_skill: skills[0],
    skills,
    experience_years: 3,
    department: DEFAULT_TALENT_DEPARTMENT,
    about:
      'I am a motivated remote professional with a proven track record in operations and client management.',
  };
}

function parseFlexibleDate(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  if (['present', 'current', 'now', 'ongoing'].includes(s)) return new Date();
  const ymd = s.match(/^(\d{4})(?:[-/.](\d{1,2}))?/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = ymd[2] ? Number(ymd[2]) - 1 : 0;
    if (year >= 1970 && year <= 2100) return new Date(year, month, 1);
  }
  return null;
}

function monthsBetween(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function computeYearsFromEmployment(employment) {
  if (!Array.isArray(employment) || employment.length === 0) return null;
  const now = new Date();
  let earliest = null;
  let latest = null;
  for (const job of employment) {
    const start = parseFlexibleDate(job.start || job.start_date || job.from);
    const end = parseFlexibleDate(job.end || job.end_date || job.to) || now;
    if (!start || !end || end <= start) continue;
    if (!earliest || start < earliest) earliest = start;
    if (!latest || end > latest) latest = end;
  }
  if (!earliest || !latest) return null;
  const months = monthsBetween(earliest, latest);
  if (months <= 0) return null;
  return Math.min(40, Math.max(0, Math.round(months / 12)));
}

function parseExperienceYears(parsed) {
  const raw = parsed.experience_years ?? parsed.years_experience ?? parsed.yearsExperience ?? parsed.experience ?? null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(40, Math.max(0, Math.round(raw)));
  }
  const s = String(raw ?? '').trim();
  if (s) {
    const match = s.match(/(\d+(?:\.\d+)?)/);
    if (match) return Math.min(40, Math.max(0, Math.round(Number(match[1]))));
  }
  return null;
}

function parseSkillsArray(parsed) {
  const raw = parsed.skills ?? parsed.key_skills ?? parsed.keySkills ?? [];
  let list = [];
  if (Array.isArray(raw)) {
    list = raw.map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        return String(item.name || item.skill || item.label || '').trim();
      }
      return String(item || '').trim();
    });
  } else if (typeof raw === 'string') {
    list = raw.split(/[,;|•\n]+/).map((s) => s.trim());
  }
  const seen = new Set();
  const deduped = [];
  for (let skill of list) {
    skill = skill.replace(/^[-•*\d.)\s]+/, '').trim();
    if (!skill || skill.length > 50) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(skill);
  }
  const specific = deduped.filter((s) => !GENERIC_SKILLS.has(s.toLowerCase()));
  if (specific.length >= 4) return specific.slice(0, 8);
  return deduped.slice(0, 8);
}

function normalizeParsed(parsed) {
  const skills = parseSkillsArray(parsed);
  const resolvedSkills = skills.length >= 3 ? skills : [
    'Project Management', 'CRM Tools', 'Process Optimisation',
    'Data Analysis', 'Client Communication', 'Remote Collaboration',
  ];
  const rawBest = String(parsed.best_skill || parsed.bestSkill || '').trim();
  const best_skill = rawBest && resolvedSkills.some((s) => s.toLowerCase() === rawBest.toLowerCase())
    ? resolvedSkills.find((s) => s.toLowerCase() === rawBest.toLowerCase())
    : resolvedSkills[0] || '';
  const fromModel = parseExperienceYears(parsed);
  const fromEmployment = computeYearsFromEmployment(parsed.employment);
  let experience_years = fromModel ?? fromEmployment ?? 3;
  if (fromModel != null && fromEmployment != null && Math.abs(fromModel - fromEmployment) > 3) {
    experience_years = fromEmployment;
  }
  return {
    name: String(parsed.name || '').trim(),
    job_title: String(parsed.job_title || parsed.jobTitle || parsed.detected_expertise || '').trim() || 'Remote Professional',
    best_skill,
    skills: resolvedSkills,
    experience_years,
    department: normalizeTalentDepartment(parsed.department),
    about: String(parsed.about || '').trim() ||
      'I am a dedicated remote professional with a strong track record of delivering results.',
  };
}

function buildGenerationConfig() {
  return {
    temperature: 0.1,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    responseSchema: CV_RESPONSE_SCHEMA,
    thinkingConfig: { thinkingBudget: 0 },
  };
}

function trySalvagePartialJson(text) {
  const salvaged = {};
  let found = false;

  const pick = (regex, key, transform = (v) => v) => {
    const m = text.match(regex);
    if (m) {
      salvaged[key] = transform(m[1]);
      found = true;
    }
  };

  pick(/"name"\s*:\s*"([^"]+)"/, 'name');
  pick(/"job_title"\s*:\s*"([^"]+)"/, 'job_title');
  pick(/"experience_years"\s*:\s*(\d+(?:\.\d+)?)/, 'experience_years', Number);
  pick(/"best_skill"\s*:\s*"([^"]+)"/, 'best_skill');
  pick(/"department"\s*:\s*"([^"]+)"/, 'department');

  const skillsMatch = text.match(/"skills"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
  if (skillsMatch) {
    const skillStrings = skillsMatch[1].match(/"([^"]+)"/g);
    if (skillStrings?.length) {
      salvaged.skills = skillStrings.map((s) => s.replace(/"/g, ''));
      found = true;
    }
  }

  const aboutMatch = text.match(/"about"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (aboutMatch) {
    salvaged.about = aboutMatch[1].replace(/\\"/g, '"');
    found = true;
  }

  return found ? salvaged : null;
}

const MAX_PARSE_ATTEMPTS = 3;
const PARSE_RETRY_DELAYS_MS = [1500, 3000, 4500];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientHttpStatus(status) {
  return status === 503 || status === 429 || status === 504;
}

function parseFailure(message, { status, code = 'CV_PARSE_FAILED' } = {}) {
  return {
    ok: false,
    code,
    message,
    error: message,
    retryable: true,
    status: status || 503,
  };
}

async function callGeminiWithHttpRetries(base64Data, mimeType, generationConfig) {
  let result = await callGemini(base64Data, mimeType, generationConfig);

  for (let attempt = 0; attempt < MAX_PARSE_ATTEMPTS; attempt++) {
    if (!isTransientHttpStatus(result.response.status)) return result;

    const delay = PARSE_RETRY_DELAYS_MS[attempt] ?? 4500;
    console.warn(
      `[geminiCVService] ${result.response.status} — retry ${attempt + 1}/${MAX_PARSE_ATTEMPTS} in ${delay}ms`
    );
    await sleep(delay);
    result = await callGemini(base64Data, mimeType, generationConfig);
  }

  return result;
}

function extractModelText(resData) {
  const parts = resData?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text).filter(Boolean).join('').trim();
}

function cleanJsonText(text) {
  return text.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
}

async function callGemini(base64Data, mimeType, generationConfig) {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: CV_PARSE_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      }],
      generationConfig,
    }),
  });
  const responseText = await response.text();
  return { response, responseText };
}

function parseModelJson(text) {
  try {
    return normalizeParsed(JSON.parse(text));
  } catch (parseErr) {
    const salvaged = trySalvagePartialJson(text);
    if (salvaged) return normalizeParsed(salvaged);
    throw parseErr;
  }
}

async function parseCVOnce(base64Data, mimeType) {
  let { response, responseText } = await callGeminiWithHttpRetries(
    base64Data,
    mimeType,
    buildGenerationConfig()
  );

  if (!response.ok && /thinking|responseSchema|schema/i.test(responseText)) {
    ({ response, responseText } = await callGeminiWithHttpRetries(base64Data, mimeType, {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    }));
  }

  if (!response.ok) {
    console.warn('[geminiCVService] API error:', response.status, responseText.slice(0, 200));
    return parseFailure(
      isTransientHttpStatus(response.status)
        ? 'CV parsing is temporarily unavailable. Please re-upload your CV in a moment.'
        : 'We could not read your CV. Please re-upload a clear PDF and try again.',
      { status: response.status, code: 'GEMINI_API_ERROR' }
    );
  }

  let resData;
  try {
    resData = JSON.parse(responseText);
  } catch {
    return parseFailure('Invalid response from CV parser. Please re-upload your CV.', {
      code: 'GEMINI_RESPONSE_INVALID',
    });
  }

  const text = cleanJsonText(extractModelText(resData));
  if (!text.trim()) {
    return parseFailure('CV parser returned an empty result. Please re-upload your CV.', {
      code: 'GEMINI_EMPTY_RESPONSE',
    });
  }

  try {
    return { ok: true, parsed: parseModelJson(text), source: 'gemini' };
  } catch (err) {
    console.warn('[geminiCVService] JSON parse failed:', err?.message || err);
    return parseFailure('We could not understand the CV parser output. Please re-upload your CV.', {
      code: 'CV_JSON_PARSE_FAILED',
    });
  }
}

async function parseCVBuffer(buffer, mimeType) {
  if (!GEMINI_API_KEY) {
    console.warn('[geminiCVService] No API key — mock data.');
    return { ok: true, parsed: mockData(), source: 'mock' };
  }

  const base64Data = buffer.toString('base64');
  const mime = mimeType || 'application/pdf';
  let lastFailure = parseFailure('Could not parse CV.');

  for (let attempt = 0; attempt < MAX_PARSE_ATTEMPTS; attempt++) {
    try {
      const result = await parseCVOnce(base64Data, mime);
      if (result.ok) return result;
      lastFailure = result;
      console.warn(
        `[geminiCVService] attempt ${attempt + 1}/${MAX_PARSE_ATTEMPTS} failed:`,
        result.message
      );
    } catch (err) {
      lastFailure = parseFailure(err.message || 'Could not parse CV.', { code: 'CV_PARSE_EXCEPTION' });
      console.warn(`[geminiCVService] attempt ${attempt + 1}/${MAX_PARSE_ATTEMPTS} error:`, err);
    }

    if (attempt < MAX_PARSE_ATTEMPTS - 1) {
      await sleep(PARSE_RETRY_DELAYS_MS[attempt] ?? 4500);
    }
  }

  return lastFailure;
}

module.exports = { parseCVBuffer, normalizeParsed };

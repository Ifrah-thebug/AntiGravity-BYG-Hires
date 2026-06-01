// src/lib/geminiCV.js
// Parses a CV file (base64 PDF or image) using Gemini 2.5 Flash

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
export const GEMINI_CV_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CV_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const CV_PARSE_PROMPT = `You are a professional CV data extractor for a premium remote staffing agency.

Read this CV document and extract the following fields. Return ONLY valid JSON — no markdown, no explanations, no code blocks.

{
  "name": "Full name of the candidate (string)",
  "job_title": "Most recent or most relevant professional job title (string, e.g. 'Senior Operations Manager')",
  "skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6"],
  "experience_years": 5,
  "about": "A 2–3 sentence professional bio written in first person (I/my), as if the candidate wrote it. Highlight expertise, key strengths, and value for remote work. Sound premium and confident."
}

Rules:
- skills: exactly 6, specific and relevant (not generic like 'communication')
- experience_years: a number (integer), estimate from CV
- about: strictly 2–3 sentences, first person only (use I, my, me — never he/she/they or the candidate's name), professional tone, no filler phrases
- Keep "about" under 80 words so the JSON fits in one response`;

function mockData() {
  return {
    name: '',
    job_title: 'Remote Operations Specialist',
    skills: ['Project Management', 'Communication', 'CRM Tools', 'Data Analysis', 'Process Optimisation', 'Remote Collaboration'],
    experience_years: 3,
    about: 'I am a motivated remote professional with a proven track record in operations and client management. I bring strong organisational skills and a results-driven mindset to every engagement, and I am available for immediate remote placement.',
  };
}

function normalizeParsed(parsed) {
  return {
    name: parsed.name || '',
    job_title: parsed.job_title || 'Remote Professional',
    skills: Array.isArray(parsed.skills)
      ? parsed.skills.slice(0, 6)
      : ['Communication', 'Organisation', 'Microsoft Office', 'Problem Solving', 'Time Management', 'Remote Work'],
    experience_years: typeof parsed.experience_years === 'number' ? parsed.experience_years : 3,
    about: parsed.about || 'I am a dedicated remote professional with a strong track record of delivering results.',
  };
}

/** Gemini 2.5 can spend tokens on "thinking" and truncate JSON — disable thinking for CV extract */
function buildGenerationConfig() {
  return {
    temperature: 0.1,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingBudget: 0 },
  };
}

function extractModelText(resData) {
  const parts = resData?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((p) => p.text)
    .filter(Boolean)
    .join('')
    .trim();
}

function cleanJsonText(text) {
  return text
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();
}

/** Best-effort repair when response was cut off mid-JSON */
function trySalvagePartialJson(text) {
  const salvaged = { ...mockData() };
  let found = false;

  const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
  if (nameMatch) {
    salvaged.name = nameMatch[1];
    found = true;
  }

  const titleMatch = text.match(/"job_title"\s*:\s*"([^"]+)"/);
  if (titleMatch) {
    salvaged.job_title = titleMatch[1];
    found = true;
  }

  const yearsMatch = text.match(/"experience_years"\s*:\s*(\d+)/);
  if (yearsMatch) {
    salvaged.experience_years = Number(yearsMatch[1]);
    found = true;
  }

  const skillsMatch = text.match(/"skills"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
  if (skillsMatch) {
    const skillStrings = skillsMatch[1].match(/"([^"]+)"/g);
    if (skillStrings?.length) {
      salvaged.skills = skillStrings.map((s) => s.replace(/"/g, '')).slice(0, 6);
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

async function callGemini(base64Data, mimeType, generationConfig) {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: CV_PARSE_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64Data } },
          ],
        },
      ],
      generationConfig,
    }),
  });

  const responseText = await response.text();
  return { response, responseText };
}

export async function parseCV(base64Data, mimeType) {
  if (!GEMINI_API_KEY) {
    console.warn('[Gemini CV] No API key — returning mock data.');
    return mockData();
  }

  try {
    let { response, responseText } = await callGemini(base64Data, mimeType, buildGenerationConfig());

    if (!response.ok && /thinking/i.test(responseText)) {
      const fallbackConfig = {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      };
      ({ response, responseText } = await callGemini(base64Data, mimeType, fallbackConfig));
    }

    if (!response.ok) {
      console.warn('[Gemini CV] API error:', response.status, responseText);
      return mockData();
    }

    const resData = JSON.parse(responseText);
    let text = cleanJsonText(extractModelText(resData));

    if (!text.trim()) {
      console.warn('[Gemini CV] Empty response from model.');
      return mockData();
    }

    try {
      return normalizeParsed(JSON.parse(text));
    } catch (parseErr) {
      const salvaged = trySalvagePartialJson(text);
      if (salvaged) {
        return normalizeParsed(salvaged);
      }
      console.warn('[Gemini CV] Invalid JSON:', parseErr.message);
      return mockData();
    }
  } catch (err) {
    console.warn('[Gemini CV] Parse failed, using mock data.', err);
    return mockData();
  }
}

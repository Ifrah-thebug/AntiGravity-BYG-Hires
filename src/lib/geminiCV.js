// src/lib/geminiCV.js
// Parses a CV file (base64 PDF or image) using Gemini 1.5 Flash
// Returns structured JSON with name, job_title, skills[], experience_years, about

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const CV_PARSE_PROMPT = `You are a professional CV data extractor for a premium remote staffing agency.

Read this CV document and extract the following fields. Return ONLY valid JSON — no markdown, no explanations, no code blocks.

{
  "name": "Full name of the candidate (string)",
  "job_title": "Most recent or most relevant professional job title (string, e.g. 'Senior Operations Manager')",
  "skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6"],
  "experience_years": 5,
  "about": "A 2–3 sentence professional bio written in third person. Highlight the candidate's expertise, key strengths, and value proposition for remote work. Sound premium and confident."
}

Rules:
- skills: exactly 6, specific and relevant (not generic like 'communication')
- experience_years: a number (integer), estimate from CV
- about: strictly 2–3 sentences, third person, professional tone, no filler phrases`;

/**
 * Parse CV using Gemini 1.5 Flash
 * @param {string} base64Data - Raw base64 (no data URL prefix)
 * @param {string} mimeType - e.g. 'application/pdf', 'image/jpeg'
 * @returns {Promise<{name, job_title, skills, experience_years, about}>}
 */
export async function parseCV(base64Data, mimeType) {
  if (!GEMINI_API_KEY) {
    console.warn('[Gemini CV] No API key — returning mock data.');
    return getMockData();
  }

  try {
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
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      console.warn('[Gemini CV] API error:', response.status, await response.text());
      return getMockData();
    }

    const resData = await response.json();
    let text = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Strip any accidental markdown fences
    text = text.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();

    const parsed = JSON.parse(text);

    return {
      name: parsed.name || '',
      job_title: parsed.job_title || 'Remote Professional',
      skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 6) : ['Communication', 'Organisation', 'Microsoft Office', 'Problem Solving', 'Time Management', 'Remote Work'],
      experience_years: typeof parsed.experience_years === 'number' ? parsed.experience_years : 3,
      about: parsed.about || 'A dedicated remote professional with a strong track record of delivering results.',
    };
  } catch (err) {
    console.warn('[Gemini CV] Parse failed, using mock data.', err);
    return getMockData();
  }
}

function getMockData() {
  return {
    name: '',
    job_title: 'Remote Operations Specialist',
    skills: ['Project Management', 'Communication', 'CRM Tools', 'Data Analysis', 'Process Optimisation', 'Remote Collaboration'],
    experience_years: 3,
    about: 'A highly motivated remote professional with a proven track record in operations and client management. They bring strong organisational skills and a results-driven mindset to every engagement. Available for immediate remote placement.',
  };
}

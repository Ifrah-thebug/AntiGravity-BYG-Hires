/**
 * Skill assessments: question generation + answer grading via Gemini.
 */

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const DEFAULT_MODEL_CHAIN = 'gemini-2.5-flash,gemini-3.5-flash';

function parseModelChain(envValue) {
  return (envValue || DEFAULT_MODEL_CHAIN)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

/** Faster model first when 3.5 is overloaded. */
const GENERATE_MODEL_CHAIN = parseModelChain(process.env.GEMINI_GENERATE_MODELS);
const GRADE_MODEL_CHAIN = parseModelChain(
  process.env.GEMINI_GRADE_MODELS || process.env.GEMINI_GENERATE_MODELS
);
const GENERATE_TIMEOUT_MS = Number(process.env.GEMINI_GENERATE_TIMEOUT_MS) || 30000;
const GENERATE_MAX_OUTPUT_TOKENS = 2048;
const GRADE_TIMEOUT_MS = Number(process.env.GEMINI_GRADE_TIMEOUT_MS) || 45000;
const GRADE_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_GRADE_MAX_TOKENS) || 4096;
const GRADE_ATTEMPTS_PER_MODEL = Number(process.env.GEMINI_GRADE_ATTEMPTS) || 3;
const GRADE_TRANSIENT_RETRY_MS = Number(process.env.GEMINI_GRADE_RETRY_MS) || 30000;
const ALLOW_ASSESSMENT_FALLBACK = process.env.GEMINI_ASSESSMENT_ALLOW_FALLBACK === 'true';
const OPENROUTER_GENERATE_ATTEMPTS = Number(process.env.OPENROUTER_GENERATE_ATTEMPTS) || 2;
const OPENROUTER_GRADE_ATTEMPTS = Number(process.env.OPENROUTER_GRADE_ATTEMPTS) || 2;
const GROQ_GENERATE_ATTEMPTS = Number(process.env.GROQ_GENERATE_ATTEMPTS) || 2;
const GROQ_GRADE_ATTEMPTS = Number(process.env.GROQ_GRADE_ATTEMPTS) || 2;

const openRouter = require('./openRouterClient');
const groq = require('./groqClient');

function geminiEndpoint(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

const QUESTION_COUNT = 5;
const SESSION_MINUTES = 25;
const QUESTION_WORD_MIN = 12;
const QUESTION_WORD_MAX = 40;

const GENERATE_PROMPT = (ctx) => `Create exactly ${QUESTION_COUNT} unique skills-test questions for: "${ctx.skill}".
Role: ${ctx.jobTitle || 'Professional'}, ${ctx.experienceYears ?? 0} yrs exp, ${ctx.department || 'general'}.
Mix: 2 scenarios, 2 practical how-to, 1 judgment. Open-ended written answers only. Remote work context.
Seed: ${ctx.seed}

LENGTH (required): Each prompt is one short setup (optional) plus one direct question. 20–35 words total. Medium length only — not a paragraph. No bullet lists, numbered steps, or long preambles.

JSON RULES (required): Return valid JSON only. No markdown. No double quotes inside prompt text — use single quotes instead. No newlines inside strings.

JSON only:
{"questions":[{"id":"q1","type":"scenario","prompt":"...","max_points":20},{"id":"q2","type":"practical","prompt":"...","max_points":20},{"id":"q3","type":"scenario","prompt":"...","max_points":20},{"id":"q4","type":"practical","prompt":"...","max_points":20},{"id":"q5","type":"judgment","prompt":"...","max_points":20}]}`;

function countWords(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function normalizeQuestionPrompt(text) {
  let s = String(text).trim().replace(/\s+/g, ' ');
  if (!s) {
    s = 'Describe how you would handle this situation in a real remote role, including your approach, priorities, and expected outcome?';
  }
  if (!/[?.!]$/.test(s)) s = `${s}?`;

  // Some models return very short fragments (e.g. "Deploy on SageMaker: how").
  // Expand these into a complete interview-style question automatically.
  if (countWords(s) < QUESTION_WORD_MIN) {
    s = `${s.replace(/[?.!]+$/, '')}. Explain your step-by-step approach, key tradeoffs, and how you would measure success in practice?`;
  }

  if (countWords(s) <= QUESTION_WORD_MAX) return s;

  const sentences = s.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [s];
  let acc = '';
  for (const sent of sentences) {
    const piece = sent.trim();
    if (!piece) continue;
    const candidate = acc ? `${acc} ${piece}` : piece;
    if (countWords(candidate) > QUESTION_WORD_MAX) break;
    acc = candidate;
  }
  if (acc && countWords(acc) >= QUESTION_WORD_MIN) return acc;

  const words = s.split(/\s+/).slice(0, QUESTION_WORD_MAX);
  const trimmed = words.join(' ').replace(/[.,;:!-]+$/, '');
  return trimmed.endsWith('?') ? trimmed : `${trimmed}?`;
}

function sanitizeForGradePrompt(text, maxLen = 1500) {
  return String(text || '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

const GRADE_PROMPT = (ctx) => `You are a strict but fair skills assessor for BYG Hires.

Skill being assessed: "${ctx.skill}"
Candidate job title: ${ctx.jobTitle || 'Professional'}
Experience: ${ctx.experienceYears ?? 0} years

Grade each answer against its question. Use this rubric per question (max_points each):
- relevance: answers the question directly
- depth: demonstrates real skill knowledge
- clarity: structured and professional
- practicality: actionable in real work

Questions and answers:
${JSON.stringify(ctx.qaPairs)}

JSON RULES (required): Return valid JSON only. No markdown. In feedback and summary use single quotes only — never double quotes. No newlines inside strings. Each feedback 18-35 words and include at least one concrete improvement step tied to the candidate answer. Summary is 2-3 short sentences and must mention one strength and one improvement area.

Return ONLY this compact JSON (no extra keys):
{"per_question":[{"id":"q1","score":16,"max_points":20,"feedback":"..."}],"total_score":82,"summary":"..."}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanJsonText(text) {
  return text
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
}

function extractModelText(resData) {
  const parts = resData?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text).filter(Boolean).join('').trim();
}

function isJsonParseError(err) {
  return err instanceof SyntaxError || /json/i.test(String(err?.message || ''));
}

function stripTrailingCommas(json) {
  return json.replace(/,(\s*[}\]])/g, '$1');
}

function extractBalancedJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function salvageQuestionsFromBrokenJson(text) {
  const questions = [];
  const re =
    /"id"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"type"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"max_points"\s*:\s*(\d+)/gi;

  let match = re.exec(text);
  while (match) {
    questions.push({
      id: match[1],
      type: match[2],
      prompt: match[3].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim(),
      max_points: Number(match[4]) || 20,
    });
    match = re.exec(text);
  }

  return questions.length >= 3 ? { questions } : null;
}

function parseModelJson(text) {
  const cleaned = cleanJsonText(text);
  const candidates = [
    cleaned,
    stripTrailingCommas(cleaned),
    extractBalancedJsonObject(cleaned),
    extractBalancedJsonObject(stripTrailingCommas(cleaned)),
  ].filter(Boolean);

  const unique = [...new Set(candidates)];
  let lastErr;
  for (const candidate of unique) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastErr = err;
      try {
        return JSON.parse(stripTrailingCommas(candidate));
      } catch (innerErr) {
        lastErr = innerErr;
      }
    }
  }

  const salvaged = salvageQuestionsFromBrokenJson(cleaned);
  if (salvaged) return salvaged;

  throw lastErr || new SyntaxError('Could not parse model JSON');
}

function salvageGradeFromBrokenJson(text, qaPairs = []) {
  const per_question = [];
  const byId = {};

  const blockRe =
    /"id"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"score"\s*:\s*(\d+)\s*,\s*"max_points"\s*:\s*(\d+)\s*,\s*"feedback"\s*:\s*"((?:[^"\\]|\\.)*)"/gi;
  let match = blockRe.exec(text);
  while (match) {
    const item = {
      id: match[1],
      score: Number(match[2]),
      max_points: Number(match[3]) || 20,
      feedback: match[4].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim(),
    };
    if (!byId[item.id]) {
      byId[item.id] = item;
      per_question.push(item);
    }
    match = blockRe.exec(text);
  }

  if (per_question.length < Math.min(3, qaPairs.length || 3)) {
    const looseRe = /"id"\s*:\s*"(q\d+)"[\s\S]*?"score"\s*:\s*(\d+)/gi;
    match = looseRe.exec(text);
    while (match) {
      const id = match[1];
      if (!byId[id]) {
        const score = Number(match[2]);
        const item = {
          id,
          score,
          max_points: 20,
          feedback: defaultQuestionFeedback(score, 20),
        };
        byId[id] = item;
        per_question.push(item);
      }
      match = looseRe.exec(text);
    }
  }

  if (!per_question.length) return null;

  const totalMatch = text.match(/"total_score"\s*:\s*(\d+)/);
  const summaryMatch = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const scoreSum = per_question.reduce((s, q) => s + (Number(q.score) || 0), 0);
  const maxSum = per_question.reduce((s, q) => s + (Number(q.max_points) || 20), 0);
  const computedTotal = maxSum ? Math.round((scoreSum / maxSum) * 100) : 0;

  const total_score = totalMatch ? Number(totalMatch[1]) : computedTotal;
  return {
    per_question,
    dimensions: {},
    total_score,
    summary: summaryMatch
      ? summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim()
      : buildGradeSummary(per_question, total_score, ''),
  };
}

function defaultQuestionFeedback(score, maxPoints = 20) {
  const ratio = score / (maxPoints || 20);
  if (ratio >= 0.85) {
    return 'Strong answer. Add one measurable project result to make it more convincing.';
  }
  if (ratio >= 0.65) {
    return 'Good direction, but it needs one concrete example and clearer technical detail.';
  }
  if (ratio >= 0.45) {
    return 'Partially correct. Be more specific and answer the exact scenario directly.';
  }
  return 'Too brief for full credit. Explain your approach step by step with a practical example.';
}

function buildGradeSummary(per_question, totalScore, skill) {
  const skillLabel = skill ? `${skill} ` : '';
  if (!per_question?.length) {
    return `Your ${skillLabel}skills test is complete. Overall score: ${totalScore}/100.`;
  }

  const scored = per_question.map((q) => ({
    ...q,
    ratio: (Number(q.score) || 0) / (Number(q.max_points) || 20),
  }));
  const strong = scored.filter((q) => q.ratio >= 0.75);
  const weak = scored.filter((q) => q.ratio < 0.55);

  const parts = [`You scored ${totalScore}/100 on this ${skillLabel}assessment.`];
  if (strong.length) {
    parts.push(
      `You answered confidently on ${strong.length} question${strong.length > 1 ? 's' : ''}.`
    );
  }
  if (weak.length) {
    parts.push(
      `Focus on clearer examples and tighter structure on ${weak.length} question${weak.length > 1 ? 's' : ''} next time.`
    );
  } else if (!strong.length) {
    parts.push('Keep practicing with specific examples from real projects.');
  }
  return parts.join(' ');
}

function normalizeGradeFeedbackText(text) {
  let s = String(text || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (!/[.!?]$/.test(s)) s = `${s}.`;
  return s;
}

function parseGradeModelJson(text, qaPairs, { allowSalvage = false, skill = '' } = {}) {
  try {
    return parseModelJson(text);
  } catch (err) {
    if (!allowSalvage) {
      const retryErr = new Error(err.message || 'Invalid grade JSON');
      retryErr.code = 'GRADE_JSON_INVALID';
      throw retryErr;
    }
    const salvaged = salvageGradeFromBrokenJson(cleanJsonText(text), qaPairs);
    if (!salvaged) throw err;
    console.warn('[geminiAssessment] recovered grade scores from truncated JSON');
    if (!salvaged.summary || /partial/i.test(salvaged.summary)) {
      salvaged.summary = buildGradeSummary(
        salvaged.per_question,
        salvaged.total_score,
        skill
      );
    }
    for (const item of salvaged.per_question) {
      if (!item.feedback || /partial/i.test(item.feedback)) {
        item.feedback = defaultQuestionFeedback(item.score, item.max_points);
      }
    }
    return salvaged;
  }
}

function isTransientGeminiError(err) {
  if (err?.status === 429 || err?.status === 503 || err?.status === 504) return true;
  return /timed out after/i.test(String(err?.message || ''));
}

function shouldRetryGemini(err, { includeJson = false } = {}) {
  if (isTransientGeminiError(err)) return true;
  if (includeJson && isJsonParseError(err)) return true;
  if (err?.message === 'Too few questions generated') return true;
  return false;
}

function parseGeneratedQuestions(data) {
  const questions = (data.questions || [])
    .filter((q) => q?.id && q?.prompt)
    .slice(0, QUESTION_COUNT)
    .map((q, i) => ({
      id: String(q.id || `q${i + 1}`),
      type: q.type || 'practical',
      prompt: normalizeQuestionPrompt(q.prompt),
      max_points: Number(q.max_points) || 20,
    }));

  if (questions.length < QUESTION_COUNT) {
    throw new Error(`Too few questions generated (${questions.length}/${QUESTION_COUNT})`);
  }
  return questions;
}

function createGenerateUnavailableError(cause) {
  const err = new Error(
    'Our AI question generator is busy right now. Please wait a moment and try again.'
  );
  err.status = 503;
  err.code = 'AI_GENERATE_UNAVAILABLE';
  err.retryable = true;
  err.cause = cause;
  return err;
}

function createGradeUnavailableError(cause) {
  const parseIssue =
    isJsonParseError(cause) || /incomplete grade/i.test(String(cause?.message || ''));
  const busy = isTransientGeminiError(cause);
  const message = busy
    ? 'Our AI grader is busy right now. Your answers are saved — please try submitting again in a moment.'
    : parseIssue
      ? 'We could not read the AI grader response. Your answers are saved — please try submitting again.'
      : 'Could not grade your assessment right now. Your answers are saved — please try again.';
  const err = new Error(message);
  err.status = 503;
  err.code = 'AI_GRADE_UNAVAILABLE';
  err.retryable = true;
  err.cause = cause;
  return err;
}

function parseGradeResult(data, qaPairs = [], skill = '') {
  const per_question = Array.isArray(data.per_question) ? data.per_question : [];
  let total = Number(data.total_score);

  if (!Number.isFinite(total) && per_question.length) {
    const scoreSum = per_question.reduce((s, q) => s + (Number(q.score) || 0), 0);
    const maxSum = per_question.reduce(
      (s, q) => s + (Number(q.max_points) || 20),
      0
    );
    total = maxSum ? Math.round((scoreSum / maxSum) * 100) : 0;
  }

  total = Math.min(100, Math.max(0, Math.round(total || 0)));

  const expectedIds = qaPairs.map((q) => q.id);
  const byId = Object.fromEntries(per_question.map((q) => [q.id, q]));
  const missing = expectedIds.filter((id) => !byId[id]);
  if (missing.length) {
    throw new Error(`Incomplete grade (missing ${missing.join(', ')})`);
  }

  const ordered = expectedIds.map((id) => {
    const row = byId[id];
    return {
      ...row,
      feedback: normalizeGradeFeedbackText(
        String(row.feedback || '').trim() || defaultQuestionFeedback(row.score, row.max_points)
      ),
    };
  });

  const summary =
    String(data.summary || '').trim() ||
    buildGradeSummary(ordered, total, skill);

  return {
    per_question: ordered,
    dimensions: data.dimensions || {},
    total_score: total,
    summary,
  };
}

async function callGeminiText(
  prompt,
  {
    model = GRADE_MODEL_CHAIN[0],
    temperature = 0.7,
    maxOutputTokens = 8192,
    timeoutMs = 45000,
    parse = parseModelJson,
  } = {}
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(geminiEndpoint(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error(`Gemini API timed out after ${timeoutMs}ms`);
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const responseText = await response.text();
  if (!response.ok) {
    const err = new Error(`Gemini API error ${response.status}: ${responseText.slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }

  const resData = JSON.parse(responseText);
  const finishReason = resData?.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    const err = new Error('Model response was truncated (max tokens)');
    err.status = 502;
    err.code = 'GRADE_TRUNCATED';
    throw err;
  }

  const text = extractModelText(resData);
  if (!text) {
    const err = new Error('Empty response from Gemini');
    err.status = 502;
    throw err;
  }
  return parse(text);
}

function mockQuestions(skill) {
  const s = skill || 'Professional Skills';
  return {
    questions: [
      {
        id: 'q1',
        type: 'scenario',
        prompt: `A client is unhappy with your ${s} deliverable. You have 2 hours—what's your first move?`,
        max_points: 20,
      },
      {
        id: 'q2',
        type: 'practical',
        prompt: `How would you handle a typical ${s} task in your first week on a new remote role?`,
        max_points: 20,
      },
      {
        id: 'q3',
        type: 'scenario',
        prompt: `Two urgent ${s} tasks share the same deadline. How do you prioritize and set expectations?`,
        max_points: 20,
      },
      {
        id: 'q4',
        type: 'practical',
        prompt: `Which tools do you rely on for ${s}? Give one brief example from your experience.`,
        max_points: 20,
      },
      {
        id: 'q5',
        type: 'judgment',
        prompt: `What's a common junior mistake in ${s}, and how would you coach someone past it?`,
        max_points: 20,
      },
    ],
  };
}

function mockGrade(qaPairs) {
  const perQuestion = qaPairs.map((q) => {
    const len = String(q.answer || '').trim().length;
    const score = len > 200 ? 17 : len > 80 ? 14 : len > 30 ? 10 : 5;
    return {
      id: q.id,
      score,
      max_points: q.max_points || 20,
      feedback: len > 80 ? 'Solid practical response.' : 'Answer needs more detail and examples.',
    };
  });
  const total = Math.min(
    100,
    Math.round(perQuestion.reduce((s, q) => s + q.score, 0))
  );
  return {
    per_question: perQuestion,
    dimensions: {
      relevance: { score: Math.round(total * 0.25), max: 25, note: 'Mock grading' },
      depth: { score: Math.round(total * 0.25), max: 25, note: 'Mock grading' },
      clarity: { score: Math.round(total * 0.2), max: 20, note: 'Mock grading' },
      practicality: { score: Math.round(total * 0.2), max: 20, note: 'Mock grading' },
      problem_solving: { score: Math.round(total * 0.1), max: 10, note: 'Mock grading' },
    },
    total_score: total,
    summary: 'Mock assessment score — configure GEMINI_API_KEY for AI grading.',
  };
}

async function tryGenerateWithModel(model, ctx) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await callGeminiText(GENERATE_PROMPT(ctx), {
        model,
        temperature: Math.max(0.35, 0.6 - attempt * 0.1),
        maxOutputTokens: GENERATE_MAX_OUTPUT_TOKENS,
        timeoutMs: GENERATE_TIMEOUT_MS,
      });
      const questions = parseGeneratedQuestions(data);
      return { questions, questionSource: model };
    } catch (err) {
      lastErr = err;
      if (isTransientGeminiError(err)) {
        throw err;
      }
      if (shouldRetryGemini(err, { includeJson: true }) && attempt === 0) {
        console.warn(
          `[geminiAssessment] ${model} json retry:`,
          err?.message || err
        );
        await sleep(600);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function tryGenerateWithOpenRouter(model, ctx) {
  let lastErr;
  for (let attempt = 0; attempt < OPENROUTER_GENERATE_ATTEMPTS; attempt++) {
    try {
      const data = await openRouter.callOpenRouterText(GENERATE_PROMPT(ctx), {
        model,
        temperature: Math.max(0.35, 0.6 - attempt * 0.1),
        maxOutputTokens: GENERATE_MAX_OUTPUT_TOKENS,
        timeoutMs: GENERATE_TIMEOUT_MS,
        parse: parseModelJson,
      });
      const questions = parseGeneratedQuestions(data);
      return { questions, questionSource: `openrouter:${model}` };
    } catch (err) {
      lastErr = err;
      const retryable =
        openRouter.isTransientOpenRouterError(err) ||
        shouldRetryGemini(err, { includeJson: true });
      if (retryable && attempt < OPENROUTER_GENERATE_ATTEMPTS - 1) {
        const delayMs = openRouter.isTransientOpenRouterError(err) ? 2000 : 600;
        console.warn(
          `[openRouter] ${model} generate retry ${attempt + 1}/${OPENROUTER_GENERATE_ATTEMPTS}:`,
          err?.message || err
        );
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function tryGenerateWithGroq(model, ctx) {
  let lastErr;
  for (let attempt = 0; attempt < GROQ_GENERATE_ATTEMPTS; attempt++) {
    try {
      const data = await groq.callGroqText(GENERATE_PROMPT(ctx), {
        model,
        temperature: Math.max(0.35, 0.6 - attempt * 0.1),
        maxOutputTokens: GENERATE_MAX_OUTPUT_TOKENS,
        timeoutMs: GENERATE_TIMEOUT_MS,
        parse: parseModelJson,
      });
      const questions = parseGeneratedQuestions(data);
      return { questions, questionSource: `groq:${model}` };
    } catch (err) {
      lastErr = err;
      const retryable =
        groq.isTransientGroqError(err) ||
        shouldRetryGemini(err, { includeJson: true });
      if (retryable && attempt < GROQ_GENERATE_ATTEMPTS - 1) {
        const delayMs = groq.isTransientGroqError(err) ? 1500 : 600;
        console.warn(
          `[groq] ${model} generate retry ${attempt + 1}/${GROQ_GENERATE_ATTEMPTS}:`,
          err?.message || err
        );
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function generateQuestions(profile, skill) {
  const ctx = {
    skill,
    jobTitle: profile.job_title,
    experienceYears: profile.experience_years,
    department: profile.department,
    seed: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };

  if (!groq.isGroqEnabled() && !openRouter.isOpenRouterEnabled() && !GEMINI_API_KEY) {
    console.warn('[geminiAssessment] No AI provider — using fallback questions.');
    return { ...mockQuestions(skill), questionSource: 'fallback' };
  }

  let lastErr;
  if (groq.isGroqEnabled()) {
    for (const model of groq.getGenerateModelChain()) {
      try {
        const result = await tryGenerateWithGroq(model, ctx);
        console.info(`[groq] questions generated via ${model}`);
        return result;
      } catch (err) {
        lastErr = err;
        console.warn(`[groq] ${model} generate failed:`, err?.message || err);
      }
    }
  }

  if (openRouter.isOpenRouterEnabled()) {
    for (const model of openRouter.getGenerateModelChain()) {
      try {
        const result = await tryGenerateWithOpenRouter(model, ctx);
        console.info(`[openRouter] questions generated via ${model}`);
        return result;
      } catch (err) {
        lastErr = err;
        console.warn(`[openRouter] ${model} generate failed:`, err?.message || err);
      }
    }
  }

  if (GEMINI_API_KEY) {
    for (const model of GENERATE_MODEL_CHAIN) {
      try {
        const result = await tryGenerateWithModel(model, ctx);
        console.info(`[geminiAssessment] questions generated via ${model}`);
        return result;
      } catch (err) {
        lastErr = err;
        console.warn(`[geminiAssessment] ${model} failed:`, err?.message || err);
      }
    }
  }

  if (ALLOW_ASSESSMENT_FALLBACK) {
    console.warn('[geminiAssessment] all models failed — using fallback questions');
    return { ...mockQuestions(skill), questionSource: 'fallback' };
  }

  throw createGenerateUnavailableError(lastErr);
}

async function tryGradeWithModel(model, ctx, qaPairs, skill) {
  let lastErr;

  for (let attempt = 0; attempt < GRADE_ATTEMPTS_PER_MODEL; attempt++) {
    const allowSalvage = attempt === GRADE_ATTEMPTS_PER_MODEL - 1;
    const gradeParser = (text) =>
      parseGradeModelJson(text, qaPairs, { allowSalvage, skill });

    try {
      const data = await callGeminiText(GRADE_PROMPT(ctx), {
        model,
        temperature: Math.max(0.12, 0.28 - attempt * 0.06),
        maxOutputTokens: GRADE_MAX_OUTPUT_TOKENS,
        timeoutMs: GRADE_TIMEOUT_MS,
        parse: gradeParser,
      });
      return parseGradeResult(data, qaPairs, skill);
    } catch (err) {
      lastErr = err;
      const transient = isTransientGeminiError(err);
      const parseIssue =
        isJsonParseError(err) ||
        err.code === 'GRADE_JSON_INVALID' ||
        err.code === 'GRADE_TRUNCATED' ||
        /incomplete grade|too few|truncated/i.test(String(err?.message || ''));
      const hasRetriesLeft = attempt < GRADE_ATTEMPTS_PER_MODEL - 1;

      if ((transient || parseIssue) && hasRetriesLeft) {
        const delayMs = transient
          ? GRADE_TRANSIENT_RETRY_MS
          : Math.min(2500, 800 * (attempt + 1));
        console.warn(
          `[geminiAssessment] ${model} grade retry ${attempt + 1}/${GRADE_ATTEMPTS_PER_MODEL} in ${Math.round(delayMs / 1000)}s:`,
          err?.message || err
        );
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function tryGradeWithOpenRouter(model, ctx, qaPairs, skill) {
  let lastErr;

  for (let attempt = 0; attempt < OPENROUTER_GRADE_ATTEMPTS; attempt++) {
    const allowSalvage = attempt === OPENROUTER_GRADE_ATTEMPTS - 1;
    const gradeParser = (text) =>
      parseGradeModelJson(text, qaPairs, { allowSalvage, skill });

    try {
      const data = await openRouter.callOpenRouterText(GRADE_PROMPT(ctx), {
        model,
        temperature: Math.max(0.12, 0.28 - attempt * 0.06),
        maxOutputTokens: GRADE_MAX_OUTPUT_TOKENS,
        timeoutMs: GRADE_TIMEOUT_MS,
        parse: gradeParser,
      });
      return parseGradeResult(data, qaPairs, skill);
    } catch (err) {
      lastErr = err;
      const transient = openRouter.isTransientOpenRouterError(err);
      const parseIssue =
        isJsonParseError(err) ||
        err.code === 'GRADE_JSON_INVALID' ||
        err.code === 'GRADE_TRUNCATED' ||
        /incomplete grade|too few|truncated/i.test(String(err?.message || ''));
      const hasRetriesLeft = attempt < OPENROUTER_GRADE_ATTEMPTS - 1;

      if ((transient || parseIssue) && hasRetriesLeft) {
        const delayMs = transient ? 2000 : Math.min(2500, 800 * (attempt + 1));
        console.warn(
          `[openRouter] ${model} grade retry ${attempt + 1}/${OPENROUTER_GRADE_ATTEMPTS} in ${Math.round(delayMs / 1000)}s:`,
          err?.message || err
        );
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function tryGradeWithGroq(model, ctx, qaPairs, skill) {
  let lastErr;

  for (let attempt = 0; attempt < GROQ_GRADE_ATTEMPTS; attempt++) {
    const allowSalvage = attempt === GROQ_GRADE_ATTEMPTS - 1;
    const gradeParser = (text) =>
      parseGradeModelJson(text, qaPairs, { allowSalvage, skill });

    try {
      const data = await groq.callGroqText(GRADE_PROMPT(ctx), {
        model,
        temperature: Math.max(0.12, 0.28 - attempt * 0.06),
        maxOutputTokens: GRADE_MAX_OUTPUT_TOKENS,
        timeoutMs: GRADE_TIMEOUT_MS,
        parse: gradeParser,
      });
      return parseGradeResult(data, qaPairs, skill);
    } catch (err) {
      lastErr = err;
      const transient = groq.isTransientGroqError(err);
      const parseIssue =
        isJsonParseError(err) ||
        err.code === 'GRADE_JSON_INVALID' ||
        err.code === 'GRADE_TRUNCATED' ||
        /incomplete grade|too few|truncated/i.test(String(err?.message || ''));
      const hasRetriesLeft = attempt < GROQ_GRADE_ATTEMPTS - 1;

      if ((transient || parseIssue) && hasRetriesLeft) {
        const delayMs = transient ? 1500 : Math.min(2500, 800 * (attempt + 1));
        console.warn(
          `[groq] ${model} grade retry ${attempt + 1}/${GROQ_GRADE_ATTEMPTS} in ${Math.round(delayMs / 1000)}s:`,
          err?.message || err
        );
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function gradeAnswers(profile, skill, questions, answers) {
  const qaPairs = questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    max_points: q.max_points || 20,
    answer: sanitizeForGradePrompt(answers[q.id]),
  }));

  if (!groq.isGroqEnabled() && !openRouter.isOpenRouterEnabled() && !GEMINI_API_KEY) {
    return mockGrade(qaPairs);
  }

  const ctx = {
    skill,
    jobTitle: profile.job_title,
    experienceYears: profile.experience_years,
    qaPairs,
  };

  let lastErr;
  if (groq.isGroqEnabled()) {
    for (const model of groq.getGradeModelChain()) {
      try {
        const result = await tryGradeWithGroq(model, ctx, qaPairs, skill);
        console.info(`[groq] graded via ${model}`);
        return result;
      } catch (err) {
        lastErr = err;
        console.warn(`[groq] ${model} grade failed:`, err?.message || err);
      }
    }
  }

  if (openRouter.isOpenRouterEnabled()) {
    for (const model of openRouter.getGradeModelChain()) {
      try {
        const result = await tryGradeWithOpenRouter(model, ctx, qaPairs, skill);
        console.info(`[openRouter] graded via ${model}`);
        return result;
      } catch (err) {
        lastErr = err;
        console.warn(`[openRouter] ${model} grade failed:`, err?.message || err);
      }
    }
  }

  if (GEMINI_API_KEY) {
    for (const model of GRADE_MODEL_CHAIN) {
      try {
        const result = await tryGradeWithModel(model, ctx, qaPairs, skill);
        console.info(`[geminiAssessment] graded via ${model}`);
        return result;
      } catch (err) {
        lastErr = err;
        console.warn(`[geminiAssessment] ${model} grade failed:`, err?.message || err);
      }
    }
  }

  if (ALLOW_ASSESSMENT_FALLBACK) {
    console.warn('[geminiAssessment] all grade models failed — using mock grade');
    return mockGrade(qaPairs);
  }

  throw createGradeUnavailableError(lastErr);
}

function sanitizeSessionForClient(session) {
  if (!session) return null;
  return {
    id: session.id,
    skill: session.skill,
    status: session.status,
    questions: (session.questions || []).map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      max_points: q.max_points,
    })),
    answers: session.answers || {},
    started_at: session.started_at,
    expires_at: session.expires_at,
    submitted_at: session.submitted_at,
    total_score: session.total_score,
    score_breakdown: session.score_breakdown,
    feedback_summary: session.feedback_summary,
  };
}

module.exports = {
  generateQuestions,
  gradeAnswers,
  sanitizeSessionForClient,
  QUESTION_COUNT,
  SESSION_MINUTES,
};

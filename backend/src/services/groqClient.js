/**
 * Groq chat completions for skill assessments.
 * API: https://console.groq.com/docs/api-reference#chat-create
 */

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

function getGroqApiKey() {
  return (
    process.env.GROQ_API_KEY ||
    process.env.GROQ_KEY ||
    ''
  ).trim();
}

function isGroqEnabled() {
  const flag = String(process.env.GROQ_ENABLED || '').trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  if (flag === 'true' || flag === '1' || flag === 'yes') return Boolean(getGroqApiKey());
  return Boolean(getGroqApiKey());
}

function parseModelChain(envValue, fallbackModel) {
  const chain = String(envValue || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (chain.length) return chain;
  return fallbackModel ? [fallbackModel] : [];
}

function getDefaultModel() {
  return (process.env.GROQ_MODEL || DEFAULT_MODEL).trim();
}

function getGenerateModelChain() {
  const base = getDefaultModel();
  return parseModelChain(process.env.GROQ_GENERATE_MODELS, base);
}

function getGradeModelChain() {
  const base = getDefaultModel();
  return parseModelChain(
    process.env.GROQ_GRADE_MODELS || process.env.GROQ_GENERATE_MODELS,
    base
  );
}

function getBaseUrl() {
  return String(process.env.GROQ_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getDefaultTimeoutMs() {
  const parsed = Number(process.env.GROQ_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
}

function isTransientGroqError(err) {
  if (
    err?.status === 408 ||
    err?.status === 409 ||
    err?.status === 429 ||
    err?.status === 500 ||
    err?.status === 502 ||
    err?.status === 503 ||
    err?.status === 504
  ) {
    return true;
  }
  return /timed out|rate limit|overloaded|unavailable|temporar/i.test(
    String(err?.message || '')
  );
}

function extractGroqText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text' && part?.text) return part.text;
        return part?.text || '';
      })
      .filter(Boolean)
      .join('')
      .trim();
  }
  return '';
}

/**
 * @param {string} prompt
 * @param {{ model: string, temperature?: number, maxOutputTokens?: number, timeoutMs?: number, parse?: (text: string) => any }} opts
 */
async function callGroqText(
  prompt,
  {
    model,
    temperature = 0.7,
    maxOutputTokens = 4096,
    timeoutMs = getDefaultTimeoutMs(),
    parse = (text) => text,
  } = {}
) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    const err = new Error('Groq API key not configured');
    err.status = 503;
    throw err;
  }
  if (!model) {
    const err = new Error('Groq model not configured');
    err.status = 503;
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxOutputTokens,
      }),
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error(`Groq API timed out after ${timeoutMs}ms`);
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const responseText = await response.text();
  if (!response.ok) {
    const err = new Error(`Groq API error ${response.status}: ${responseText.slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    const err = new Error('Invalid JSON from Groq API');
    err.status = 502;
    throw err;
  }

  const text = extractGroqText(data);
  if (!text) {
    const err = new Error('Empty response from Groq');
    err.status = 502;
    err.code = 'GROQ_EMPTY';
    throw err;
  }

  return parse(text);
}

module.exports = {
  callGroqText,
  getGroqApiKey,
  isGroqEnabled,
  getGenerateModelChain,
  getGradeModelChain,
  getDefaultModel,
  getDefaultTimeoutMs,
  isTransientGroqError,
};

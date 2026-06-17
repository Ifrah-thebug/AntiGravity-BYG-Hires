/**
 * OpenRouter chat completions — fallback when Gemini is overloaded (503/429).
 * API: https://openrouter.ai/docs/api/reference/overview
 */

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_SITE_URL = 'https://byghires.com';
const DEFAULT_APP_NAME = 'BYG Hires';
const DEFAULT_MODEL = 'openai/gpt-oss-120b:free';

function getOpenRouterApiKey() {
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.OPEN_ROUTER_KEY ||
    process.env.OPENROUTER_KEY ||
    ''
  ).trim();
}

function isOpenRouterEnabled() {
  const flag = String(process.env.OPENROUTER_ENABLED || '').trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  if (flag === 'true' || flag === '1' || flag === 'yes') return Boolean(getOpenRouterApiKey());
  return Boolean(getOpenRouterApiKey());
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
  return (
    process.env.OPENROUTER_MODEL ||
    process.env.OPENROUTER_DEFAULT_MODEL ||
    process.env.OPEN_ROUTER_MODEL ||
    DEFAULT_MODEL
  ).trim();
}

function getGenerateModelChain() {
  const base = getDefaultModel();
  return parseModelChain(process.env.OPENROUTER_GENERATE_MODELS, base);
}

function getGradeModelChain() {
  const base = getDefaultModel();
  return parseModelChain(
    process.env.OPENROUTER_GRADE_MODELS || process.env.OPENROUTER_GENERATE_MODELS,
    base
  );
}

function getBaseUrl() {
  return String(process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getSiteUrl() {
  return (
    process.env.OPENROUTER_SITE_URL ||
    process.env.SITE_URL ||
    process.env.FRONTEND_URL ||
    DEFAULT_SITE_URL
  ).replace(/\/$/, '');
}

function getAppName() {
  return process.env.OPENROUTER_APP_NAME || DEFAULT_APP_NAME;
}

function getDefaultTimeoutMs() {
  const parsed = Number(process.env.OPENROUTER_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45000;
}

function isTransientOpenRouterError(err) {
  if (err?.status === 429 || err?.status === 500 || err?.status === 502 || err?.status === 503 || err?.status === 504) {
    return true;
  }
  return /timed out after|rate limit|overloaded|unavailable|empty response/i.test(String(err?.message || ''));
}

function useJsonResponseFormat() {
  const flag = String(process.env.OPENROUTER_USE_JSON_MODE || '').trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

function extractOpenRouterText(data) {
  const choice = data?.choices?.[0];
  const message = choice?.message || {};

  const content = message.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text' && part?.text) return part.text;
        return part?.text || '';
      })
      .filter(Boolean)
      .join('')
      .trim();
    if (joined) return joined;
  }

  // Some free "thinking" models put output in reasoning instead of content.
  if (typeof message.reasoning === 'string' && message.reasoning.trim()) {
    return message.reasoning.trim();
  }
  if (Array.isArray(message.reasoning_details)) {
    const reasoning = message.reasoning_details
      .map((part) => part?.text || '')
      .filter(Boolean)
      .join('')
      .trim();
    if (reasoning) return reasoning;
  }

  return '';
}

function buildEmptyResponseError(data) {
  const choice = data?.choices?.[0];
  const finishReason = choice?.finish_reason || 'unknown';
  const model = data?.model || 'unknown';
  const err = new Error(
    `Empty response from OpenRouter (model=${model}, finish_reason=${finishReason})`
  );
  err.status = 502;
  err.code = 'OPENROUTER_EMPTY';
  err.details = {
    model,
    finish_reason: finishReason,
    native_finish_reason: choice?.native_finish_reason,
    has_reasoning: Boolean(choice?.message?.reasoning),
  };
  return err;
}

/**
 * @param {string} prompt
 * @param {{ model: string, temperature?: number, maxOutputTokens?: number, timeoutMs?: number, parse?: (text: string) => any }} opts
 */
async function callOpenRouterText(
  prompt,
  {
    model,
    temperature = 0.7,
    maxOutputTokens = 4096,
    timeoutMs = getDefaultTimeoutMs(),
    parse = (text) => text,
  } = {}
) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    const err = new Error('OpenRouter API key not configured');
    err.status = 503;
    throw err;
  }
  if (!model) {
    const err = new Error('OpenRouter model not configured');
    err.status = 503;
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    const payload = {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxOutputTokens,
    };
    // json_object breaks some free models (e.g. gpt-oss-120b:free). Prompt already asks for JSON.
    if (useJsonResponseFormat()) {
      payload.response_format = { type: 'json_object' };
    }

    response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': getSiteUrl(),
        'X-Title': getAppName(),
      },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error(`OpenRouter API timed out after ${timeoutMs}ms`);
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const responseText = await response.text();
  if (!response.ok) {
    const apiErr = new Error(`OpenRouter API error ${response.status}: ${responseText.slice(0, 300)}`);
    apiErr.status = response.status;
    throw apiErr;
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    const err = new Error('Invalid JSON from OpenRouter API');
    err.status = 502;
    throw err;
  }

  if (data?.error) {
    const err = new Error(
      typeof data.error === 'string' ? data.error : data.error.message || 'OpenRouter error'
    );
    err.status = data.error.code || 502;
    throw err;
  }

  const text = extractOpenRouterText(data);
  if (!text) {
    console.warn('[openRouter] empty assistant text:', JSON.stringify({
      model: data?.model,
      finish_reason: data?.choices?.[0]?.finish_reason,
      native_finish_reason: data?.choices?.[0]?.native_finish_reason,
    }));
    throw buildEmptyResponseError(data);
  }

  return parse(text);
}

module.exports = {
  callOpenRouterText,
  getOpenRouterApiKey,
  isOpenRouterEnabled,
  getGenerateModelChain,
  getGradeModelChain,
  getDefaultModel,
  isTransientOpenRouterError,
  getDefaultTimeoutMs,
};

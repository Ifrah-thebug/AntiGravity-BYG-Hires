/**
 * BGuides client chat — hiring assistant with UI sync commands (directory filters / booking).
 * Reuses talent_chat_* tables keyed by user_id (profile_id stays null for clients).
 */

const { supabaseAdmin } = require('../middleware/requireAdmin');
const groq = require('./groqClient');
const openRouter = require('./openRouterClient');

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

const DEPARTMENT_HINTS = [
  { id: 'ai-automation', keys: ['ai', 'automation', 'zapier', 'make.com'] },
  { id: 'admin-operations', keys: ['admin', 'operations', 'ops', 'executive assistant'] },
  { id: 'account-coordinators', keys: ['account coordinator', 'account manager'] },
  { id: 'marketing-content', keys: ['marketing', 'content', 'social media', 'copywriter'] },
  { id: 'virtual-assistants', keys: ['virtual assistant', 'va ', 'va,', 'assistant'] },
  { id: 'customer-support', keys: ['customer support', 'client success', 'csat', 'zendesk', 'support'] },
  { id: 'sales', keys: ['sales', 'bdr', 'sdr', 'business development'] },
  { id: 'hr', keys: ['hr', 'human resources', 'recruiter'] },
  { id: 'it-technical', keys: ['it support', 'technical support', 'helpdesk', 'sysadmin'] },
  { id: 'finance', keys: ['finance', 'accounting', 'bookkeeping', 'bookkeeper'] },
];

function parseAssistantJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiChat(systemPrompt, history, userMessage) {
  if (!GEMINI_API_KEY) {
    const err = new Error('Gemini is not configured');
    err.status = 503;
    throw err;
  }
  const contents = [];
  for (const m of history) {
    if (m.role === 'user' || m.role === 'assistant') {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.35, maxOutputTokens: 700 },
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data?.error?.message || `Gemini HTTP ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text.trim()) {
    const err = new Error('Empty response from Gemini');
    err.status = 502;
    throw err;
  }
  return text.trim();
}

const CHAT_LLM_TIMEOUT_MS = 45000;
const CHAT_LLM_ATTEMPTS = 2;

async function callLlm(systemPrompt, history, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.filter((m) => m.role === 'user' || m.role === 'assistant'),
    { role: 'user', content: userMessage },
  ];

  if (groq.isGroqEnabled()) {
    for (let attempt = 0; attempt < CHAT_LLM_ATTEMPTS; attempt++) {
      try {
        return await groq.callGroqChat(messages, {
          model: groq.getDefaultModel(),
          temperature: 0.35,
          maxOutputTokens: 700,
          timeoutMs: CHAT_LLM_TIMEOUT_MS,
        });
      } catch (err) {
        if (groq.isTransientGroqError(err) && attempt < CHAT_LLM_ATTEMPTS - 1) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  if (openRouter.isOpenRouterEnabled()) {
    for (let attempt = 0; attempt < CHAT_LLM_ATTEMPTS; attempt++) {
      try {
        return await openRouter.callOpenRouterChat(messages, {
          model: openRouter.getDefaultModel(),
          temperature: 0.35,
          maxOutputTokens: 700,
          timeoutMs: CHAT_LLM_TIMEOUT_MS,
        });
      } catch (err) {
        if (openRouter.isTransientOpenRouterError?.(err) && attempt < CHAT_LLM_ATTEMPTS - 1) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  for (let attempt = 0; attempt < CHAT_LLM_ATTEMPTS; attempt++) {
    try {
      return await callGeminiChat(systemPrompt, history, userMessage);
    } catch (err) {
      const retryable = /429|503|504|overloaded|rate limit|timed out/i.test(String(err?.message || ''));
      if (retryable && attempt < CHAT_LLM_ATTEMPTS - 1) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw new Error('All AI providers failed');
}

async function getOrCreateSession(userId) {
  const { data: existing, error: findErr } = await supabaseAdmin
    .from('talent_chat_sessions')
    .select('id, user_id, profile_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: createErr } = await supabaseAdmin
    .from('talent_chat_sessions')
    .insert({ user_id: userId, profile_id: null })
    .select('id, user_id, profile_id, created_at, updated_at')
    .single();

  if (createErr) {
    const { data: raced, error: raceErr } = await supabaseAdmin
      .from('talent_chat_sessions')
      .select('id, user_id, profile_id, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (raceErr) throw raceErr;
    if (raced) return raced;
    throw createErr;
  }
  return created;
}

async function listMessages(sessionId, limit = 40) {
  const { data, error } = await supabaseAdmin
    .from('talent_chat_messages')
    .select('id, role, content, actions, metadata, created_at')
    .eq('session_id', sessionId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function insertMessage(sessionId, { role, content, actions = [], metadata = {} }) {
  const { data, error } = await supabaseAdmin
    .from('talent_chat_messages')
    .insert({ session_id: sessionId, role, content, actions, metadata })
    .select('id, role, content, actions, metadata, created_at')
    .single();
  if (error) throw error;
  await supabaseAdmin
    .from('talent_chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  return data;
}

function extractDirectoryFilters(text) {
  const q = String(text || '').toLowerCase();
  const filters = { dept: null, q: null, maxFee: null, availability: [], roleType: [] };

  for (const dept of DEPARTMENT_HINTS) {
    if (dept.keys.some((k) => q.includes(k))) {
      filters.dept = dept.id;
      break;
    }
  }

  const skillMatch = q.match(/\b(?:with|who know|skilled in|experience in)\s+([a-z0-9.+#/\- ]{2,40})/i);
  if (skillMatch) {
    filters.q = skillMatch[1].trim().replace(/\s+(and|or|please).*$/i, '').trim();
  } else if (!filters.dept) {
    const free = q
      .replace(/\b(i need|looking for|find me|show me|search for|hire|want)\b/gi, ' ')
      .replace(/\b(talent|candidate|person|people|someone|a|an|the)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (free.length >= 3 && free.length <= 60) filters.q = free;
  }

  const feeMatch = q.match(/\$?\s*(\d{3,4})\s*(?:\/?\s*mo|per month|monthly)?/);
  if (feeMatch) {
    const n = Number(feeMatch[1]);
    if (n >= 450 && n <= 2000) filters.maxFee = n;
  }

  if (/\bimmediately\b|\bimmediate\b|\basap\b/.test(q)) filters.availability.push('immediate');
  if (/\bfull[- ]?time\b/.test(q)) filters.roleType.push('fulltime');
  if (/\bpart[- ]?time\b/.test(q)) filters.roleType.push('parttime');
  if (/\bnight\b/.test(q)) filters.roleType.push('night');
  if (/\bflexible\b/.test(q)) filters.roleType.push('flexible');

  return filters;
}

function filtersToUiCommands(filters) {
  if (!filters) return [];
  const payload = {};
  if (filters.dept) payload.dept = filters.dept;
  if (filters.q) payload.q = filters.q;
  if (filters.maxFee) payload.maxFee = filters.maxFee;
  if (filters.availability?.length) payload.availability = filters.availability;
  if (filters.roleType?.length) payload.roleType = filters.roleType;
  if (!Object.keys(payload).length) return [];
  return [{ type: 'APPLY_DIRECTORY_FILTERS', payload }];
}

function matchClientIntent(text) {
  const q = String(text || '').toLowerCase().trim();
  if (!q) return { matched: false };

  if (/\b(book|intro call|schedule|request intro)\b/.test(q) && /\b(talent|them|candidate|him|her)\b/.test(q)) {
    return {
      matched: true,
      reply:
        'Open a talent card on the directory, then use Request intro — or tell me a name/role and I will filter the list so you can book.',
      actions: [{ id: 'directory', label: 'Browse talent directory', href: '/talent' }],
      uiCommands: [{ type: 'NAVIGATE', payload: { href: '/talent' } }],
    };
  }

  if (/\b(browse|show|find|search|looking for|need a|hire)\b/.test(q)) {
    const filters = extractDirectoryFilters(q);
    const uiCommands = filtersToUiCommands(filters);
    const bits = [];
    if (filters.dept) bits.push(`department filter`);
    if (filters.q) bits.push(`skills “${filters.q}”`);
    if (filters.maxFee) bits.push(`max fee $${filters.maxFee}`);
    const summary = bits.length ? bits.join(', ') : 'the live directory';
    return {
      matched: true,
      reply: `Updating the talent directory for ${summary}. Pick a card to request an intro call.`,
      actions: [{ id: 'directory', label: 'View filtered directory', href: '/talent' }],
      uiCommands: uiCommands.length ? uiCommands : [{ type: 'NAVIGATE', payload: { href: '/talent' } }],
    };
  }

  if (/\b(what can you do|help|how does this work)\b/.test(q)) {
    return {
      matched: true,
      reply:
        'I help you hire on BYG Hires: describe the role or skills you need, I filter the talent directory live, then you can request an intro call from a shortlist.',
      actions: [{ id: 'directory', label: 'Open talent directory', href: '/talent' }],
      uiCommands: [{ type: 'NAVIGATE', payload: { href: '/talent' } }],
    };
  }

  return { matched: false };
}

function buildClientSystemPrompt(client) {
  const company = client?.company || 'your company';
  return `You are BGuides — the hiring assistant for BYG Hires clients (${company}).
Help them find remote talent and book intro calls.

Rules:
- Stay on hiring / directory / intro booking. No unrelated tutorials.
- When the user describes a role or skills, extract filters and return uiCommands.
- Prefer short replies under 80 words.
- Respond ONLY with JSON:
{
  "reply": "string",
  "actions": [{ "id": "directory"|"book", "label": "string", "href": "/talent" }],
  "uiCommands": [
    { "type": "APPLY_DIRECTORY_FILTERS", "payload": { "dept": "customer-support", "q": "zendesk", "maxFee": 800, "availability": ["immediate"], "roleType": ["fulltime"] } },
    { "type": "OPEN_BOOKING", "payload": { "talentId": "uuid" } },
    { "type": "NAVIGATE", "payload": { "href": "/talent" } }
  ]
}
Department ids: ai-automation, admin-operations, account-coordinators, marketing-content, virtual-assistants, customer-support, sales, hr, it-technical, finance.
Only include talentId in OPEN_BOOKING if the user named a specific talent id you were given — otherwise filter the directory.`;
}

function sanitizeUiCommands(commands) {
  if (!Array.isArray(commands)) return [];
  const allowed = new Set(['APPLY_DIRECTORY_FILTERS', 'OPEN_TALENT_CARD', 'OPEN_BOOKING', 'NAVIGATE', 'HIGHLIGHT_SECTION']);
  return commands
    .filter((c) => c && allowed.has(String(c.type)))
    .map((c) => ({
      type: String(c.type),
      payload: c.payload && typeof c.payload === 'object' ? c.payload : {},
    }))
    .slice(0, 5);
}

function normalizeClientPayload(parsed, fallbackText) {
  const reply = String(parsed?.reply || fallbackText || '').trim() || fallbackText;
  const actions = Array.isArray(parsed?.actions)
    ? parsed.actions
        .map((a) => ({
          id: String(a?.id || 'directory'),
          label: String(a?.label || 'Browse talent').slice(0, 60),
          href: String(a?.href || '/talent'),
          external: false,
        }))
        .slice(0, 3)
    : [];
  const uiCommands = sanitizeUiCommands(parsed?.uiCommands);
  return { reply, actions, uiCommands };
}

function publicClientContext(client) {
  return {
    role: 'client',
    company: client?.company || null,
    guideNotificationCount: 0,
    guideNotificationLabel: 'Describe a role — I will filter talent live',
  };
}

function mapMessages(messages) {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    actions: m.actions || [],
    pricingTip: null,
    uiCommands: m.metadata?.uiCommands || [],
    createdAt: m.created_at,
  }));
}

async function loadChatSession({ user, client }) {
  const session = await getOrCreateSession(user.id);
  let messages = await listMessages(session.id);

  if (messages.length === 0) {
    const company = client?.company ? ` for ${client.company}` : '';
    const saved = await insertMessage(session.id, {
      role: 'assistant',
      content: `Hi! I'm BGuides${company}. Tell me the role, skills, or budget you need — I'll filter the talent directory on this page so you can request intro calls.`,
      actions: [{ id: 'directory', label: 'Browse talent directory', href: '/talent' }],
      metadata: {
        kind: 'welcome',
        uiCommands: [{ type: 'NAVIGATE', payload: { href: '/talent' } }],
      },
    });
    messages = [saved];
  }

  return {
    session: { id: session.id, updatedAt: session.updated_at },
    context: publicClientContext(client),
    messages: mapMessages(messages),
  };
}

async function sendChatMessage({ user, client, message }) {
  const text = String(message || '').trim().slice(0, 2000);
  if (!text) {
    const err = new Error('Message is required.');
    err.code = 'MESSAGE_REQUIRED';
    throw err;
  }

  const session = await getOrCreateSession(user.id);
  const history = await listMessages(session.id, 20);
  await insertMessage(session.id, { role: 'user', content: text });

  const intent = matchClientIntent(text);
  if (intent.matched) {
    const saved = await insertMessage(session.id, {
      role: 'assistant',
      content: intent.reply,
      actions: intent.actions || [],
      metadata: { kind: 'intent', uiCommands: intent.uiCommands || [] },
    });
    return {
      message: {
        id: saved.id,
        role: 'assistant',
        content: saved.content,
        actions: saved.actions,
        pricingTip: null,
        uiCommands: intent.uiCommands || [],
        createdAt: saved.created_at,
      },
      context: publicClientContext(client),
    };
  }

  let rawAssistant;
  try {
    rawAssistant = await callLlm(
      buildClientSystemPrompt(client),
      history.map((m) => ({ role: m.role, content: m.content })),
      text
    );
  } catch (err) {
    console.error('[clientChat] LLM error:', err?.message || err);
    const filters = extractDirectoryFilters(text);
    const uiCommands = filtersToUiCommands(filters);
    const fallback = normalizeClientPayload(
      {
        reply: uiCommands.length
          ? 'I filtered the directory based on what you described. Browse the cards and request an intro when ready.'
          : 'I had trouble reaching the AI service. Try browsing the talent directory, or rephrase the role you need.',
        actions: [{ id: 'directory', label: 'Browse talent', href: '/talent' }],
        uiCommands: uiCommands.length ? uiCommands : [{ type: 'NAVIGATE', payload: { href: '/talent' } }],
      },
      'Try the talent directory.'
    );
    const saved = await insertMessage(session.id, {
      role: 'assistant',
      content: fallback.reply,
      actions: fallback.actions,
      metadata: { uiCommands: fallback.uiCommands, error: true },
    });
    return {
      message: {
        id: saved.id,
        role: 'assistant',
        content: saved.content,
        actions: saved.actions,
        pricingTip: null,
        uiCommands: fallback.uiCommands,
        createdAt: saved.created_at,
      },
      context: publicClientContext(client),
    };
  }

  const parsed = parseAssistantJson(rawAssistant);
  let normalized = normalizeClientPayload(parsed, String(rawAssistant).slice(0, 500));

  // Always try to attach directory filter commands when user clearly searching.
  if (!normalized.uiCommands.length) {
    const filters = extractDirectoryFilters(text);
    normalized.uiCommands = filtersToUiCommands(filters);
  }

  const saved = await insertMessage(session.id, {
    role: 'assistant',
    content: normalized.reply,
    actions: normalized.actions,
    metadata: { uiCommands: normalized.uiCommands },
  });

  return {
    message: {
      id: saved.id,
      role: 'assistant',
      content: saved.content,
      actions: saved.actions,
      pricingTip: null,
      uiCommands: normalized.uiCommands,
      createdAt: saved.created_at,
    },
    context: publicClientContext(client),
  };
}

module.exports = {
  loadChatSession,
  sendChatMessage,
  extractDirectoryFilters,
};

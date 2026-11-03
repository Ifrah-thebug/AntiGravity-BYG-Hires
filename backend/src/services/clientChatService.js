/**
 * BGuides client chat — hiring assistant with UI sync commands (directory filters / booking).
 * Reuses talent_chat_* tables keyed by user_id (profile_id stays null for clients).
 */

const { supabaseAdmin } = require('../middleware/requireAdmin');
const groq = require('./groqClient');
const openRouter = require('./openRouterClient');
const { buildClientHiringContext } = require('./clientHiringContextService');
const { buildTalentOnboardingContext } = require('./talentOnboardingContextService');
const {
  formatTalentStatusReply,
  formatClientStatusReply,
  isTalentProfileStatusQuery,
  isClientHiringStatusQuery,
} = require('./bguidesStatusReplyService');

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

/**
 * Match a department key against text without short-token false positives
 * (e.g. "ai" inside "available"). Prefers longest matching key across all depts.
 */
function keyMatchesText(text, key) {
  const k = String(key || '').trim().toLowerCase();
  if (!k || !text) return false;
  if (k.length <= 3) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(text);
  }
  return text.includes(k);
}

function matchDepartmentId(text) {
  let best = null;
  for (const dept of DEPARTMENT_HINTS) {
    for (const key of dept.keys || []) {
      if (!keyMatchesText(text, key)) continue;
      const score = String(key).length;
      if (!best || score > best.score) {
        best = { id: dept.id, score, key };
      }
    }
  }
  return best?.id || null;
}

/** True when the message is chat/help, not a talent search. */
function looksLikeConversationalChat(text) {
  const q = String(text || '').toLowerCase().trim();
  if (!q) return false;
  if (/\?$/.test(q)) return true;
  return /\b(what|why|how|when|should i|can you|could you|tell me|do i|is my|am i|my profile|incomplete|improve|onboarding|assessment|score|company name|help me finish)\b/.test(
    q
  );
}

/**
 * Only treat as a directory search when the user is clearly hiring/filtering.
 * Avoids dumping "what should I improve on my profile?" into the search box.
 */
function hasHiringSearchIntent(text) {
  const q = String(text || '').toLowerCase().trim();
  if (!q || looksLikeConversationalChat(q)) return false;
  return (
    /\b(browse|find(?:\s+me)?|search(?:\s+for)?|looking for|need a|hire|show me|filter(?:\s+by)?|shortlist)\b/.test(
      q
    ) ||
    /\$\s*\d{3,4}/.test(q) ||
    /\bunder\s+\$?\d{3,4}\b/.test(q) ||
    /\b(available immediately|full[- ]?time|part[- ]?time)\b/.test(q) ||
    Boolean(matchDepartmentId(q))
  );
}

function isPlausibleSkillQuery(value) {
  const q = String(value || '').trim().toLowerCase();
  if (!q || q.length < 2 || q.length > 40) return false;
  if (/[?]/.test(q)) return false;
  if (looksLikeConversationalChat(q)) return false;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;
  return true;
}

function extractDirectoryFilters(text, { allowFreeTextQ = false } = {}) {
  const q = String(text || '').toLowerCase();
  const filters = {
    dept: null,
    q: null,
    maxFee: null,
    availability: [],
    roleType: [],
    sort: null,
  };

  filters.dept = matchDepartmentId(q);

  const topMatch = q.match(/\btop\s+(\d{1,2})\b/);
  if (topMatch) {
    filters.sort = 'score-desc';
  }

  const skillMatch = q.match(/\b(?:with|who know|skilled in|experience in)\s+([a-z0-9.+#/\- ]{2,40})/i);
  if (skillMatch) {
    const skill = skillMatch[1].trim().replace(/\s+(and|or|please).*$/i, '').trim();
    if (isPlausibleSkillQuery(skill)) filters.q = skill;
  } else if (allowFreeTextQ && !filters.dept) {
    // Only for confirmed hiring intents — never dump full chat sentences into q.
    const free = q
      .replace(/\b(i need|looking for|find me|show me|search for|hire|want|top\s+\d+)\b/gi, ' ')
      .replace(/\b(talent|candidate|candidates|person|people|someone|a|an|the)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (isPlausibleSkillQuery(free)) filters.q = free;
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

function hasMeaningfulFilters(filters) {
  if (!filters) return false;
  return Boolean(
    filters.dept ||
      filters.q ||
      filters.maxFee ||
      filters.sort ||
      (filters.availability && filters.availability.length) ||
      (filters.roleType && filters.roleType.length)
  );
}

function filtersToPayload(filters) {
  if (!filters) return {};
  const payload = {};
  if (filters.dept) payload.dept = filters.dept;
  if (filters.q) payload.q = filters.q;
  if (filters.maxFee) payload.maxFee = filters.maxFee;
  if (filters.availability?.length) payload.availability = filters.availability;
  if (filters.roleType?.length) payload.roleType = filters.roleType;
  if (filters.sort) payload.sort = filters.sort;
  return payload;
}

function filtersToDirectoryHref(filters) {
  const payload = filtersToPayload(filters);
  const params = new URLSearchParams();
  if (payload.dept && payload.dept !== 'all') params.set('dept', String(payload.dept));
  if (payload.q) params.set('q', String(payload.q));
  if (payload.sort) params.set('sort', String(payload.sort));
  const qs = params.toString();
  return qs ? `/talent?${qs}` : '/talent';
}

function filtersToUiCommands(filters) {
  const payload = filtersToPayload(filters);
  if (!Object.keys(payload).length) return [];
  return [{ type: 'APPLY_DIRECTORY_FILTERS', payload }];
}

function directoryActionFromFilters(filters, label = 'View filtered directory') {
  const uiCommands = filtersToUiCommands(filters);
  const href = filtersToDirectoryHref(filters);
  return {
    id: 'directory',
    label,
    href,
    external: false,
    uiCommands,
  };
}

async function fetchTalentProfileForUser(userId) {
  if (!supabaseAdmin || !userId) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(
      'id, user_id, email, name, job_title, about, skills, best_skill, experience_years, department, monthly_fee_usd, directory_fee_usd, availability, role_type, photo_url, cv_url, directory_status, review_notes, review_issues, cal_username, created_at, updated_at'
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * @param {string} text
 * @param {{ user?: object, hiringCtx?: object, backendBaseUrl?: string }} opts
 */
async function matchClientIntent(text, { user, hiringCtx, backendBaseUrl } = {}) {
  const q = String(text || '').toLowerCase().trim();
  if (!q) return { matched: false };

  if (/\b(book|intro call|schedule|request intro)\b/.test(q) && /\b(talent|them|candidate|him|her)\b/.test(q)) {
    return {
      matched: true,
      reply:
        'Open a talent card on the directory, then use Request intro — or tell me a name/role and I will filter the list so you can book.',
      actions: [{ id: 'directory', label: 'Browse talent directory', href: '/talent' }],
      uiCommands: [],
    };
  }

  if (hasHiringSearchIntent(q)) {
    const filters = extractDirectoryFilters(q, { allowFreeTextQ: true });
    if (!hasMeaningfulFilters(filters)) {
      return {
        matched: true,
        reply:
          'Tell me the role, skill, budget, or department and I’ll filter the talent directory — for example “virtual assistants under $700”.',
        actions: [{ id: 'directory', label: 'Browse talent directory', href: '/talent' }],
        uiCommands: [],
      };
    }
    const uiCommands = filtersToUiCommands(filters);
    const action = directoryActionFromFilters(filters);
    const bits = [];
    if (filters.dept) bits.push(`department filter`);
    if (filters.q) bits.push(`skills “${filters.q}”`);
    if (filters.maxFee) bits.push(`max fee $${filters.maxFee}`);
    if (filters.sort) bits.push('top matches first');
    const summary = bits.length ? bits.join(', ') : 'the live directory';
    return {
      matched: true,
      reply: `Updating the talent directory for ${summary}. Pick a card to request an intro call.`,
      actions: [action],
      uiCommands,
    };
  }

  if (/\b(what can you do|help|how does this work)\b/.test(q)) {
    return {
      matched: true,
      reply:
        'I help you hire on BYG Hires: describe the role or skills you need, I filter the talent directory live, then you can request an intro call from a shortlist. Ask “what should I do next?” anytime for your hiring checklist.',
      actions: [{ id: 'directory', label: 'Open talent directory', href: '/talent' }],
      uiCommands: [],
    };
  }

  // Hiring status / what’s next — facts + open the place to act
  if (isClientHiringStatusQuery(q) && !isTalentProfileStatusQuery(q)) {
    const formatted = formatClientStatusReply(hiringCtx || {});
    return {
      matched: true,
      reply: formatted.reply,
      actions: formatted.actions,
      uiCommands: formatted.uiCommands || [],
    };
  }

  // Explicit talent profile completeness only — no bare score/portfolio/calendar catch-all
  if (isTalentProfileStatusQuery(q)) {
    let talentProfile = null;
    try {
      talentProfile = user?.id ? await fetchTalentProfileForUser(user.id) : null;
    } catch (err) {
      console.warn('[clientChat] talent profile lookup:', err?.message || err);
    }

    if (talentProfile) {
      try {
        const talentCtx = await buildTalentOnboardingContext({
          user,
          profile: talentProfile,
          currentPath: null,
          backendBaseUrl: backendBaseUrl || null,
        });
        const formatted = formatTalentStatusReply(talentCtx);
        return {
          matched: true,
          reply:
            `${formatted.reply}\n\n(You’re in the hiring chat shell — this audit is from your talent profile.)`,
          actions: [
            ...(formatted.actions || []),
            { id: 'portal', label: 'Open talent portal', href: '/portal' },
          ].slice(0, 2),
          uiCommands: formatted.uiCommands || [],
        };
      } catch (err) {
        console.warn('[clientChat] talent status build:', err?.message || err);
      }
    }

    const formatted = formatClientStatusReply(hiringCtx || {});
    return {
      matched: true,
      reply:
        `${formatted.reply}\n\nThis BGuides session is hiring-focused (no talent profile on this account). Company and booking status above are what I can check here.`,
      actions: formatted.actions,
      uiCommands: formatted.uiCommands || [],
    };
  }

  // Everything else → LLM with HIRING CONTEXT
  return { matched: false };
}

function buildClientSystemPrompt(client, hiringCtx) {
  const company = client?.company || hiringCtx?.company || 'your company';
  const hiringJson = JSON.stringify(
    {
      company: hiringCtx?.company || client?.company || null,
      needsCompany: Boolean(hiringCtx?.needsCompany),
      needsHiringCriteria: Boolean(hiringCtx?.needsHiringCriteria),
      upcomingIntroCount: hiringCtx?.upcomingIntroCount || 0,
      totalBookingCount: hiringCtx?.totalBookingCount || 0,
      pendingPortfolioCount: hiringCtx?.pendingPortfolioCount || 0,
      activeAiInterviewCount: hiringCtx?.activeAiInterviewCount || 0,
      nextSteps: (hiringCtx?.nextSteps || []).slice(0, 5),
    },
    null,
    2
  );

  return `You are BGuides — the hiring assistant for BYG Hires clients (${company}).
Help them find remote talent and book intro calls.

Rules:
- Stay on hiring / directory / intro booking. No unrelated tutorials.
- Answer the user’s specific question using HIRING CONTEXT facts. Do NOT dump the full hiring checklist unless they asked what’s missing / what’s next / how they’re doing.
- When they do ask status/completeness, answer with facts from HIRING CONTEXT first (company set?, bookings, pending requests). Do NOT only say “open the dashboard.”
- ONLY emit APPLY_DIRECTORY_FILTERS when the user is clearly searching for talent (role, skill, budget, department).
- NEVER put full chat sentences, questions, or profile talk into filters.q — use short skill/role keywords only (max 4 words).
- Prefer short replies under 100 words; lead with concrete status when relevant.
- Respond ONLY with JSON:
{
  "reply": "string",
  "actions": [{ "id": "directory"|"book"|"company", "label": "string", "href": "/talent" }],
  "uiCommands": [
    { "type": "APPLY_DIRECTORY_FILTERS", "payload": { "dept": "customer-support", "q": "zendesk", "maxFee": 800, "availability": ["immediate"], "roleType": ["fulltime"] } },
    { "type": "OPEN_BOOKING", "payload": { "talentId": "uuid" } },
    { "type": "NAVIGATE", "payload": { "href": "/talent" } },
    { "type": "HIGHLIGHT_SECTION", "payload": { "sectionId": "client-company", "pathname": "/client" } }
  ]
}
Department ids: ai-automation, admin-operations, account-coordinators, marketing-content, virtual-assistants, customer-support, sales, hr, it-technical, finance.
Only include talentId in OPEN_BOOKING if the user named a specific talent id you were given — otherwise filter the directory.
Omit uiCommands entirely when you are not applying filters or navigation.

HIRING CONTEXT:
${hiringJson}`;
}

function sanitizeFilterPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const next = {};
  if (payload.dept) next.dept = String(payload.dept);
  if (payload.sort) next.sort = String(payload.sort);
  if (Number.isFinite(Number(payload.maxFee)) && Number(payload.maxFee) > 0) {
    next.maxFee = Number(payload.maxFee);
  }
  if (Array.isArray(payload.availability) && payload.availability.length) {
    next.availability = payload.availability.map(String);
  }
  if (Array.isArray(payload.roleType) && payload.roleType.length) {
    next.roleType = payload.roleType.map(String);
  }
  if (payload.q != null && isPlausibleSkillQuery(payload.q)) {
    next.q = String(payload.q).trim();
  }
  return Object.keys(next).length ? next : null;
}

function sanitizeUiCommands(commands) {
  if (!Array.isArray(commands)) return [];
  const allowed = new Set(['APPLY_DIRECTORY_FILTERS', 'OPEN_TALENT_CARD', 'OPEN_BOOKING', 'NAVIGATE', 'HIGHLIGHT_SECTION']);
  return commands
    .filter((c) => c && allowed.has(String(c.type)))
    .map((c) => {
      const type = String(c.type);
      let payload = c.payload && typeof c.payload === 'object' ? c.payload : {};
      if (type === 'APPLY_DIRECTORY_FILTERS') {
        payload = sanitizeFilterPayload(payload);
        if (!payload) return null;
      }
      return { type, payload };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function enrichActionsWithFilterCommands(actions, uiCommands) {
  const filterCmd = (uiCommands || []).find((c) => c.type === 'APPLY_DIRECTORY_FILTERS');
  const filterHref = filterCmd ? filtersToDirectoryHref(filterCmd.payload || {}) : '/talent';
  return (actions || []).map((a) => {
    if (String(a.id) !== 'directory') return a;
    const href = a.href && a.href !== '/talent' ? a.href : filterHref;
    return {
      ...a,
      href,
      uiCommands: filterCmd ? [filterCmd] : a.uiCommands || [],
    };
  });
}

function normalizeClientPayload(parsed, fallbackText, fallbackFilters = null, { applyFallbackFilters = false } = {}) {
  const reply = String(parsed?.reply || fallbackText || '').trim() || fallbackText;
  let uiCommands = sanitizeUiCommands(parsed?.uiCommands);
  // Never invent directory filters from random chat — only when caller confirms hiring intent.
  if (
    !uiCommands.length &&
    applyFallbackFilters &&
    fallbackFilters &&
    hasMeaningfulFilters(fallbackFilters)
  ) {
    uiCommands = filtersToUiCommands(fallbackFilters);
  }
  let actions = Array.isArray(parsed?.actions)
    ? parsed.actions
        .map((a) => ({
          id: String(a?.id || 'directory'),
          label: String(a?.label || 'Browse talent').slice(0, 60),
          href: String(a?.href || '/talent'),
          external: false,
        }))
        .slice(0, 3)
    : [];
  if (!actions.length && uiCommands.some((c) => c.type === 'APPLY_DIRECTORY_FILTERS')) {
    actions = [directoryActionFromFilters(fallbackFilters || uiCommands[0].payload)];
  } else {
    actions = enrichActionsWithFilterCommands(actions, uiCommands);
  }
  return { reply, actions, uiCommands };
}

function publicClientContext(hiringCtx) {
  const notes = hiringCtx?.guideNotifications || {};
  return {
    role: 'client',
    company: hiringCtx?.company || null,
    nextSteps: hiringCtx?.nextSteps || [],
    needsCompany: Boolean(hiringCtx?.needsCompany),
    needsHiringCriteria: Boolean(hiringCtx?.needsHiringCriteria),
    upcomingIntroCount: hiringCtx?.upcomingIntroCount || 0,
    guideNotificationCount: Number(notes.notificationCount) || 0,
    guideNotificationLabel: notes.primaryLabel || 'Describe a role — I will filter talent live',
    completionLabel: notes.completionLabel || null,
  };
}

async function maybeAppendClientHiringNudge(sessionId, hiringCtx) {
  const notes = hiringCtx?.guideNotifications || {};
  if (!notes.needsCompany && !notes.needsHiringCriteria && !(notes.upcomingIntroCount > 0)) {
    return null;
  }

  const { data: recent } = await supabaseAdmin
    .from('talent_chat_messages')
    .select('id, metadata')
    .eq('session_id', sessionId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(16);

  const triggers = new Set((recent || []).map((m) => m.metadata?.trigger).filter(Boolean));

  if (notes.needsCompany && !triggers.has('company_missing')) {
    return insertMessage(sessionId, {
      role: 'assistant',
      content:
        'Add your company name on the client dashboard so intro invites look professional. I can highlight the field for you.',
      actions: [{ id: 'company', label: 'Set company name', href: '/client#client-company' }],
      metadata: {
        kind: 'proactive',
        trigger: 'company_missing',
        uiCommands: [
          {
            type: 'HIGHLIGHT_SECTION',
            payload: { sectionId: 'client-company', pathname: '/client' },
          },
        ],
      },
    });
  }

  if (notes.needsHiringCriteria && !triggers.has('hiring_criteria_missing')) {
    return insertMessage(sessionId, {
      role: 'assistant',
      content:
        'Tell me the role, skills, or budget you need — I’ll filter the talent directory live so you can request intros.',
      actions: [
        {
          id: 'directory',
          label: 'Browse talent directory',
          href: '/talent',
          uiCommands: [{ type: 'NAVIGATE', payload: { href: '/talent' } }],
        },
      ],
      metadata: {
        kind: 'proactive',
        trigger: 'hiring_criteria_missing',
      },
    });
  }

  if (notes.upcomingIntroCount > 0 && !triggers.has('intro_prep')) {
    const n = notes.upcomingIntroCount;
    return insertMessage(sessionId, {
      role: 'assistant',
      content:
        n === 1
          ? 'You have an upcoming intro call. Skim the talent’s portfolio and skills beforehand, and join a couple of minutes early.'
          : `You have ${n} upcoming intro calls. Skim each talent’s portfolio and skills beforehand, and join a couple of minutes early.`,
      actions: [{ id: 'dashboard', label: 'Open client dashboard', href: '/client' }],
      metadata: { kind: 'proactive', trigger: 'intro_prep' },
    });
  }

  return null;
}

async function getNotifications({ client }) {
  const hiringCtx = await buildClientHiringContext({ client });
  return {
    guideNotificationCount: Number(hiringCtx.guideNotifications?.notificationCount) || 0,
    guideNotificationLabel: hiringCtx.guideNotifications?.primaryLabel || null,
    nextStep: hiringCtx.nextSteps?.[0] || null,
    completionLabel: hiringCtx.guideNotifications?.completionLabel || null,
    context: publicClientContext(hiringCtx),
  };
}

function mapMessages(messages) {
  return messages.map((m) => {
    const uiCommands = m.metadata?.uiCommands || [];
    const actions = (m.actions || []).map((a) => {
      if (a?.uiCommands?.length) return a;
      if (String(a?.id) === 'directory' && uiCommands.length) {
        return { ...a, uiCommands };
      }
      return a;
    });
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      actions,
      pricingTip: null,
      uiCommands,
      createdAt: m.created_at,
    };
  });
}

async function deleteAllSessionsForUser(userId) {
  if (!supabaseAdmin || !userId) return;
  const { data: sessions, error } = await supabaseAdmin
    .from('talent_chat_sessions')
    .select('id')
    .eq('user_id', userId);
  if (error) throw error;
  const ids = (sessions || []).map((s) => s.id).filter(Boolean);
  if (!ids.length) return;
  const { error: msgErr } = await supabaseAdmin
    .from('talent_chat_messages')
    .delete()
    .in('session_id', ids);
  if (msgErr) throw msgErr;
  const { error: sessErr } = await supabaseAdmin
    .from('talent_chat_sessions')
    .delete()
    .in('id', ids);
  if (sessErr) throw sessErr;
}

async function loadChatSession({ user, client }) {
  const hiringCtx = await buildClientHiringContext({ client });
  const session = await getOrCreateSession(user.id);
  let messages = await listMessages(session.id);

  if (messages.length === 0) {
    const company = hiringCtx.company ? ` for ${hiringCtx.company}` : '';
    const saved = await insertMessage(session.id, {
      role: 'assistant',
      content: hiringCtx.needsCompany
        ? `Hi! I'm BGuides${company}. First, add your company name on the dashboard, then tell me the role you need and I’ll filter talent live.`
        : `Hi! I'm BGuides${company}. Tell me the role, skills, or budget you need — I'll filter the talent directory so you can request intro calls.`,
      actions: hiringCtx.needsCompany
        ? [{ id: 'company', label: 'Set company name', href: '/client#client-company' }]
        : [{ id: 'directory', label: 'Browse talent directory', href: '/talent' }],
      metadata: {
        kind: 'welcome',
        // Intentionally no auto-NAVIGATE on welcome — avoids remounting the page on open.
      },
    });
    messages = [saved];
  } else {
    const nudge = await maybeAppendClientHiringNudge(session.id, hiringCtx);
    if (nudge) messages = [...messages, nudge];
  }

  return {
    session: { id: session.id, updatedAt: session.updated_at },
    context: publicClientContext(hiringCtx),
    messages: mapMessages(messages),
  };
}

/** Wipe history and reload so welcome / proactive nudges run again. */
async function clearChatSession({ user, client }) {
  await deleteAllSessionsForUser(user.id);
  return loadChatSession({ user, client });
}

async function sendChatMessage({ user, client, message }) {
  const text = String(message || '').trim().slice(0, 2000);
  if (!text) {
    const err = new Error('Message is required.');
    err.code = 'MESSAGE_REQUIRED';
    throw err;
  }

  const hiringCtx = await buildClientHiringContext({ client });
  const session = await getOrCreateSession(user.id);
  const history = await listMessages(session.id, 20);
  await insertMessage(session.id, { role: 'user', content: text });

  const intent = await matchClientIntent(text, {
    user,
    hiringCtx,
    backendBaseUrl: process.env.BACKEND_PUBLIC_URL || null,
  });
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
      context: publicClientContext(hiringCtx),
    };
  }

  let rawAssistant;
  try {
    rawAssistant = await callLlm(
      buildClientSystemPrompt(client, hiringCtx),
      history.map((m) => ({ role: m.role, content: m.content })),
      text
    );
  } catch (err) {
    console.error('[clientChat] LLM error:', err?.message || err);
    const wantsSearch = hasHiringSearchIntent(text);
    const filters = wantsSearch
      ? extractDirectoryFilters(text, { allowFreeTextQ: true })
      : null;
    const uiCommands =
      wantsSearch && hasMeaningfulFilters(filters) ? filtersToUiCommands(filters) : [];
    const fallback = normalizeClientPayload(
      {
        reply: uiCommands.length
          ? 'I filtered the directory based on what you described. Browse the cards and request an intro when ready.'
          : 'I had trouble reaching the AI service. Try browsing the talent directory, or rephrase the role you need.',
        actions: uiCommands.length
          ? [directoryActionFromFilters(filters, 'Browse talent')]
          : [{ id: 'directory', label: 'Browse talent', href: '/talent' }],
        uiCommands,
      },
      'Try the talent directory.',
      filters,
      { applyFallbackFilters: false }
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
      context: publicClientContext(hiringCtx),
    };
  }

  const parsed = parseAssistantJson(rawAssistant);
  const wantsSearch = hasHiringSearchIntent(text);
  const heuristicFilters = wantsSearch
    ? extractDirectoryFilters(text, { allowFreeTextQ: true })
    : null;
  let normalized = normalizeClientPayload(
    parsed,
    String(rawAssistant).slice(0, 500),
    heuristicFilters,
    { applyFallbackFilters: wantsSearch }
  );

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
    context: publicClientContext(hiringCtx),
  };
}

module.exports = {
  loadChatSession,
  clearChatSession,
  sendChatMessage,
  getNotifications,
  matchClientIntent,
  extractDirectoryFilters,
  filtersToDirectoryHref,
  hasHiringSearchIntent,
  looksLikeConversationalChat,
  keyMatchesText,
  matchDepartmentId,
};

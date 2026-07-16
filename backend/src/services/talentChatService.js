const { supabaseAdmin } = require('../middleware/requireAdmin');
const groq = require('./groqClient');
const openRouter = require('./openRouterClient');
const { buildTalentOnboardingContext, isProfileOnWaitlist } = require('./talentOnboardingContextService');

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash';

const PROFILE_SELECT =
  'id, user_id, email, name, job_title, about, skills, best_skill, experience_years, department, monthly_fee_usd, directory_fee_usd, availability, role_type, photo_url, cv_url, directory_status, review_notes, review_issues, cal_username, created_at, updated_at';

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

const WAITLIST_BLOCKED_ACTIONS = new Set(['portal-photo']);

function sanitizeActions(actions, actionCatalog, ctx) {
  if (!Array.isArray(actions)) return [];

  const catalogById = actionCatalog || {};
  const seen = new Set();
  const onWaitlist = isProfileOnWaitlist(ctx?.profile);

  return actions
    .map((action) => {
      const id = String(action?.id || '').trim();
      if (onWaitlist && WAITLIST_BLOCKED_ACTIONS.has(id)) return null;

      const catalog = catalogById[id];
      if (!catalog) return null;

      const label = String(action?.label || catalog.label || '').trim().slice(0, 80);
      const href = String(action?.href || catalog.href || '').trim();
      if (!label || !href || seen.has(id)) return null;
      seen.add(id);

      return {
        id,
        label,
        href,
        external: Boolean(action?.external ?? catalog.external),
      };
    })
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeAssistantPayload(parsed, actionCatalog, fallbackText, ctx) {
  const reply = String(parsed?.reply || parsed?.message || fallbackText || '').trim();
  const actions = sanitizeActions(parsed?.actions, actionCatalog, ctx);

  let pricingTip = null;
  if (parsed?.pricingTip && typeof parsed.pricingTip === 'object') {
    const monthly = Number(parsed.pricingTip.suggestedMonthlyUsd);
    const directory = Number(parsed.pricingTip.suggestedDirectoryUsd);
    if (Number.isFinite(monthly) && monthly > 0) {
      pricingTip = {
        suggestedMonthlyUsd: Math.round(monthly),
        suggestedDirectoryUsd: Number.isFinite(directory) && directory > 0
          ? Math.round(directory)
          : Math.round(monthly * 1.1),
        rationale: String(parsed.pricingTip.rationale || '').trim().slice(0, 400),
      };
    }
  }

  return {
    reply: (reply || 'I am here to help you finish your BYG Hires profile. What would you like to work on next?')
      .slice(0, 760),
    actions,
    pricingTip,
  };
}

function pickSmartActionId(ctx) {
  const nextSteps = ctx?.nextSteps || [];
  const catalog = ctx?.actionCatalog || {};

  if (ctx.pendingPortfolioRequestCount > 0 && catalog['portal-portfolio-requests']) {
    return 'portal-portfolio-requests';
  }

  if (!nextSteps.length) return catalog.portal ? 'portal' : null;

  if (isProfileOnWaitlist(ctx?.profile)) {
    const waitlistOrder = ['calendar', 'assessment', 'intro-slots', 'portfolio', 'portal-pricing', 'guide'];
    for (const id of waitlistOrder) {
      if (!catalog[id]) continue;
      if (id === 'calendar' && ctx.calendarConnected) continue;
      if (id === 'assessment' && ctx.assessmentCount > 0) continue;
      if (id === 'intro-slots' && (!ctx.calendarConnected || ctx.introSlotsCount > 0)) continue;
      if (id === 'portfolio' && ctx.portfolioProjectCount > 0) continue;
      if (nextSteps.some((s) => s.id === id)) return id;
    }
    const firstWaitlist = nextSteps.find((s) => s?.id && catalog[s.id]);
    return firstWaitlist?.id || null;
  }

  // Avoid always defaulting to "Update photo" as the only CTA.
  const firstNonPhoto = nextSteps.find((s) => s?.id && s.id !== 'portal-photo' && catalog[s.id]);
  if (firstNonPhoto) return firstNonPhoto.id;

  if (catalog.portal) return 'portal';
  const firstAny = nextSteps.find((s) => s?.id && catalog[s.id]);
  return firstAny?.id || null;
}

function buildSystemPrompt(ctx) {
  const nextStep = ctx.nextSteps?.[0];
  const onWaitlist = isProfileOnWaitlist(ctx.profile);
  const catalogJson = JSON.stringify(
    Object.entries(ctx.actionCatalog || {}).map(([id, a]) => ({ id, label: a.label, href: a.href, external: a.external })),
    null,
    0
  );

  const waitlistRules = onWaitlist
    ? `
WAITLIST MODE (directory_status = pending_review):
- The talent already submitted their profile — it is on the admin review waitlist.
- Do NOT suggest changing or uploading their profile photo unless they explicitly ask.
- You MAY still suggest: connecting Cal.com calendar, skills tests, pricing tweaks (with pricingTip), portfolio projects, and intro availability.
- Speak like a helpful teammate, not a robot reading a checklist. No stiff "Step 1 / Step 2" language.
- If calendarConnected is false, warmly encourage connecting their calendar — clients can book intros as soon as they're approved.
- Skills tests and portfolio work help them stand out while waiting.
`
    : '';

  return `You are BGuides — the friendly onboarding assistant for BYG Hires talent (candidates joining the hiring directory).

GOALS:
1. Help talent complete their profile and get approved faster.
2. Suggest competitive pricing that reflects their experience and skills (directory fee = monthly × 1.1).
3. Recommend ONE clear next action with a deep link when helpful.
4. Write natural, human responses in 2-3 short paragraphs (around 90-160 words).
${waitlistRules}
RULES:
- SCOPE ONLY: BYG Hires talent onboarding — profile, directory approval, portfolio, pricing, skills tests, AI interview, calendar/intros, sharing, and how this platform works for talent.
- OUT OF SCOPE — refuse politely and briefly: general programming/tech tutorials (e.g. "how C++ works", language syntax, algorithms), homework/school help, unrelated career advice outside BYG Hires, news, politics, personal life, medical/legal advice, writing code for them, or any topic not about using BYG Hires as talent.
- When out of scope: do NOT give definitions, explanations, or tutorials. Say you're only here for their BYG Hires profile journey, then offer one relevant next step (actions from the catalog). Keep "reply" under ~60 words.
- Never claim admin approved/rejected unless directory_status says so.
- Never invent review feedback — only cite review_notes and review_issues from context.
- Do not include phone, email, or LinkedIn in profile text suggestions.
- Voice interview only when interviewUnlocked is true; requires skills test first.
- When pendingPortfolioRequestCount > 0, prioritize reviewing portfolio requests — a client wants to see their work. Encourage polishing portfolio before approving if project count is low.
- Pricing suggestions should use pricing.suggestedRecommendedUsd as anchor unless talent asks otherwise.
- If pricing.currentMonthlyUsd exists, acknowledge that exact saved value first and avoid suggesting a lower number by default.
- When suggesting pricing, explain how verified skills and experience justify the rate.
- Avoid repeating the same recommendation sentence across consecutive replies.
- End with one friendly follow-up question to keep conversation flowing — except on out-of-scope refusals, where one short redirect question is enough.
- Always respond with VALID JSON only (no markdown outside JSON):

{
  "reply": "your message to the talent",
  "actions": [{ "id": "action_id_from_catalog", "label": "short button label" }],
  "pricingTip": {
    "suggestedMonthlyUsd": 400,
    "suggestedDirectoryUsd": 440,
    "rationale": "one sentence"
  }
}

Include "actions" with 1-2 items whenever possible so the talent can take immediate action. Use action ids ONLY from the catalog.
Include "pricingTip" only when discussing pricing or when monthly fee is missing/low vs suggestion.
Omit pricingTip key when not relevant.

ACTION CATALOG:
${catalogJson}

TALENT CONTEXT:
${JSON.stringify({
  currentPath: ctx.currentPath,
  profile: ctx.profile,
  nextSteps: ctx.nextSteps?.slice(0, 5),
  calendarConnected: ctx.calendarConnected,
  assessmentCount: ctx.assessmentCount,
  assessmentScores: ctx.assessmentScores,
  introSlotsCount: ctx.introSlotsCount,
  portfolioProjectCount: ctx.portfolioProjectCount,
  pendingPortfolioRequestCount: ctx.pendingPortfolioRequestCount,
  interviewUnlocked: ctx.interviewUnlocked,
  interviewCompleted: ctx.interviewCompleted,
  pricing: ctx.pricing,
  topPriority: nextStep || null,
}, null, 2)}`;
}

async function callGeminiChat(systemPrompt, history, userMessage) {
  if (!GEMINI_API_KEY) {
    const err = new Error('Gemini API key not configured');
    err.status = 503;
    throw err;
  }

  const contents = [
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.error?.message || `Gemini error ${response.status}`);
    err.status = response.status;
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

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CHAT_LLM_TIMEOUT_MS = 45000;
const CHAT_LLM_ATTEMPTS = 2;

async function callLlm(systemPrompt, history, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.filter((m) => m.role === 'user' || m.role === 'assistant'),
    { role: 'user', content: userMessage },
  ];

  const groqOpts = {
    model: groq.getDefaultModel(),
    temperature: 0.35,
    maxOutputTokens: 700,
    timeoutMs: CHAT_LLM_TIMEOUT_MS,
  };

  if (groq.isGroqEnabled()) {
    for (let attempt = 0; attempt < CHAT_LLM_ATTEMPTS; attempt++) {
      try {
        return await groq.callGroqChat(messages, groqOpts);
      } catch (err) {
        const retryable = groq.isTransientGroqError(err);
        if (retryable && attempt < CHAT_LLM_ATTEMPTS - 1) {
          console.warn(`[talentChat] Groq retry ${attempt + 1}/${CHAT_LLM_ATTEMPTS}:`, err?.message || err);
          await sleep(1200 * (attempt + 1));
          continue;
        }
        console.warn('[talentChat] Groq failed, trying OpenRouter:', err?.message || err);
        break;
      }
    }
  }

  const openRouterOpts = {
    model: openRouter.getDefaultModel(),
    temperature: 0.35,
    maxOutputTokens: 700,
    timeoutMs: CHAT_LLM_TIMEOUT_MS,
  };

  if (openRouter.isOpenRouterEnabled()) {
    for (let attempt = 0; attempt < CHAT_LLM_ATTEMPTS; attempt++) {
      try {
        return await openRouter.callOpenRouterChat(messages, openRouterOpts);
      } catch (err) {
        const retryable = openRouter.isTransientOpenRouterError(err);
        if (retryable && attempt < CHAT_LLM_ATTEMPTS - 1) {
          console.warn(`[talentChat] OpenRouter retry ${attempt + 1}/${CHAT_LLM_ATTEMPTS}:`, err?.message || err);
          await sleep(1200 * (attempt + 1));
          continue;
        }
        console.warn('[talentChat] OpenRouter failed, trying Gemini:', err?.message || err);
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
        console.warn(`[talentChat] Gemini retry ${attempt + 1}/${CHAT_LLM_ATTEMPTS}:`, err?.message || err);
        await sleep(1200 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw new Error('All AI providers failed');
}

async function fetchFullProfile(userId) {
  if (!supabaseAdmin || !userId) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getOrCreateSession(userId, profileId) {
  const { data: existing, error: findErr } = await supabaseAdmin
    .from('talent_chat_sessions')
    .select('id, user_id, profile_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    if (profileId && existing.profile_id !== profileId) {
      await supabaseAdmin
        .from('talent_chat_sessions')
        .update({ profile_id: profileId, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return existing;
  }

  const { data: created, error: createErr } = await supabaseAdmin
    .from('talent_chat_sessions')
    .insert({ user_id: userId, profile_id: profileId || null })
    .select('id, user_id, profile_id, created_at, updated_at')
    .single();

  if (createErr) {
    // Another concurrent request may have created the session first.
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

/** Serialize chat turns per user so concurrent messages keep correct history order. */
const userChatQueues = new Map();

function runWithUserChatLock(userId, task) {
  if (!userId) return task();
  const previous = userChatQueues.get(userId) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  userChatQueues.set(userId, current);
  return current.finally(() => {
    if (userChatQueues.get(userId) === current) userChatQueues.delete(userId);
  });
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
    .insert({
      session_id: sessionId,
      role,
      content,
      actions,
      metadata,
    })
    .select('id, role, content, actions, metadata, created_at')
    .single();
  if (error) throw error;

  await supabaseAdmin
    .from('talent_chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  return data;
}

function buildWelcomeMessage(ctx) {
  const name = ctx.profile?.name?.split(' ')?.[0] || 'there';
  const next = ctx.nextSteps?.[0];
  const status = ctx.profile?.directory_status || 'draft';

  let reply = `Hi ${name}! I'm BGuides — I'll help you finish your profile and get in front of clients faster.`;

  if (ctx.pendingPortfolioRequestCount > 0) {
    const n = ctx.pendingPortfolioRequestCount;
    reply += ` You have ${n} client portfolio request${n > 1 ? 's' : ''} waiting — someone wants to see your work. Review ${n > 1 ? 'them' : 'it'} in your portal when you have a moment`;
    if (!ctx.portfolioProjectCount) {
      reply += ' and consider adding a project first so you make a strong impression';
    }
    reply += '.';
  } else if (!ctx.profile) {
    reply += ' Start by completing your profile setup — I can walk you through every step.';
  } else if (status === 'pending_review') {
    if (!ctx.calendarConnected) {
      reply += ' Your profile is with our team for review — nice work getting it submitted. While you wait, I\'d connect your calendar if you haven\'t yet. That way, when you\'re approved, clients can book intro calls right away instead of you scrambling to set things up.';
    } else if (!ctx.assessmentCount) {
      reply += ' Your profile is on the review waitlist and your calendar is already linked — you\'re ahead of the game. A skills test is a great way to stand out while the team reviews your profile.';
    } else {
      reply += ' Your profile is in the review queue and you\'re in solid shape. Happy to help with intro availability or anything else while you wait.';
    }
  } else if (status === 'changes_requested') {
    reply += ' Admin sent feedback on your profile. I can help you fix those items and resubmit.';
  } else if (status === 'approved') {
    reply += ' Great news — your profile is live! Let\'s strengthen it so clients book more intros.';
  } else if (next) {
    reply += ` Your top priority: **${next.label}**.`;
  }

  if (ctx.pricing?.currentMonthlyUsd) {
    reply += ` Your saved pricing is $${ctx.pricing.currentMonthlyUsd}/mo (clients see $${ctx.pricing.currentDirectoryUsd}).`;
  } else if (ctx.pricing?.suggestedRecommendedUsd) {
    reply += ` Based on your experience, consider pricing around $${ctx.pricing.suggestedRecommendedUsd}/mo (clients see $${ctx.pricing.suggestedDirectoryUsd} incl. platform fee).`;
  }

  const actions = [];
  const preferredActionId = pickSmartActionId(ctx);
  if (preferredActionId && ctx.actionCatalog[preferredActionId]) {
    actions.push({
      id: preferredActionId,
      label: ctx.actionCatalog[preferredActionId].label,
      href: ctx.actionCatalog[preferredActionId].href,
      external: ctx.actionCatalog[preferredActionId].external || false,
    });
  } else if (next && ctx.actionCatalog[next.id]) {
    actions.push({
      id: next.id,
      label: ctx.actionCatalog[next.id].label,
      href: ctx.actionCatalog[next.id].href,
      external: ctx.actionCatalog[next.id].external || false,
    });
  } else if (ctx.actionCatalog.portal) {
    actions.push({ id: 'portal', ...ctx.actionCatalog.portal });
  }

  const tipMonthly = ctx.pricing?.currentMonthlyUsd || ctx.pricing?.suggestedRecommendedUsd || null;
  const tipDirectory = ctx.pricing?.currentDirectoryUsd || ctx.pricing?.suggestedDirectoryUsd || null;
  const pricingTip =
    tipMonthly
      ? {
          suggestedMonthlyUsd: tipMonthly,
          suggestedDirectoryUsd: tipDirectory || Math.round(tipMonthly * 1.1),
          rationale: ctx.pricing?.currentMonthlyUsd
            ? 'Using your latest saved pricing from profile context.'
            : `Suggested from ${ctx.pricing.factors.experienceYears} yrs experience${ctx.pricing.factors.averageAssessmentScore ? ` and ${ctx.pricing.factors.averageAssessmentScore}% avg skills score` : ''}.`,
        }
      : null;

  return { reply, actions, pricingTip };
}

async function maybeAppendPortfolioRequestNudge(sessionId, ctx) {
  if (!ctx.pendingPortfolioRequestCount || ctx.pendingPortfolioRequestCount <= 0) return null;

  const { data: recent } = await supabaseAdmin
    .from('talent_chat_messages')
    .select('id, metadata, created_at')
    .eq('session_id', sessionId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(5);

  const alreadyNudged = (recent || []).some(
    (m) => m.metadata?.trigger === 'portfolio_request_pending'
  );
  if (alreadyNudged) return null;

  const n = ctx.pendingPortfolioRequestCount;
  const reply =
    `You have ${n} pending portfolio request${n > 1 ? 's' : ''} from client${n > 1 ? 's' : ''} who want to see your work. ` +
    (ctx.portfolioProjectCount
      ? 'Review and approve them in your portal when you are ready.'
      : 'Before you approve, consider adding or polishing a portfolio project — it helps you stand out.');

  const actions = [];
  if (ctx.actionCatalog['portal-portfolio-requests']) {
    actions.push({ id: 'portal-portfolio-requests', ...ctx.actionCatalog['portal-portfolio-requests'] });
  }
  if (ctx.actionCatalog.portfolio) {
    actions.push({ id: 'portfolio', ...ctx.actionCatalog.portfolio });
  }

  return insertMessage(sessionId, {
    role: 'assistant',
    content: reply,
    actions,
    metadata: { kind: 'proactive', trigger: 'portfolio_request_pending' },
  });
}

async function maybeAppendOnboardingGapNudge(sessionId, ctx) {
  const notes = ctx.guideNotifications || {};
  if (!notes.needsSkillsTest && !notes.needsPortfolio) return null;

  const { data: recent } = await supabaseAdmin
    .from('talent_chat_messages')
    .select('id, metadata, created_at')
    .eq('session_id', sessionId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(12);

  const triggers = new Set((recent || []).map((m) => m.metadata?.trigger).filter(Boolean));

  // Prefer skills test first; then portfolio. Skip if already nudged for that gap.
  if (notes.needsSkillsTest && !triggers.has('skills_test_missing')) {
    const actions = [];
    if (ctx.actionCatalog.assessment) {
      actions.push({ id: 'assessment', ...ctx.actionCatalog.assessment });
    }
    return insertMessage(sessionId, {
      role: 'assistant',
      content:
        'Quick reminder: you haven’t taken a skills test yet. Verified skill scores help you stand out on the directory and support stronger pricing — it usually takes about 25 minutes.',
      actions,
      metadata: { kind: 'proactive', trigger: 'skills_test_missing' },
    });
  }

  if (notes.needsPortfolio && !triggers.has('portfolio_missing')) {
    const actions = [];
    if (ctx.actionCatalog.portfolio) {
      actions.push({ id: 'portfolio', ...ctx.actionCatalog.portfolio });
    } else if (ctx.actionCatalog['portal-portfolio']) {
      actions.push({ id: 'portal-portfolio', ...ctx.actionCatalog['portal-portfolio'] });
    }
    return insertMessage(sessionId, {
      role: 'assistant',
      content:
        'Your portfolio storybook is still empty. Adding even one published project makes a big difference when clients open your profile or request portfolio access.',
      actions,
      metadata: { kind: 'proactive', trigger: 'portfolio_missing' },
    });
  }

  return null;
}

function publicChatContext(ctx) {
  const notes = ctx.guideNotifications || {};
  return {
    nextSteps: ctx.nextSteps,
    pricing: ctx.pricing,
    directoryStatus: ctx.profile?.directory_status || null,
    profileComplete: Boolean(ctx.profile?.name && ctx.profile?.job_title),
    pendingPortfolioRequestCount: ctx.pendingPortfolioRequestCount || 0,
    assessmentCount: ctx.assessmentCount || 0,
    portfolioProjectCount: ctx.portfolioProjectCount || 0,
    needsSkillsTest: Boolean(notes.needsSkillsTest),
    needsPortfolio: Boolean(notes.needsPortfolio),
    guideNotificationCount: Number(notes.notificationCount) || 0,
    guideNotificationLabel: notes.primaryLabel || null,
  };
}

async function loadChatSession({ user, currentPath, backendBaseUrl }) {
  const profile = await fetchFullProfile(user.id);
  const ctx = await buildTalentOnboardingContext({
    user,
    profile,
    currentPath,
    backendBaseUrl,
  });

  const session = await getOrCreateSession(user.id, profile?.id || null);
  let messages = await listMessages(session.id);

  if (messages.length === 0) {
    const welcome = buildWelcomeMessage(ctx);
    const saved = await insertMessage(session.id, {
      role: 'assistant',
      content: welcome.reply,
      actions: welcome.actions,
      metadata: { pricingTip: welcome.pricingTip, kind: 'welcome' },
    });
    messages = [saved];
  } else {
    const requestNudge = await maybeAppendPortfolioRequestNudge(session.id, ctx);
    if (requestNudge) messages = [...messages, requestNudge];
    const gapNudge = await maybeAppendOnboardingGapNudge(session.id, ctx);
    if (gapNudge) messages = [...messages, gapNudge];
  }

  return {
    session: { id: session.id, updatedAt: session.updated_at },
    context: publicChatContext(ctx),
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      actions: m.actions || [],
      pricingTip: m.metadata?.pricingTip || null,
      createdAt: m.created_at,
    })),
  };
}

async function sendChatMessageImpl({ user, message, currentPath, backendBaseUrl }) {
  const text = String(message || '').trim().slice(0, 2000);
  if (!text) {
    const err = new Error('Message is required.');
    err.code = 'MESSAGE_REQUIRED';
    throw err;
  }

  const profile = await fetchFullProfile(user.id);
  const ctx = await buildTalentOnboardingContext({
    user,
    profile,
    currentPath,
    backendBaseUrl,
  });

  const session = await getOrCreateSession(user.id, profile?.id || null);
  const history = await listMessages(session.id, 20);

  await insertMessage(session.id, { role: 'user', content: text });

  const systemPrompt = buildSystemPrompt(ctx);
  const llmHistory = history.map((m) => ({ role: m.role, content: m.content }));

  let rawAssistant;
  try {
    rawAssistant = await callLlm(systemPrompt, llmHistory, text);
  } catch (err) {
    console.error('[talentChat] LLM error:', err?.message || err);
    const fallback = normalizeAssistantPayload(
      null,
      ctx.actionCatalog,
      'I had trouble reaching the AI service. Try again in a moment, or use the action buttons below to jump to your portal.',
      ctx
    );
    const id = pickSmartActionId(ctx);
    if (id && ctx.actionCatalog[id]) {
      fallback.actions = [{ id, ...ctx.actionCatalog[id] }];
    }
    const saved = await insertMessage(session.id, {
      role: 'assistant',
      content: fallback.reply,
      actions: fallback.actions,
      metadata: { pricingTip: fallback.pricingTip, error: true },
    });
    return {
      message: {
        id: saved.id,
        role: 'assistant',
        content: saved.content,
        actions: saved.actions,
        pricingTip: saved.metadata?.pricingTip || null,
        createdAt: saved.created_at,
      },
      context: publicChatContext(ctx),
    };
  }

  const parsed = parseAssistantJson(rawAssistant);
  const normalized = normalizeAssistantPayload(parsed, ctx.actionCatalog, rawAssistant, ctx);
  if ((!normalized.actions || normalized.actions.length === 0)) {
    const id = pickSmartActionId(ctx);
    if (id && ctx.actionCatalog[id]) {
      normalized.actions = [{ id, ...ctx.actionCatalog[id] }];
    }
  }

  const saved = await insertMessage(session.id, {
    role: 'assistant',
    content: normalized.reply,
    actions: normalized.actions,
    metadata: { pricingTip: normalized.pricingTip },
  });

  return {
    message: {
      id: saved.id,
      role: 'assistant',
      content: saved.content,
      actions: saved.actions,
      pricingTip: saved.metadata?.pricingTip || null,
      createdAt: saved.created_at,
    },
    context: publicChatContext(ctx),
  };
}

async function sendChatMessage(params) {
  const text = String(params?.message || '').trim().slice(0, 2000);
  if (!text) {
    const err = new Error('Message is required.');
    err.code = 'MESSAGE_REQUIRED';
    throw err;
  }
  return runWithUserChatLock(params.user?.id, () => sendChatMessageImpl(params));
}

module.exports = {
  loadChatSession,
  sendChatMessage,
  fetchFullProfile,
};

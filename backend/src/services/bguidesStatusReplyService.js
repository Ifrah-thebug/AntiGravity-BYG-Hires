/**
 * Data-backed BGuides status replies — answer with account facts first, CTAs second.
 */

function catalogAction(ctx, id, labelOverride) {
  const entry = ctx?.actionCatalog?.[id];
  if (!entry) return null;
  return {
    id,
    label: labelOverride || entry.label,
    href: entry.href,
    external: Boolean(entry.external),
  };
}

/** Map talent next-step id → UI sync for the place to act. */
function talentUiCommandsForStep(stepId, { currentPath } = {}) {
  const id = String(stepId || '');
  const sectionMap = {
    'portal-photo': { sectionId: 'profile-photo', pathname: '/portal' },
    'portal-pricing': { sectionId: 'profile-pricing', pathname: '/portal' },
    'submit-review': { sectionId: 'profile-submit', pathname: '/portal' },
    calendar: { sectionId: 'client-intro-scheduling', pathname: '/portal' },
    'intro-slots': { sectionId: 'client-intro-scheduling', pathname: '/portal' },
    'portal-slots': { sectionId: 'client-intro-scheduling', pathname: '/portal' },
    portfolio: { sectionId: 'talent-portfolio', pathname: '/portal' },
    'portal-portfolio': { sectionId: 'talent-portfolio', pathname: '/portal' },
    'portal-portfolio-requests': { sectionId: 'talent-portfolio', pathname: '/portal' },
    portal: { sectionId: null, pathname: '/portal' },
    assessment: { sectionId: null, pathname: '/assessment' },
  };
  const target = sectionMap[id] || (id ? null : { sectionId: null, pathname: '/portal' });
  if (!target) return [];
  const cmds = [];
  const curPath = String(currentPath || '').split(/[?#]/)[0];
  const alreadyOnPage = curPath === target.pathname;
  if (!alreadyOnPage && target.pathname) {
    cmds.push({
      type: 'NAVIGATE',
      payload: {
        href: target.sectionId ? `${target.pathname}#${target.sectionId}` : target.pathname,
      },
    });
  }
  if (target.sectionId) {
    cmds.push({
      type: 'HIGHLIGHT_SECTION',
      payload: { sectionId: target.sectionId, pathname: target.pathname },
    });
  }
  return cmds;
}

/**
 * Derive UI sync commands from assistant action buttons so the background
 * page follows what the chat is talking about (portal sections + /assessment etc.).
 * @param {Array<{ id?: string, href?: string }>} actions
 * @param {{ currentPath?: string }} [opts]
 */
function uiCommandsFromActions(actions, { currentPath } = {}) {
  const cmds = [];
  const seen = new Set();
  const push = (cmd) => {
    if (!cmd?.type) return;
    const key = `${cmd.type}:${JSON.stringify(cmd.payload || {})}`;
    if (seen.has(key)) return;
    seen.add(key);
    cmds.push(cmd);
  };

  for (const action of actions || []) {
    const id = String(action?.id || '').trim();
    if (id) {
      for (const c of talentUiCommandsForStep(id, { currentPath })) push(c);
    }

    const href = String(action?.href || '').trim();
    if (!href || href.startsWith('http')) continue;

    const hashIndex = href.indexOf('#');
    if (hashIndex >= 0) {
      const pathPart = href.slice(0, hashIndex);
      const sectionId = href.slice(hashIndex + 1).split('?')[0];
      const queryIndex = pathPart.indexOf('?');
      const pathname = queryIndex >= 0 ? pathPart.slice(0, queryIndex) : pathPart || '/portal';
      const search = queryIndex >= 0 ? pathPart.slice(queryIndex) : '';
      if (sectionId) {
        const onPath = String(currentPath || '').startsWith(pathname);
        if (!onPath) {
          push({ type: 'NAVIGATE', payload: { href: `${pathname}${search}#${sectionId}` } });
        }
        push({
          type: 'HIGHLIGHT_SECTION',
          payload: { sectionId, pathname, search },
        });
      }
      continue;
    }

    // Plain internal paths (e.g. /assessment, /interview, /portal)
    const queryIndex = href.indexOf('?');
    const pathname = (queryIndex >= 0 ? href.slice(0, queryIndex) : href) || '';
    if (!pathname.startsWith('/')) continue;
    // Skip if talentUiCommandsForStep already covered this action id
    if (id && ['assessment', 'interview', 'portal', 'calendar', 'intro-slots', 'portfolio'].includes(id)) {
      continue;
    }
    const cur = String(currentPath || '').split(/[?#]/)[0];
    if (cur !== pathname) {
      push({ type: 'NAVIGATE', payload: { href } });
    }
  }

  return cmds.slice(0, 4);
}

/**
 * Build a short talent profile audit from onboarding context.
 * @param {object} ctx — buildTalentOnboardingContext result
 * @returns {{ reply: string, actions: array, uiCommands: array }}
 */
function formatTalentStatusReply(ctx) {
  const notes = ctx?.guideNotifications || {};
  const status = String(ctx?.profile?.directory_status || 'draft').toLowerCase();
  const nextSteps = Array.isArray(ctx?.nextSteps) ? ctx.nextSteps : [];
  const next = nextSteps[0];

  const done = [];
  const pending = [];

  if (ctx?.profile?.has_photo) done.push('Professional photo');
  else if (notes.needsPhoto || nextSteps.some((s) => s.id === 'portal-photo')) {
    pending.push('Add a professional photo');
  }

  if (ctx?.profile?.has_cv) done.push('CV uploaded');
  else if (notes.needsCv || nextSteps.some((s) => /cv|resume/i.test(String(s.label || '')))) {
    pending.push('Upload your CV');
  }

  if (ctx?.calendarConnected) done.push('Calendar (Cal.com) connected');
  else if (notes.needsCalendar) pending.push('Connect calendar (Cal.com)');

  if (Number(ctx?.introSlotsCount) > 0) done.push(`Intro slots published (${ctx.introSlotsCount})`);
  else if (notes.needsIntroSlots) pending.push('Publish intro slots');

  if (Number(ctx?.assessmentCount) > 0) {
    const avg = notes.averageAssessmentScore;
    done.push(
      Number.isFinite(avg)
        ? `Skills tests taken (avg ${avg}%)`
        : `Skills tests taken (${ctx.assessmentCount})`
    );
  } else if (notes.needsSkillsTest) {
    pending.push('Take a skills test');
  }

  if (notes.needsScoreImprovement && notes.lowScoreSkills?.length) {
    const bits = notes.lowScoreSkills
      .slice(0, 3)
      .map((s) => `${s.skill} ${s.score}%`)
      .join(', ');
    pending.push(`Improve low scores: ${bits}`);
  }

  if (Number(ctx?.portfolioProjectCount) > 0) {
    done.push(`Published portfolio projects (${ctx.portfolioProjectCount})`);
  } else if (notes.needsPortfolio) {
    pending.push('Publish a portfolio project');
  }

  if (Number(ctx?.pendingPortfolioRequestCount) > 0) {
    pending.push(
      `${ctx.pendingPortfolioRequestCount} portfolio request${ctx.pendingPortfolioRequestCount > 1 ? 's' : ''} waiting`
    );
  }

  // Catch remaining checklist items not already covered (dedupe calendar/Cal.com wording)
  for (const step of nextSteps.slice(0, 6)) {
    const label = String(step.label || '').trim();
    if (!label) continue;
    if (pending.some((p) => p.toLowerCase() === label.toLowerCase())) continue;
    if (done.some((d) => label.toLowerCase().includes(d.toLowerCase().slice(0, 12)))) continue;
    const isCal =
      /\b(calendar|cal\.com)\b/i.test(label) &&
      pending.some((p) => /\b(calendar|cal\.com)\b/i.test(p));
    if (isCal) continue;
    pending.push(label);
  }

  const uniquePending = [];
  const seen = new Set();
  for (const p of pending) {
    const key = p.toLowerCase().replace(/\s+/g, ' ').trim();
    // Soft-dedupe near-duplicate calendar lines
    const calKey = /\b(calendar|cal\.com)\b/.test(key) ? '__calendar__' : key;
    if (seen.has(calKey) || seen.has(key)) continue;
    seen.add(calKey);
    seen.add(key);
    uniquePending.push(p);
  }

  let reply = `Here’s your talent profile status (**${status.replace(/_/g, ' ')}**):\n`;
  if (done.length) {
    reply += `\nLooking good:\n${done.slice(0, 6).map((d) => `• ${d}`).join('\n')}`;
  }
  if (uniquePending.length) {
    reply += `\n\nStill to do:\n${uniquePending.slice(0, 5).map((p) => `• ${p}`).join('\n')}`;
  } else {
    reply += '\n\nNothing critical is pending — keep slots fresh and respond quickly to clients.';
  }
  if (next?.label) {
    reply += `\n\nTop priority: **${next.label}**.`;
  }

  const actions = [];
  const topId = next?.id;
  const topAction = (topId && catalogAction(ctx, topId)) || catalogAction(ctx, 'portal', 'Open portal');
  if (topAction) actions.push(topAction);
  const portal = catalogAction(ctx, 'portal', 'Open portal');
  if (portal && portal.id !== topAction?.id) actions.push(portal);

  const uiCommands = next?.id
    ? talentUiCommandsForStep(next.id, { currentPath: ctx?.currentPath })
    : talentUiCommandsForStep('portal', { currentPath: ctx?.currentPath });

  return { reply: reply.trim(), actions: actions.slice(0, 2), uiCommands };
}

/**
 * Client hiring next-step → open the right surface in the background.
 */
function clientUiCommandsForHiring(hiringCtx) {
  if (hiringCtx?.needsCompany) {
    return [
      { type: 'NAVIGATE', payload: { href: '/client#client-company' } },
      {
        type: 'HIGHLIGHT_SECTION',
        payload: { sectionId: 'client-company', pathname: '/client' },
      },
    ];
  }
  if (Number(hiringCtx?.upcomingIntroCount) > 0 && !hiringCtx?.needsHiringCriteria) {
    return [{ type: 'NAVIGATE', payload: { href: '/client' } }];
  }
  if (hiringCtx?.needsHiringCriteria) {
    return [{ type: 'NAVIGATE', payload: { href: '/talent' } }];
  }
  return [];
}

/**
 * Build a short client hiring status reply.
 * @param {object} hiringCtx — buildClientHiringContext result
 * @returns {{ reply: string, actions: array, uiCommands: array }}
 */
function formatClientStatusReply(hiringCtx) {
  const company = String(hiringCtx?.company || '').trim();
  const nextSteps = Array.isArray(hiringCtx?.nextSteps) ? hiringCtx.nextSteps : [];
  const next = nextSteps[0];

  const done = [];
  const pending = [];

  if (company) done.push(`Company set (${company})`);
  else pending.push('Add your company name');

  if (Number(hiringCtx?.totalBookingCount) > 0) {
    done.push(`Intro bookings on record (${hiringCtx.totalBookingCount})`);
  } else if (hiringCtx?.needsHiringCriteria) {
    pending.push('Describe the role / skills / budget you need');
  }

  if (Number(hiringCtx?.upcomingIntroCount) > 0) {
    done.push(`Upcoming intros (${hiringCtx.upcomingIntroCount})`);
  }

  if (Number(hiringCtx?.pendingPortfolioCount) > 0) {
    pending.push(
      `${hiringCtx.pendingPortfolioCount} portfolio request${hiringCtx.pendingPortfolioCount > 1 ? 's' : ''} awaiting talent`
    );
  }

  if (Number(hiringCtx?.activeAiInterviewCount) > 0) {
    pending.push(
      `${hiringCtx.activeAiInterviewCount} AI interview${hiringCtx.activeAiInterviewCount > 1 ? 's' : ''} in progress`
    );
  }

  let reply = 'Here’s your hiring setup status:\n';
  if (done.length) {
    reply += `\nIn place:\n${done.map((d) => `• ${d}`).join('\n')}`;
  }
  if (pending.length) {
    reply += `\n\nNext for you:\n${pending.slice(0, 5).map((p) => `• ${p}`).join('\n')}`;
  } else {
    reply += '\n\nYou’re set to search — tell me a role, skill, or budget and I’ll filter talent.';
  }
  if (next?.label) {
    reply += `\n\nTop priority: **${next.label}**.`;
  }

  const actions = [];
  if (hiringCtx?.needsCompany) {
    actions.push({ id: 'company', label: 'Set company name', href: '/client#client-company' });
  }
  actions.push({ id: 'directory', label: 'Browse talent directory', href: '/talent' });

  return {
    reply: reply.trim(),
    actions: actions.slice(0, 2),
    uiCommands: clientUiCommandsForHiring(hiringCtx),
  };
}

function isTalentProfileStatusQuery(text) {
  const q = String(text || '').toLowerCase();
  // Exclude client "company profile" phrasing — that is hiring setup, not talent onboarding.
  if (/\bcompany\s+profile\b/.test(q)) return false;
  // Exclude score / skills-test questions — those have a dedicated intent (or LLM).
  if (
    /\b(skills?\s+test\s+score|test\s+score|my\s+scores?|assessment\s+score|how\s+did\s+i\s+score|what\s+is\s+my\s+score)\b/.test(
      q
    )
  ) {
    return false;
  }
  // Explicit completeness / gap language only — no bare "score" or "assessment".
  return /\b(my profile|incomplete|profile complete|what.?s missing|improve.*(profile|account)|what else.*(do|need)|audit my profile|finish my profile|gaps? in my profile)\b/.test(
    q
  );
}

function isClientHiringStatusQuery(text) {
  const q = String(text || '').toLowerCase();
  return (
    /\b(what should i do|what.?s next|how am i doing|my (hiring )?status|company name|company profile|missing company|fill.*(company|profile)|left to fill|prep for (my )?intro)\b/.test(
      q
    ) || q === 'next' || q === 'status'
  );
}

module.exports = {
  formatTalentStatusReply,
  formatClientStatusReply,
  talentUiCommandsForStep,
  uiCommandsFromActions,
  clientUiCommandsForHiring,
  isTalentProfileStatusQuery,
  isClientHiringStatusQuery,
  catalogAction,
};

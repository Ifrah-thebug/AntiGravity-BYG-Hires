/**
 * Deterministic BGuides intents for talent — LLM-independent core answers.
 */

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s#?/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function uiForAction(action) {
  if (!action?.href) return [];
  const href = String(action.href);
  const hashIndex = href.indexOf('#');
  if (hashIndex < 0) {
    return [{ type: 'NAVIGATE', payload: { href } }];
  }
  const pathPart = href.slice(0, hashIndex);
  const sectionId = href.slice(hashIndex + 1).split('?')[0];
  const queryIndex = pathPart.indexOf('?');
  const pathname = queryIndex >= 0 ? pathPart.slice(0, queryIndex) : pathPart || '/portal';
  const search = queryIndex >= 0 ? pathPart.slice(queryIndex) : '';
  return [
    {
      type: 'HIGHLIGHT_SECTION',
      payload: { sectionId, pathname, search },
    },
  ];
}

/**
 * @returns {{ matched: false } | { matched: true, reply: string, actions: array, uiCommands: array }}
 */
function matchTalentChatIntent(text, ctx) {
  const q = normalize(text);
  if (!q) return { matched: false };

  const status = String(ctx?.profile?.directory_status || 'draft').toLowerCase();
  const next = ctx?.nextSteps?.[0];

  if (
    /\b(profile status|am i approved|directory status|waitlist|approved yet|my status)\b/.test(q) ||
    q === 'status'
  ) {
    let reply = `Your directory status is **${status.replace(/_/g, ' ')}**.`;
    if (status === 'pending_review') {
      reply += ' You are on the waitlist — we will email you when review finishes.';
    } else if (status === 'changes_requested') {
      const issues = Array.isArray(ctx?.profile?.review_issues) ? ctx.profile.review_issues : [];
      reply += issues.length
        ? ` Please fix: ${issues.slice(0, 3).join('; ')}.`
        : ' Please open your portal for the review notes, then resubmit.';
    } else if (status === 'approved') {
      reply += ' Your profile is live. Next: connect calendar and publish intro slots if you have not yet.';
    } else if (status === 'draft') {
      reply += ' Finish your profile and submit it for review from the portal.';
    }

    const actions = [];
    const portal = catalogAction(ctx, 'portal', 'Open portal');
    if (portal) actions.push(portal);
    if (status === 'approved') {
      const cal = catalogAction(ctx, 'calendar') || catalogAction(ctx, 'portal-calendar');
      if (cal) actions.push(cal);
    }

    return {
      matched: true,
      reply,
      actions,
      uiCommands: actions.flatMap(uiForAction),
    };
  }

  if (
    /\b(what is my score|what'?s my score|my (test )?score|my test results|assessment score|skills score|how did i score)\b/.test(
      q
    )
  ) {
    const scores = ctx?.assessmentScores || {};
    const entries = Object.entries(scores).filter(([, n]) => Number.isFinite(Number(n)));
    const notes = ctx?.guideNotifications || {};
    const actions = [];
    const assessment = catalogAction(ctx, 'assessment', 'Open skills tests');
    if (assessment) actions.push(assessment);

    if (!entries.length) {
      return {
        matched: true,
        reply:
          'You have not completed a skills test yet. Take one from the assessment page — scores help you stand out on the directory.',
        actions,
        uiCommands: [{ type: 'NAVIGATE', payload: { href: '/assessment' } }],
      };
    }

    const lines = entries
      .map(([skill, n]) => `• ${skill}: ${Math.round(Number(n))}%`)
      .join('\n');
    const avg = notes.averageAssessmentScore;
    let reply = `Your skills test results:\n${lines}`;
    if (Number.isFinite(avg)) reply += `\nAverage: ${avg}%.`;
    if (notes.needsScoreImprovement) {
      reply += ' A score under 70% is worth retaking — clients notice verified strength.';
    }

    return {
      matched: true,
      reply,
      actions,
      uiCommands: [{ type: 'NAVIGATE', payload: { href: '/assessment' } }],
    };
  }

  if (/\b(connect calendar|cal\.com|link calendar|calendar connect)\b/.test(q)) {
    const action =
      catalogAction(ctx, 'calendar', 'Connect calendar (Cal.com)') ||
      catalogAction(ctx, 'portal-calendar', 'Connect calendar (Cal.com)') ||
      catalogAction(ctx, 'portal', 'Open portal');
    const actions = action ? [action] : [];
    return {
      matched: true,
      reply: ctx?.calendarConnected
        ? 'Your calendar is already connected. Publish open intro slots so clients can book you.'
        : 'Connect your calendar (Cal.com) from your portal so clients can book intro calls.',
      actions,
      uiCommands: [
        {
          type: 'HIGHLIGHT_SECTION',
          payload: { sectionId: 'client-intro-scheduling', pathname: '/portal' },
        },
        ...actions.flatMap(uiForAction),
      ],
    };
  }

  if (
    /\b(what should i do next|next step|what.?s next|help me finish|what now)\b/.test(q) ||
    q === 'next'
  ) {
    if (!next) {
      return {
        matched: true,
        reply: 'You are in good shape — keep your intro slots fresh and respond quickly to client requests.',
        actions: catalogAction(ctx, 'portal') ? [catalogAction(ctx, 'portal')] : [],
        uiCommands: [],
      };
    }

    const action = catalogAction(ctx, next.id) || catalogAction(ctx, 'portal');
    const actions = action ? [action] : [];
    const sectionMap = {
      assessment: { sectionId: null, pathname: '/assessment' },
      calendar: { sectionId: 'client-intro-scheduling', pathname: '/portal' },
      'portal-slots': { sectionId: 'client-intro-scheduling', pathname: '/portal' },
      portfolio: { sectionId: 'talent-portfolio', pathname: '/portal' },
      'portal-portfolio': { sectionId: 'talent-portfolio', pathname: '/portal' },
      'portal-portfolio-requests': { sectionId: 'talent-portfolio', pathname: '/portal' },
    };
    const section = sectionMap[next.id];
    const uiCommands = [];
    if (section?.sectionId) {
      uiCommands.push({
        type: 'HIGHLIGHT_SECTION',
        payload: { sectionId: section.sectionId, pathname: section.pathname },
      });
    } else if (section?.pathname) {
      uiCommands.push({ type: 'NAVIGATE', payload: { href: section.pathname } });
    }

    return {
      matched: true,
      reply: `Next up: ${next.label}.`,
      actions,
      uiCommands: uiCommands.length ? uiCommands : actions.flatMap(uiForAction),
    };
  }

  if (/\b(publish slots|intro slots|availability slots|open slots)\b/.test(q)) {
    return {
      matched: true,
      reply: ctx?.calendarConnected
        ? 'Open Client intro scheduling on your portal and publish times clients can book.'
        : 'Connect your calendar first, then publish intro slots from the portal.',
      actions: [
        catalogAction(ctx, 'portal-slots') ||
          catalogAction(ctx, 'calendar') ||
          catalogAction(ctx, 'portal'),
      ].filter(Boolean),
      uiCommands: [
        {
          type: 'HIGHLIGHT_SECTION',
          payload: { sectionId: 'client-intro-scheduling', pathname: '/portal' },
        },
      ],
    };
  }

  return { matched: false };
}

module.exports = {
  matchTalentChatIntent,
};

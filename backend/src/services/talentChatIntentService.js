/**
 * Deterministic BGuides intents for talent — narrow rules first, then LLM.
 * Order: specific fact intents → directory status → completeness audit → fall through.
 */

const {
  formatTalentStatusReply,
  isTalentProfileStatusQuery,
  talentUiCommandsForStep,
} = require('./bguidesStatusReplyService');

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

function onPortalPath(ctx) {
  const path = String(ctx?.currentPath || '');
  return path.startsWith('/portal');
}

function isScoreQuery(q) {
  return /\b(what is my score|what'?s my score|my (test )?scores?|my test results|assessment score|skills? (test )?score|skills test score|how did i score|test scores?)\b/.test(
    q
  );
}

/**
 * @returns {{ matched: false } | { matched: true, reply: string, actions: array, uiCommands: array }}
 */
function matchTalentChatIntent(text, ctx) {
  const q = normalize(text);
  if (!q) return { matched: false };

  const status = String(ctx?.profile?.directory_status || 'draft').toLowerCase();
  const next = ctx?.nextSteps?.[0];
  const nextSteps = Array.isArray(ctx?.nextSteps) ? ctx.nextSteps : [];

  // 1) Scores — before any completeness audit
  if (isScoreQuery(q)) {
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
      uiCommands: notes.needsScoreImprovement
        ? [{ type: 'NAVIGATE', payload: { href: '/assessment' } }]
        : [],
    };
  }

  // 2) Calendar connect
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
      uiCommands: onPortalPath(ctx)
        ? [
            {
              type: 'HIGHLIGHT_SECTION',
              payload: { sectionId: 'client-intro-scheduling', pathname: '/portal' },
            },
          ]
        : talentUiCommandsForStep('calendar', { currentPath: ctx?.currentPath }),
    };
  }

  // 3) Intro slots
  if (/\b(publish slots|intro slots|availability slots|open slots)\b/.test(q)) {
    return {
      matched: true,
      reply: ctx?.calendarConnected
        ? 'Open Client intro scheduling on your portal and publish times clients can book.'
        : 'Connect your calendar first, then publish intro slots from the portal.',
      actions: [
        catalogAction(ctx, 'portal-slots') ||
          catalogAction(ctx, 'calendar') ||
          catalogAction(ctx, 'intro-slots') ||
          catalogAction(ctx, 'portal'),
      ].filter(Boolean),
      uiCommands: onPortalPath(ctx)
        ? [
            {
              type: 'HIGHLIGHT_SECTION',
              payload: { sectionId: 'client-intro-scheduling', pathname: '/portal' },
            },
          ]
        : talentUiCommandsForStep('intro-slots', { currentPath: ctx?.currentPath }),
    };
  }

  // 4) Next steps
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

    const bullets = nextSteps
      .slice(0, 3)
      .map((s) => `• ${s.label}`)
      .join('\n');
    let reply = `Here’s what to tackle next:\n${bullets}`;
    if (nextSteps.length > 3) {
      reply += `\n(+${nextSteps.length - 3} more)`;
    }
    reply += `\n\nStart with: **${next.label}**.`;

    const action = catalogAction(ctx, next.id) || catalogAction(ctx, 'portal');
    const actions = action ? [action] : [];
    const uiCommands = talentUiCommandsForStep(next.id, { currentPath: ctx?.currentPath });

    return {
      matched: true,
      reply,
      actions,
      uiCommands,
    };
  }

  // 5) Directory / approval status
  if (
    /\b(profile status|am i approved|directory status|waitlist|approved yet|my status)\b/.test(q) ||
    q === 'status'
  ) {
    const formatted = formatTalentStatusReply(ctx);
    let reply = formatted.reply;
    if (status === 'pending_review') {
      reply += '\n\nYou are on the review waitlist — we will email you when review finishes.';
    } else if (status === 'changes_requested') {
      const issues = Array.isArray(ctx?.profile?.review_issues) ? ctx.profile.review_issues : [];
      reply += issues.length
        ? `\n\nAdmin feedback to fix: ${issues.slice(0, 3).join('; ')}.`
        : '\n\nCheck review notes in your portal, then resubmit.';
    }

    return {
      matched: true,
      reply,
      actions: formatted.actions,
      uiCommands: formatted.uiCommands || [],
    };
  }

  // 6) Completeness audit last (narrow matcher only)
  if (isTalentProfileStatusQuery(q)) {
    const formatted = formatTalentStatusReply(ctx);
    return {
      matched: true,
      reply: formatted.reply,
      actions: formatted.actions,
      uiCommands: formatted.uiCommands || [],
    };
  }

  return { matched: false };
}

module.exports = {
  matchTalentChatIntent,
  isScoreQuery,
};

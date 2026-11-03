/**
 * Hiring checklist / notification signals for BGuides client chat.
 */

const { supabaseAdmin } = require('../middleware/requireAdmin');

async function safeCountUpcomingIntros(clientId) {
  if (!supabaseAdmin || !clientId) return 0;
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .select('id, status')
      .eq('client_id', clientId)
      .gte('start_at', nowIso);
    if (error) throw error;
    const inactive = new Set(['cancelled', 'canceled', 'rejected']);
    return (data || []).filter((b) => !inactive.has(String(b.status || '').toLowerCase())).length;
  } catch (err) {
    console.warn('[clientHiringContext] upcoming intros:', err?.message || err);
    return 0;
  }
}

async function safeCountPastBookings(clientId) {
  if (!supabaseAdmin || !clientId) return 0;
  try {
    const { count, error } = await supabaseAdmin
      .from('intro_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId);
    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.warn('[clientHiringContext] past bookings:', err?.message || err);
    return 0;
  }
}

async function safeCountPendingPortfolioRequests(client) {
  try {
    const portfolioAccessStore = require('./portfolioAccessRequestStore');
    const rows = await portfolioAccessStore.listRequestsForClient({
      clientEmail: client?.email,
      clientId: client?.id,
    });
    return (rows || []).filter((r) => String(r.status || '').toLowerCase() === 'pending').length;
  } catch (err) {
    console.warn('[clientHiringContext] portfolio requests:', err?.message || err);
    return 0;
  }
}

async function safeCountActiveAiInterviews(client) {
  try {
    const voiceInterviewRequestStore = require('./voiceInterviewRequestStore');
    const rows = await voiceInterviewRequestStore.listActiveRequestsForClient({
      clientEmail: client?.email,
      clientId: client?.id,
    });
    return (rows || []).length;
  } catch (err) {
    console.warn('[clientHiringContext] AI interviews:', err?.message || err);
    return 0;
  }
}

/**
 * @param {{ client: object }} params
 */
async function buildClientHiringContext({ client }) {
  const company = String(client?.company || '').trim();
  const needsCompany = !company;

  const [upcomingIntroCount, totalBookingCount, pendingPortfolioCount, activeAiInterviewCount] =
    await Promise.all([
      safeCountUpcomingIntros(client?.id),
      safeCountPastBookings(client?.id),
      safeCountPendingPortfolioRequests(client),
      safeCountActiveAiInterviews(client),
    ]);

  const needsHiringCriteria = totalBookingCount === 0;
  const hasUpcomingIntros = upcomingIntroCount > 0;

  const nextSteps = [];
  if (needsCompany) {
    nextSteps.push({
      id: 'company',
      label: 'Add your company name',
      prompt: 'Help me set my company name',
    });
  }
  if (needsHiringCriteria) {
    nextSteps.push({
      id: 'role',
      label: 'Describe the role you need',
      prompt: 'Find me a virtual assistant under $700',
    });
  }
  if (pendingPortfolioCount > 0) {
    nextSteps.push({
      id: 'portfolio_pending',
      label: `${pendingPortfolioCount} portfolio request${pendingPortfolioCount > 1 ? 's' : ''} awaiting talent`,
      prompt: 'What are my pending portfolio requests?',
    });
  }
  if (activeAiInterviewCount > 0) {
    nextSteps.push({
      id: 'ai_interview',
      label: `${activeAiInterviewCount} AI interview${activeAiInterviewCount > 1 ? 's' : ''} in progress`,
      prompt: 'How do my AI interview requests look?',
    });
  }
  if (hasUpcomingIntros) {
    nextSteps.push({
      id: 'prep',
      label: 'Prep for your upcoming intro',
      prompt: 'Help me prep for my intro call',
    });
  }
  if (!nextSteps.length) {
    nextSteps.push({
      id: 'search',
      label: 'Search the talent directory',
      prompt: 'Show customer support talent available immediately',
    });
  }

  const items = [];
  if (needsCompany) {
    items.push({ id: 'company', count: 1, label: 'Add your company name' });
  }
  if (needsHiringCriteria) {
    items.push({ id: 'role', count: 1, label: 'Tell me the role you need' });
  }
  if (pendingPortfolioCount > 0) {
    items.push({
      id: 'portfolio_pending',
      count: pendingPortfolioCount,
      label:
        pendingPortfolioCount === 1
          ? '1 portfolio request awaiting talent'
          : `${pendingPortfolioCount} portfolio requests awaiting talent`,
    });
  }
  if (activeAiInterviewCount > 0) {
    items.push({
      id: 'ai_interview',
      count: activeAiInterviewCount,
      label:
        activeAiInterviewCount === 1
          ? '1 AI interview in progress'
          : `${activeAiInterviewCount} AI interviews in progress`,
    });
  }
  if (hasUpcomingIntros) {
    items.push({
      id: 'prep',
      count: upcomingIntroCount,
      label:
        upcomingIntroCount === 1
          ? '1 upcoming intro — prep tip ready'
          : `${upcomingIntroCount} upcoming intros`,
    });
  }

  const notificationCount = items.reduce((sum, item) => sum + Math.min(item.count, 3), 0);
  const companySet = !needsCompany;
  const readyToSearch = companySet;

  return {
    company: company || null,
    needsCompany,
    needsHiringCriteria,
    upcomingIntroCount,
    totalBookingCount,
    pendingPortfolioCount,
    activeAiInterviewCount,
    hasUpcomingIntros,
    nextSteps,
    guideNotifications: {
      notificationCount,
      needsCompany,
      needsHiringCriteria,
      pendingPortfolioCount,
      activeAiInterviewCount,
      upcomingIntroCount,
      items,
      primaryLabel: items[0]?.label || 'Describe a role — I will filter talent live',
      completionLabel: companySet
        ? readyToSearch
          ? 'Company set · Ready to search'
          : 'Company set'
        : 'Add company to finish setup',
    },
  };
}

module.exports = {
  buildClientHiringContext,
};

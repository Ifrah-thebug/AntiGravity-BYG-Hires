const { supabaseAdmin } = require('../middleware/requireAdmin');
const portfolioStore = require('./portfolioAccessRequestStore');

async function getOrCreateChatSession(userId, profileId) {
  const { data: existing } = await supabaseAdmin
    .from('talent_chat_sessions')
    .select('id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabaseAdmin
    .from('talent_chat_sessions')
    .insert({ user_id: userId, profile_id: profileId || null })
    .select('id')
    .single();

  if (error) {
    const { data: raced } = await supabaseAdmin
      .from('talent_chat_sessions')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    return raced || null;
  }
  return created;
}

function formatClientLabel(clientName, company) {
  const name = String(clientName || '').trim();
  const co = String(company || '').trim();
  if (name && co) return `${name} from ${co}`;
  if (name) return name;
  if (co) return co;
  return 'A client';
}

/**
 * Insert a proactive BGuides message when a client requests portfolio access.
 */
async function notifyTalentPortfolioRequestViaChat({
  talentUserId,
  talentProfileId,
  clientName,
  company,
  pendingCount = 1,
}) {
  if (!supabaseAdmin || !talentUserId) return null;

  try {
    const session = await getOrCreateChatSession(talentUserId, talentProfileId);
    if (!session?.id) return null;

    const clientLabel = formatClientLabel(clientName, company);
    const reply =
      pendingCount > 1
        ? `${clientLabel} just asked to see your portfolio — you now have ${pendingCount} pending requests. Take a moment to review them in your portal. If your portfolio still needs work, this is a great chance to polish it before you approve.`
        : `${clientLabel} wants to see your portfolio. Head to your portal to approve or decline the request — and if you have a minute, add or polish a project so you put your best work forward.`;

    const actions = [
      {
        id: 'portal-portfolio-requests',
        label: 'Review portfolio requests',
        href: '/portal#portfolio-requests',
        external: false,
      },
      {
        id: 'portfolio',
        label: 'Build portfolio',
        href: talentProfileId
          ? `/talent/${talentProfileId}/portfolio?add=1#portfolio-editor`
          : '/portal?portfolio=add#talent-portfolio',
        external: false,
      },
    ];

    const { data, error } = await supabaseAdmin
      .from('talent_chat_messages')
      .insert({
        session_id: session.id,
        role: 'assistant',
        content: reply,
        actions,
        metadata: {
          kind: 'proactive',
          trigger: 'portfolio_request_pending',
          clientName: clientName || null,
          company: company || null,
        },
      })
      .select('id')
      .single();

    if (error) throw error;

    await supabaseAdmin
      .from('talent_chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', session.id);

    return data;
  } catch (err) {
    if (portfolioStore.isMissingTableError?.(err)) return null;
    console.warn('[portfolioChatNudge]', err?.message || err);
    return null;
  }
}

module.exports = {
  notifyTalentPortfolioRequestViaChat,
  formatClientLabel,
};

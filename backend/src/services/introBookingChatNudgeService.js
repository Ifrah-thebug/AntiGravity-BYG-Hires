/**
 * Proactive BGuides message when a client books an intro with talent.
 * In-app only (no extra Resend email — Cal.com already invites the talent).
 */

const { supabaseAdmin } = require('../middleware/requireAdmin');

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

function formatWhen(startIso) {
  if (!startIso) return null;
  try {
    return new Date(startIso).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return String(startIso);
  }
}

/**
 * @param {{ talentProfileId: string, clientName?: string, company?: string, startIso?: string, meetingUrl?: string }} params
 */
async function notifyTalentIntroBookedViaChat({
  talentProfileId,
  clientName,
  company,
  startIso,
  meetingUrl,
}) {
  if (!supabaseAdmin || !talentProfileId) return null;

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, name')
      .eq('id', talentProfileId)
      .maybeSingle();
    if (error) throw error;
    if (!profile?.user_id) return null;

    const session = await getOrCreateChatSession(profile.user_id, profile.id);
    if (!session?.id) return null;

    const who = [String(clientName || '').trim(), String(company || '').trim()]
      .filter(Boolean)
      .join(' · ') || 'A client';
    const when = formatWhen(startIso);
    let content = `${who} just booked an intro call with you`;
    if (when) content += ` for ${when}`;
    content +=
      '. Check your calendar invite for the meeting link, and open your portal prep checklist before the call.';

    const actions = [
      {
        id: 'portal',
        label: 'Open portal',
        href: '/portal#client-intro-scheduling',
        external: false,
      },
    ];
    if (meetingUrl) {
      actions.push({
        id: 'meeting',
        label: 'Open meeting link',
        href: meetingUrl,
        external: true,
      });
    }

    const { data: saved, error: insertErr } = await supabaseAdmin
      .from('talent_chat_messages')
      .insert({
        session_id: session.id,
        role: 'assistant',
        content,
        actions,
        metadata: {
          kind: 'proactive',
          trigger: 'intro_booked',
          uiCommands: [
            {
              type: 'HIGHLIGHT_SECTION',
              payload: { sectionId: 'client-intro-scheduling', pathname: '/portal' },
            },
          ],
          booking: { startIso: startIso || null, meetingUrl: meetingUrl || null },
        },
      })
      .select('id')
      .single();
    if (insertErr) throw insertErr;

    await supabaseAdmin
      .from('talent_chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', session.id);

    return saved;
  } catch (err) {
    console.warn('[introBookingChatNudge]', err?.message || err);
    return null;
  }
}

/**
 * Client-side BGuides message after they book an intro (mirrors talent nudge).
 * @param {{ clientId?: string|null, clientEmail?: string, talentName?: string, startIso?: string, meetingUrl?: string }} params
 */
async function notifyClientIntroBookedViaChat({
  clientId,
  clientEmail,
  talentName,
  startIso,
  meetingUrl,
}) {
  if (!supabaseAdmin) return null;

  try {
    let clientUserId = null;
    if (clientId) {
      const { data: row } = await supabaseAdmin
        .from('clients')
        .select('user_id')
        .eq('id', clientId)
        .maybeSingle();
      clientUserId = row?.user_id || null;
    }
    if (!clientUserId && clientEmail) {
      const { data: row } = await supabaseAdmin
        .from('clients')
        .select('user_id')
        .eq('email', String(clientEmail).trim().toLowerCase())
        .maybeSingle();
      clientUserId = row?.user_id || null;
    }
    if (!clientUserId) return null;

    const session = await getOrCreateChatSession(clientUserId, null);
    if (!session?.id) return null;

    const who = String(talentName || 'your talent match').trim() || 'your talent match';
    const when = formatWhen(startIso);
    let content = `You're booked with ${who}`;
    if (when) content += ` for ${when}`;
    content +=
      '. Join a couple of minutes early, skim their portfolio if available, and keep the meeting link handy.';

    const actions = [
      { id: 'dashboard', label: 'Open client dashboard', href: '/client', external: false },
    ];
    if (meetingUrl) {
      actions.push({
        id: 'meeting',
        label: 'Open meeting link',
        href: meetingUrl,
        external: true,
      });
    }

    const { data: saved, error: insertErr } = await supabaseAdmin
      .from('talent_chat_messages')
      .insert({
        session_id: session.id,
        role: 'assistant',
        content,
        actions,
        metadata: {
          kind: 'proactive',
          trigger: 'intro_booked_client',
          booking: { startIso: startIso || null, meetingUrl: meetingUrl || null },
        },
      })
      .select('id')
      .single();
    if (insertErr) throw insertErr;

    await supabaseAdmin
      .from('talent_chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', session.id);

    return saved;
  } catch (err) {
    console.warn('[introBookingChatNudge:client]', err?.message || err);
    return null;
  }
}

module.exports = {
  notifyTalentIntroBookedViaChat,
  notifyClientIntroBookedViaChat,
};

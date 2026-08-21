/**
 * Internal ambassador ops: review + screen only talent this ambassador invited.
 */
const { supabaseAdmin } = require('../middleware/requireAdmin');
const store = require('./ambassadorStore');
const review = require('./profileReviewService');
const introSlots = require('./introSlotsService');
const introCalSync = require('./introCalSync');
const calSchedule = require('./calScheduleHelpers');
const {
  sendPublishSlotsNudgeEmail,
  sendHrScreenBookedEmail,
} = require('./resendEmailService');

const HR_SCREEN_COMPANY = 'BYG_HR_SCREEN';
const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function deny(message, code, statusHint) {
  const err = new Error(message);
  err.code = code;
  err.statusHint = statusHint;
  return err;
}

async function requireInternalAmbassador(userId) {
  const ambassador = await store.getByUserId(userId);
  if (!ambassador || !ambassador.active) {
    throw deny('Ambassador account not found.', 'NOT_AMBASSADOR', 403);
  }
  if (ambassador.kind !== 'internal') {
    throw deny(
      'Only internal BYG ambassadors can review talent or book screening calls.',
      'NOT_INTERNAL',
      403
    );
  }
  return ambassador;
}

function mapReviewRow(row, slotMeta = {}) {
  const openCount = slotMeta.openCount || 0;
  const upcomingScreen = slotMeta.upcomingScreen || null;
  const openSlots = Array.isArray(slotMeta.openSlots) ? slotMeta.openSlots : [];
  const recentPastSlots = Array.isArray(slotMeta.recentPastSlots)
    ? slotMeta.recentPastSlots
    : [];
  const slotsPublished = Boolean(
    openCount || upcomingScreen || slotMeta.hadPublishedSlots || recentPastSlots.length
  );
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email || '',
    name: row.name || '',
    jobTitle: row.job_title || '',
    about: row.about || '',
    skills: Array.isArray(row.skills) ? row.skills : [],
    photoUrl: row.photo_url || null,
    cvUrl: row.cv_url || '',
    directoryStatus: row.directory_status || 'draft',
    reviewNotes: row.review_notes || '',
    reviewIssues: Array.isArray(row.review_issues) ? row.review_issues : [],
    submittedAt: row.submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    approvedAt: row.approved_at || null,
    calConnected: Boolean(row.cal_username),
    slotsPublished,
    openSlotCount: openCount,
    openSlots,
    recentPastSlots,
    nextSlotStart: slotMeta.nextStart || openSlots[0]?.start || null,
    upcomingScreen,
    canNudgeSlots: !openCount && !upcomingScreen,
    canBookScreen: openCount > 0 && !upcomingScreen,
    monthlyFeeUsd: row.monthly_fee_usd ?? null,
    availability: row.availability || '',
    experienceYears: row.experience_years ?? null,
  };
}

async function listAttributedProfiles(ambassadorId) {
  const selectWithNudge = `${review.PROFILE_REVIEW_COLUMNS}, cal_username, intro_slot_nudge_at`;
  const selectBasic = `${review.PROFILE_REVIEW_COLUMNS}, cal_username`;

  let { data, error } = await supabaseAdmin
    .from('profiles')
    .select(selectWithNudge)
    .eq('ambassador_id', ambassadorId)
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .limit(200);

  if (error && /intro_slot_nudge_at/i.test(error.message || '')) {
    ({ data, error } = await supabaseAdmin
      .from('profiles')
      .select(selectBasic)
      .eq('ambassador_id', ambassadorId)
      .order('submitted_at', { ascending: true, nullsFirst: false })
      .limit(200));
  }
  if (error) throw error;
  const rows = data || [];

  const { invites } = await store.countInvitesByAmbassador(ambassadorId);
  const have = new Set(rows.map((r) => r.user_id).filter(Boolean));
  const missingIds = [...new Set(
    (invites || []).map((i) => i.userId).filter((id) => id && !have.has(id))
  )];

  if (missingIds.length) {
    const extraQuery = await supabaseAdmin
      .from('profiles')
      .select(selectBasic)
      .in('user_id', missingIds);
    if (!extraQuery.error && extraQuery.data?.length) {
      rows.push(
        ...extraQuery.data.filter((p) => !p.ambassador_id || p.ambassador_id === ambassadorId)
      );
    }
  }

  return rows;
}

async function getOwnedProfile(ambassador, profileKey) {
  const profile = await review.getProfileByKey(profileKey);
  if (!profile) {
    throw deny('Talent profile not found.', 'NOT_FOUND', 404);
  }

  let ambassadorId = profile.ambassador_id || null;
  if (!ambassadorId && profile.email) {
    const invite = await store.findLatestAmbassadorInviteByEmail(profile.email);
    ambassadorId = invite?.ambassadorId || null;
  }

  if (ambassadorId !== ambassador.id) {
    throw deny('You can only manage talent you invited.', 'NOT_OWNED', 403);
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`${review.PROFILE_REVIEW_COLUMNS}, cal_username, intro_slot_nudge_at`)
    .eq('user_id', profile.user_id)
    .maybeSingle();
  if (error && /intro_slot_nudge_at/i.test(error.message || '')) {
    return { ...profile, ambassador_id: ambassadorId, cal_username: profile.cal_username || null, intro_slot_nudge_at: null };
  }
  if (error) throw error;
  return { ...(data || profile), ambassador_id: ambassadorId };
}

async function resolveSlotTalentKey(profileOrKey) {
  const key =
    typeof profileOrKey === 'object' && profileOrKey
      ? String(profileOrKey.id || profileOrKey.user_id || '')
      : String(profileOrKey || '');
  if (!key) return null;
  try {
    const ctx = await introSlots.resolveTalentContext(key);
    // Slots are stored on profiles.id, not auth user_id.
    return ctx?.talentKey || key;
  } catch (err) {
    console.warn('[ambassador-internal] talent key:', err?.message || err);
    return key;
  }
}

async function slotMetaForTalent(profileOrKey) {
  const talentKey = await resolveSlotTalentKey(profileOrKey);
  if (!talentKey) {
    return {
      openCount: 0,
      openSlots: [],
      recentPastSlots: [],
      nextStart: null,
      upcomingScreen: null,
      hadPublishedSlots: false,
    };
  }

  let open = [];
  let anyFutureOrRecent = [];
  try {
    open = await introSlots.listSlotsForTalent(talentKey, { statuses: ['open', 'held'] });
  } catch (err) {
    console.warn('[ambassador-internal] slots:', err?.message || err);
  }

  // Booked / expired / recent past still prove the talent published availability.
  try {
    anyFutureOrRecent = await introSlots.listSlotsForTalent(talentKey, {
      statuses: ['open', 'held', 'booked', 'expired'],
    });
  } catch (err) {
    console.warn('[ambassador-internal] slot history:', err?.message || err);
  }

  // If nothing is still bookable, surface recently published times (even if past).
  let recentPastSlots = [];
  if (!open.length) {
    try {
      if (supabaseAdmin) {
        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: pastRows, error: pastErr } = await supabaseAdmin
          .from('talent_intro_slots')
          .select('*')
          .eq('talent_id', talentKey)
          .in('status', ['open', 'held', 'booked', 'expired'])
          .gte('start_at', since)
          .order('start_at', { ascending: false })
          .limit(8);
        if (!pastErr) {
          recentPastSlots = (pastRows || []).map((row) => ({
            id: row.id,
            start: row.start_at || row.start,
            end: row.end_at || row.end || null,
            status: row.status || 'expired',
          }));
        }
      }
    } catch (err) {
      console.warn('[ambassador-internal] past slots:', err?.message || err);
    }
  }

  let upcomingScreen = null;
  try {
    const rows = await introSlots.listActiveBookingRowsForTalent(talentKey);
    const screen = (rows || []).find(
      (r) => String(r.company || '') === HR_SCREEN_COMPANY
    );
    if (screen) {
      upcomingScreen = {
        start: screen.start_at || screen.start,
        meetingUrl: screen.meeting_url || screen.meetingUrl || null,
        guestName: screen.guest_name || screen.guestName || null,
      };
    }
  } catch (err) {
    console.warn('[ambassador-internal] bookings:', err?.message || err);
  }

  const openSlots = (open || []).map((s) => ({
    id: s.id,
    start: s.start,
    end: s.end || null,
    status: s.status || 'open',
  }));

  return {
    openCount: openSlots.length,
    openSlots,
    recentPastSlots,
    nextStart: openSlots[0]?.start || null,
    upcomingScreen,
    hadPublishedSlots: Boolean(
      (anyFutureOrRecent || []).length ||
        recentPastSlots.length ||
        upcomingScreen
    ),
  };
}

async function listReviewsForUser(userId, { status = 'pending_review' } = {}) {
  const ambassador = await requireInternalAmbassador(userId);
  const rows = await listAttributedProfiles(ambassador.id);
  const wanted = String(status || 'pending_review').trim();
  const filtered =
    wanted === 'all'
      ? rows
      : rows.filter((r) => (r.directory_status || 'draft') === wanted);

  const items = [];
  for (const row of filtered) {
    const meta = await slotMetaForTalent(row);
    items.push(mapReviewRow(row, meta));
  }

  return {
    ambassador: {
      id: ambassador.id,
      kind: ambassador.kind,
      isInternal: true,
    },
    status: wanted,
    profiles: items,
  };
}

async function approveReviewForUser(userId, profileKey) {
  const ambassador = await requireInternalAmbassador(userId);
  const profile = await getOwnedProfile(ambassador, profileKey);
  const status = profile.directory_status || 'draft';

  if (status === 'approved') {
    return { alreadyApproved: true, profile: mapReviewRow(profile, await slotMetaForTalent(profile)) };
  }
  if (status !== 'pending_review') {
    throw deny(
      'Only profiles waiting for review can be approved. Ask the talent to submit first.',
      'INVALID_STATUS',
      400
    );
  }

  const result = await review.approveProfile({
    profileKey: profile.user_id || profile.id,
    adminUserId: userId,
  });
  const meta = await slotMetaForTalent(profile.user_id);
  return {
    alreadyApproved: false,
    profile: mapReviewRow({ ...result.profile, ambassador_id: ambassador.id, cal_username: profile.cal_username }, meta),
    email: result.email,
  };
}

async function requestChangesForUser(userId, profileKey, { issues, notes }) {
  const ambassador = await requireInternalAmbassador(userId);
  const profile = await getOwnedProfile(ambassador, profileKey);
  const status = profile.directory_status || 'draft';
  if (!['pending_review', 'approved'].includes(status)) {
    throw deny('This profile cannot receive change requests in its current state.', 'INVALID_STATUS', 400);
  }

  const result = await review.requestProfileChanges({
    profileKey: profile.user_id || profile.id,
    adminUserId: userId,
    issues,
    notes,
  });
  const meta = await slotMetaForTalent(profile.user_id);
  return {
    profile: mapReviewRow({ ...result.profile, ambassador_id: ambassador.id, cal_username: profile.cal_username }, meta),
    email: result.email,
  };
}

async function nudgePublishSlotsForUser(userId, profileKey) {
  const ambassador = await requireInternalAmbassador(userId);
  const profile = await getOwnedProfile(ambassador, profileKey);

  if (!profile.email) {
    throw deny('This talent has no email on file.', 'NO_EMAIL', 400);
  }

  const meta = await slotMetaForTalent(profile);
  if (meta.openCount > 0) {
    throw deny('This talent already has published intro slots.', 'SLOTS_ALREADY_PUBLISHED', 400);
  }
  if (meta.upcomingScreen) {
    throw deny('A screening is already booked with this talent.', 'SCREEN_ALREADY_BOOKED', 400);
  }

  const last = profile.intro_slot_nudge_at ? new Date(profile.intro_slot_nudge_at).getTime() : 0;
  if (last && Date.now() - last < NUDGE_COOLDOWN_MS) {
    throw deny(
      'A reminder email was already sent in the last 24 hours.',
      'NUDGE_COOLDOWN',
      429
    );
  }

  const needsCalendar = !profile.cal_username;
  const sendResult = await sendPublishSlotsNudgeEmail({
    to: profile.email,
    name: profile.name,
    ambassadorName: ambassador.name,
    mode: needsCalendar ? 'calendar' : 'slots',
  });

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ intro_slot_nudge_at: now, updated_at: now })
    .eq('user_id', profile.user_id);
  if (error && !/intro_slot_nudge_at/i.test(error.message || '')) {
    console.warn('[ambassador-internal] nudge stamp:', error.message);
  }

  return {
    sent: Boolean(sendResult?.id || sendResult),
    mode: needsCalendar ? 'calendar' : 'slots',
    profile: mapReviewRow({ ...profile, intro_slot_nudge_at: now }, meta),
  };
}

async function listScreensForUser(userId) {
  const ambassador = await requireInternalAmbassador(userId);
  const rows = await listAttributedProfiles(ambassador.id);
  const items = [];
  for (const row of rows) {
    const meta = await slotMetaForTalent(row);
    const mapped = mapReviewRow(row, meta);
    items.push({
      ...mapped,
      canBookScreen: Boolean(mapped.canBookScreen),
    });
  }
  return { profiles: items };
}

async function listScreenSlotsForUser(userId, talentKey) {
  const ambassador = await requireInternalAmbassador(userId);
  const profile = await getOwnedProfile(ambassador, talentKey);
  const ctx = await introSlots.resolveTalentContext(profile.user_id || profile.id);
  if (!ctx?.calUsername) {
    throw deny('This talent has not connected Cal.com yet.', 'TALENT_CAL_NOT_CONNECTED', 400);
  }

  const meta = await slotMetaForTalent(ctx.talentKey);
  let slots = [];
  try {
    slots = await introSlots.listSlotsForTalent(ctx.talentKey, { statuses: ['open'] });
  } catch (err) {
    throw deny(err.message || 'Could not load slots.', 'SLOTS_FAILED', 500);
  }

  return {
    profile: mapReviewRow(profile, meta),
    slots: slots.map((s) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      dayKey: s.dayKey,
      status: s.status,
    })),
    upcomingScreen: meta.upcomingScreen,
  };
}

async function bookScreenForUser(userId, { talentKey, slotId }) {
  const ambassador = await requireInternalAmbassador(userId);
  const profile = await getOwnedProfile(ambassador, talentKey);

  if (!process.env.CAL_USERNAME || !process.env.CAL_EVENT_SLUG || !calSchedule.getCalApiKey()) {
    throw deny('Cal.com is not configured for screening bookings.', 'CAL_NOT_CONFIGURED', 500);
  }

  const guestEmail = store.normalizeEmail(ambassador.email);
  if (!guestEmail) {
    throw deny('Add an email on your ambassador profile before booking a screen.', 'AMBASSADOR_EMAIL_REQUIRED', 400);
  }

  const ctx = await introSlots.resolveTalentContext(profile.user_id || profile.id);
  if (!ctx?.calUsername) {
    throw deny('This talent has not connected Cal.com yet.', 'TALENT_CAL_NOT_CONNECTED', 400);
  }

  try {
    await introCalSync.syncClientTalentBooking(ctx.talentKey, guestEmail);
  } catch (syncErr) {
    console.warn('[ambassador-internal] cal sync:', syncErr?.message || syncErr);
  }

  const existingPair = await introSlots.getActiveBookingForPair(ctx.talentKey, guestEmail);
  if (existingPair) {
    return {
      alreadyBooked: true,
      booking: introSlots.formatBookingForClient(existingPair),
    };
  }

  const rows = await introSlots.listSlotsForTalent(ctx.talentKey, { statuses: ['open'] });
  const slot = rows.find((s) => s.id === slotId);
  if (!slot || slot.status !== 'open') {
    throw deny('That time is no longer available. Refresh and pick another slot.', 'SLOT_UNAVAILABLE', 409);
  }

  const bookedDays = await introSlots.getBookedDayKeys(ctx.talentKey);
  if (bookedDays.has(slot.dayKey)) {
    throw deny('This talent already has a booking that day.', 'DAY_BOOKED', 409);
  }

  const hrUsername = String(process.env.CAL_USERNAME || '').trim().toLowerCase();
  const storedTalentTz = await introSlots.getTalentSchedulingTimezone(ctx.talentKey);
  const { hrSet, talentSet, mutualSet } = await calSchedule.fetchAvailabilitySets({
    hrUsername,
    talentUsername: ctx.calUsername,
    daysAhead: introSlots.INTRO_PUBLISH_DAYS,
    talentTimeZone: storedTalentTz,
  });

  if (!calSchedule.isInstantBookable(slot.start, hrSet, talentSet, mutualSet)) {
    throw deny('This time is no longer available. Please pick another slot.', 'HR_OR_TALENT_BUSY', 409);
  }

  const startIso = introSlots.normalizeInstant(slot.start);
  const calSaved = await calSchedule.createCalIntroBooking({
    talentId: ctx.talentKey,
    slotId,
    hrUsername,
    talentUsername: ctx.calUsername,
    talentEmail: ctx.email,
    talentName: ctx.name,
    startIso,
    name: ambassador.name || 'BYG Hires',
    email: guestEmail,
    title: 'BYG Screening Call',
  });

  await introSlots.markSlotBooked(slotId);

  const dbRow = await introSlots.saveBookingRecord({
    talentKey: ctx.talentKey,
    slotId,
    clientId: null,
    clientEmail: guestEmail,
    clientName: ambassador.name || 'BYG Hires',
    company: HR_SCREEN_COMPANY,
    calUid: calSaved.uid,
    title: calSaved.title || 'BYG Screening Call',
    start: calSaved.start || startIso,
    end: calSaved.end,
    meetingUrl: calSaved.meetingUrl,
    status: 'confirmed',
  });

  let emailResult = { sent: false };
  if (ctx.email) {
    try {
      const whenLabel = new Date(calSaved.start || startIso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      await sendHrScreenBookedEmail({
        to: ctx.email,
        name: ctx.name,
        ambassadorName: ambassador.name,
        whenLabel,
        meetingUrl: calSaved.meetingUrl,
      });
      emailResult = { sent: true };
    } catch (mailErr) {
      console.warn('[ambassador-internal] screen email:', mailErr?.message || mailErr);
      emailResult = { sent: false, error: mailErr?.message };
    }
  }

  return {
    alreadyBooked: false,
    booking: introSlots.formatBookingForClient(dbRow),
    email: emailResult,
  };
}

module.exports = {
  requireInternalAmbassador,
  listReviewsForUser,
  approveReviewForUser,
  requestChangesForUser,
  nudgePublishSlotsForUser,
  listScreensForUser,
  listScreenSlotsForUser,
  bookScreenForUser,
  HR_SCREEN_COMPANY,
};

const express = require('express');
const introSlots = require('../services/introSlotsService');
const introCalSync = require('../services/introCalSync');
const clientActivation = require('../services/clientActivationService');
const calSchedule = require('../services/calScheduleHelpers');

const router = express.Router();

function resolveClientDisplayTimezone(raw) {
  const tz = calSchedule.resolveIanaTimezone(raw, '');
  return tz || null;
}

function resolveTalentTimezone(raw) {
  return calSchedule.resolveIanaTimezone(raw, introSlots.DISPLAY_TZ);
}

function friendlyPublishSlotsError(err) {
  const msg = String(err?.message || '');
  if (
    msg.includes('idx_talent_intro_slots_talent_start')
    || msg.includes('duplicate key value')
  ) {
    return 'That time slot already exists in your history. Refresh the page and publish again.';
  }
  return msg || 'Failed to save slots';
}

function requireCalEnv(res) {
  if (!process.env.CAL_USERNAME || !process.env.CAL_EVENT_SLUG) {
    res.status(500).json({ error: 'Missing CAL_USERNAME or CAL_EVENT_SLUG' });
    return false;
  }
  if (!calSchedule.getCalApiKey()) {
    res.status(500).json({ error: 'Missing CAL_API_KEY' });
    return false;
  }
  return true;
}

/** Talent portal: HR ∩ talent times grouped by day (pick ≤1 per day, 15 days). */
router.get('/publish-grid/:talentId', async (req, res) => {
  if (!requireCalEnv(res)) return;
  const talentId = String(req.params.talentId || '').trim();
  const talentTimeZone = resolveTalentTimezone(req.query.timeZone);
  if (!talentId) return res.status(400).json({ error: 'talentId is required' });

  try {
    const ctx = await introSlots.resolveTalentContext(talentId);
    if (!ctx?.calUsername) {
      return res.status(400).json({
        error: 'Connect Cal.com from your portal first.',
        code: 'TALENT_CAL_NOT_CONNECTED',
      });
    }

    const hrUsername = String(process.env.CAL_USERNAME || '').trim().toLowerCase();
    const days = introSlots.INTRO_PUBLISH_DAYS;
    const {
      mutual,
      hrSet,
      talentSet,
      mutualSet,
      talentTimeZone: talentTz,
      hrTimeZone,
    } = await calSchedule.fetchAvailabilitySets({
      hrUsername,
      talentUsername: ctx.calUsername,
      daysAhead: days,
      talentTimeZone,
    });

    const byDay = calSchedule.groupSlotsByDay(mutual, talentTz);
    const daysGrid = [];
    for (const [dayKey, slots] of byDay.entries()) {
      daysGrid.push({
        dayKey,
        slots: slots.map((s) => ({ start: s.start, end: introSlots.slotEndFromStart(s.start) })),
      });
    }
    daysGrid.sort((a, b) => a.dayKey.localeCompare(b.dayKey));

    try {
      await introCalSync.syncTalentUpcomingBookings(ctx.talentKey);
    } catch (syncErr) {
      console.warn('intro publish-grid cal sync:', syncErr?.message || syncErr);
    }

    try {
      await introSlots.syncPublishedSlotsWithAvailability(ctx.talentKey, {
        hrSet,
        talentSet,
        mutualSet,
      });
    } catch (pruneErr) {
      console.warn('intro publish-grid sync published slots:', pruneErr?.message || pruneErr);
    }

    const published = await introSlots.listSlotsForTalent(ctx.talentKey, {
      statuses: ['open', 'held', 'booked'],
    });
    const bookedDayKeys = [...(await introSlots.getBookedDayKeys(ctx.talentKey))];

    return res.json({
      success: true,
      timezone: talentTz,
      talentTimezone: talentTz,
      hrTimezone: hrTimeZone,
      publishDays: days,
      days: daysGrid,
      bookedDayKeys,
      published: published.map((s) => ({
        id: s.id,
        start: s.start,
        end: s.end,
        dayKey: s.dayKey,
        status: s.status,
      })),
      hrUsername,
      talentUsername: ctx.calUsername,
    });
  } catch (err) {
    console.error('intro publish-grid:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to load publish grid' });
  }
});

/** Talent: current published slots from DB. */
router.get('/my-slots/:talentId', async (req, res) => {
  const talentId = String(req.params.talentId || '').trim();
  if (!talentId) return res.status(400).json({ error: 'talentId is required' });
  try {
    const ctx = await introSlots.resolveTalentContext(talentId);
    if (!ctx) return res.status(404).json({ error: 'Talent not found' });
    if (process.env.CAL_API_KEY) {
      try {
        await introCalSync.syncTalentUpcomingBookings(ctx.talentKey);
      } catch (syncErr) {
        console.warn('intro my-slots cal sync:', syncErr?.message || syncErr);
      }
    }
    const slots = await introSlots.listSlotsForTalent(ctx.talentKey, {
      statuses: ['open', 'held', 'booked'],
    });
    return res.json({ success: true, slots, timezone: introSlots.DISPLAY_TZ });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to load slots' });
  }
});

/** Talent: save published slots (replaces future open slots). Body: { slots: string[] ISO starts } */
router.put('/my-slots/:talentId', async (req, res) => {
  if (!requireCalEnv(res)) return;
  const talentId = String(req.params.talentId || '').trim();
  const raw = req.body?.slots;
  const talentTimeZone = resolveTalentTimezone(req.body?.timeZone);
  if (!talentId) return res.status(400).json({ error: 'talentId is required' });
  if (!Array.isArray(raw)) return res.status(400).json({ error: 'slots array is required' });

  try {
    const ctx = await introSlots.resolveTalentContext(talentId);
    if (!ctx?.calUsername) {
      return res.status(400).json({
        error: 'Connect Cal.com from your portal first.',
        code: 'TALENT_CAL_NOT_CONNECTED',
      });
    }

    const starts = raw.map((s) => introSlots.normalizeInstant(s));
    const seenDays = new Set();
    for (const start of starts) {
      const dk = introSlots.dateKeyInTimezone(start, talentTimeZone);
      if (seenDays.has(dk)) {
        return res.status(400).json({ error: 'Only one slot per day allowed.' });
      }
      seenDays.add(dk);
    }
    if (starts.length > introSlots.INTRO_PUBLISH_DAYS) {
      return res.status(400).json({
        error: `Maximum ${introSlots.INTRO_PUBLISH_DAYS} days of availability.`,
      });
    }

    const hrUsername = String(process.env.CAL_USERNAME || '').trim().toLowerCase();
    const { mutualSet, hrSet, talentSet } = await calSchedule.fetchAvailabilitySets({
      hrUsername,
      talentUsername: ctx.calUsername,
      daysAhead: introSlots.INTRO_PUBLISH_DAYS,
      talentTimeZone,
    });

    const bookedDays = await introSlots.getBookedDayKeys(ctx.talentKey);
    for (const start of starts) {
      const dk = introSlots.dateKeyInTimezone(start, talentTimeZone);
      if (bookedDays.has(dk)) {
        return res.status(400).json({
          error: 'That day already has a booked intro. You can only offer one interview per day.',
          code: 'DAY_ALREADY_BOOKED',
        });
      }
      if (!calSchedule.isInstantBookable(start, hrSet, talentSet, mutualSet)) {
        return res.status(400).json({
          error: `Time ${start} is not available for both HR and your calendar.`,
          code: 'SLOT_NOT_MUTUAL',
        });
      }
      if (new Date(start).getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Cannot publish slots in the past.' });
      }
    }

    const saved = await introSlots.replaceOpenPublishedSlots(ctx.talentKey, starts, talentTimeZone);
    return res.json({
      success: true,
      slots: saved,
      count: saved.length,
      talentTimezone: talentTimeZone,
    });
  } catch (err) {
    console.error('intro save slots:', err?.message || err);
    const friendly = friendlyPublishSlotsError(err);
    const status = friendly.includes('booked intro') || friendly.includes('not available') ? 400 : 500;
    return res.status(status).json({ error: friendly });
  }
});

/** Client: bookable published slots (HR free + talent free + not booked day). */
router.get('/client-slots/:talentId', async (req, res) => {
  if (!requireCalEnv(res)) return;
  const talentId = String(req.params.talentId || '').trim();
  const clientEmail = introSlots.normalizeEmail(req.query.clientEmail || '');
  const displayTimezone = resolveClientDisplayTimezone(req.query.timeZone);
  if (!talentId) return res.status(400).json({ error: 'talentId is required' });

  try {
    const ctx = await introSlots.resolveTalentContext(talentId);
    if (!ctx?.calUsername) {
      return res.status(400).json({
        error: 'This talent has not published intro availability yet.',
        code: 'TALENT_CAL_NOT_CONNECTED',
      });
    }

    let syncNotice = null;
    try {
      await introSlots.reconcileBookedSlotsForTalent(ctx.talentKey);
    } catch (reconcileErr) {
      console.warn('intro client-slots reconcile:', reconcileErr?.message || reconcileErr);
    }

    const hrUsername = String(process.env.CAL_USERNAME || '').trim().toLowerCase();
    const storedTalentTz = await introSlots.getTalentSchedulingTimezone(ctx.talentKey);
    const { hrSet, talentSet, mutualSet, talentTimeZone: talentTz, hrTimeZone } =
      await calSchedule.fetchAvailabilitySets({
        hrUsername,
        talentUsername: ctx.calUsername,
        daysAhead: introSlots.INTRO_PUBLISH_DAYS,
        talentTimeZone: storedTalentTz,
      });

    try {
      await introSlots.syncPublishedSlotsWithAvailability(ctx.talentKey, {
        hrSet,
        talentSet,
        mutualSet,
      });
    } catch (pruneErr) {
      console.warn('intro client-slots sync published slots:', pruneErr?.message || pruneErr);
    }

    if (clientEmail) {
      try {
        const syncResult = await introCalSync.syncClientTalentBooking(ctx.talentKey, clientEmail);
        if (syncResult.action === 'cancelled') {
          syncNotice = introSlots.cancelledIntroNotice();
        } else if (syncResult.action === 'updated') {
          syncNotice = {
            type: 'rescheduled',
            message: 'Your intro was rescheduled in Cal.com. The updated time is shown below.',
          };
        }
      } catch (syncErr) {
        console.warn('intro client-slots cal sync:', syncErr?.message || syncErr);
      }

      const existing = await introSlots.getActiveBookingRowForPair(ctx.talentKey, clientEmail);
      if (existing) {
        const formatted = introSlots.formatBookingForClient(existing);
        return res.json({
          success: true,
          slots: [],
          existingBooking: formatted,
          syncNotice: syncNotice?.type === 'rescheduled' ? syncNotice : null,
          message:
            'You already have an upcoming intro scheduled with this talent. See the time below.',
          code: 'CLIENT_TALENT_ALREADY_BOOKED',
          timezone: introSlots.DISPLAY_TZ,
          displayTimezone,
        });
      }

      if (!syncNotice) {
        const latest = await introSlots.getLatestBookingRowForPair(ctx.talentKey, clientEmail);
        if (String(latest?.status || '').toLowerCase() === 'cancelled') {
          syncNotice = introSlots.cancelledIntroNotice();
        }
      }
    }

    const bookedDays = await introSlots.getBookedDayKeys(ctx.talentKey);
    const dbSlots = await introSlots.listSlotsForTalent(ctx.talentKey, { statuses: ['open'] });

    const bookable = dbSlots.filter((slot) => {
      if (bookedDays.has(slot.dayKey)) return false;
      return calSchedule.isInstantBookable(slot.start, hrSet, talentSet, mutualSet);
    });

    return res.json({
      success: true,
      slots: bookable.map((s) => ({
        id: s.id,
        start: s.start,
        end: s.end,
        dayKey: s.dayKey,
        status: s.status,
      })),
      existingBooking: null,
      syncNotice,
      timezone: talentTz,
      talentTimezone: talentTz,
      hrTimezone: hrTimeZone,
      displayTimezone,
      bookingTitle: String(process.env.CAL_BOOKING_TITLE || 'Intro Interview').trim(),
    });
  } catch (err) {
    console.error('intro client-slots:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to load client slots' });
  }
});

/** Client: confirm booking → Cal.com + DB. */
router.post('/book', async (req, res) => {
  if (!requireCalEnv(res)) return;
  const { slotId, talentId, name, email, company } = req.body || {};
  if (!slotId || !talentId || !name || !email) {
    return res.status(400).json({ error: 'slotId, talentId, name, and email are required' });
  }

  const clientEmail = introSlots.normalizeEmail(email);

  try {
    const ctx = await introSlots.resolveTalentContext(talentId);
    if (!ctx?.calUsername) {
      return res.status(400).json({ error: 'Talent calendar not connected.', code: 'TALENT_CAL_NOT_CONNECTED' });
    }

    try {
      await introCalSync.syncClientTalentBooking(ctx.talentKey, clientEmail);
    } catch (syncErr) {
      console.warn('intro book cal sync:', syncErr?.message || syncErr);
    }

    const existingPair = await introSlots.getActiveBookingForPair(ctx.talentKey, clientEmail);
    if (existingPair) {
      const formatted = introSlots.formatBookingForClient(existingPair);
      let activation = { sent: false, reason: 'duplicate_booking' };
      const existingClientId = existingPair.client_id || existingPair.clientId;
      if (existingClientId) {
        try {
          activation = await clientActivation.sendPostBookingActivation({
            clientId: existingClientId,
            clientEmail,
            clientName: existingPair.guest_name || existingPair.guestName || String(name).trim(),
            talentName: ctx.name || 'your talent match',
          });
        } catch (mailErr) {
          console.warn('client activation email (duplicate):', mailErr?.message || mailErr);
          activation = { sent: false, reason: 'send_failed', error: mailErr?.message };
        }
      }
      return res.status(409).json({
        error:
          'You already have an intro scheduled with this talent. You cannot book a second intro with the same person.',
        code: 'CLIENT_TALENT_ALREADY_BOOKED',
        booking: formatted,
        activation,
      });
    }

    const rows = await introSlots.listSlotsForTalent(ctx.talentKey, { statuses: ['open'] });
    const slot = rows.find((s) => s.id === slotId);

    if (!slot) {
      return res.status(409).json({
        error: 'That time is no longer available. Please refresh the page and pick another slot.',
        code: 'SLOT_UNAVAILABLE',
      });
    }
    if (slot.status !== 'open') {
      return res.status(409).json({
        error: 'That time was just booked by someone else. Please choose another slot.',
        code: 'SLOT_UNAVAILABLE',
      });
    }

    const bookedDays = await introSlots.getBookedDayKeys(ctx.talentKey);
    if (bookedDays.has(slot.dayKey)) {
      return res.status(409).json({ error: 'This talent already has an intro that day.', code: 'DAY_BOOKED' });
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
      return res.status(409).json({
        error: 'This time is no longer available with our team. Please pick another slot.',
        code: 'HR_OR_TALENT_BUSY',
      });
    }

    const startIso = introSlots.normalizeInstant(slot.start);
    if (!ctx.email?.trim()) {
      console.warn(
        `[intro/book] Talent ${ctx.talentKey} has no profile email — Cal invite may not reach the candidate.`
      );
    }

    const calSaved = await calSchedule.createCalIntroBooking({
      talentId: ctx.talentKey,
      slotId,
      hrUsername,
      talentUsername: ctx.calUsername,
      talentEmail: ctx.email,
      talentName: ctx.name,
      startIso,
      name: String(name).trim(),
      email: clientEmail,
    });

    await introSlots.markSlotBooked(slotId);

    let clientId = null;
    try {
      clientId = await introSlots.upsertClientByEmail({
        email: clientEmail,
        name: String(name).trim(),
        company: company || null,
      });
    } catch (clientErr) {
      console.warn('clients upsert failed (booking still created):', clientErr?.message || clientErr);
    }

    const dbRow = await introSlots.saveBookingRecord({
      talentKey: ctx.talentKey,
      slotId,
      clientId,
      clientEmail,
      clientName: String(name).trim(),
      company: company || null,
      calUid: calSaved.uid,
      title: calSaved.title,
      start: calSaved.start || startIso,
      end: calSaved.end,
      meetingUrl: calSaved.meetingUrl,
      status: 'confirmed',
    });

    let activation = { sent: false, reason: 'skipped' };
    if (clientId) {
      try {
        activation = await clientActivation.sendPostBookingActivation({
          clientId,
          clientEmail,
          clientName: String(name).trim(),
          talentName: ctx.name || 'your talent match',
        });
      } catch (mailErr) {
        console.warn('client activation email failed:', mailErr?.message || mailErr);
        activation = { sent: false, reason: 'send_failed', error: mailErr?.message };
      }
    }

    return res.status(201).json({
      success: true,
      booking: {
        uid: calSaved.uid,
        title: calSaved.title,
        start: calSaved.start || startIso,
        end: calSaved.end,
        meetingUrl: calSaved.meetingUrl,
        guestName: String(name).trim(),
        guestEmail: clientEmail,
      },
      recordId: dbRow?.id,
      activation,
    });
  } catch (err) {
    console.error('intro book:', err?.message || err);
    const raw = String(err?.message || 'Booking failed');
    const friendly = raw.includes('cal.com') || raw.length > 200
      ? 'Could not complete booking with Cal.com. Try another time or contact support.'
      : raw;
    return res.status(500).json({ error: friendly, code: 'BOOKING_FAILED' });
  }
});

module.exports = router;

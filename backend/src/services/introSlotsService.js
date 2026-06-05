/**
 * DB-backed talent intro slots + client bookings (MVP).
 * Cal.com meeting created only on client book.
 */
const { createClient } = require('@supabase/supabase-js');
const db = require('./dbService');
const calSchedule = require('./calScheduleHelpers');

const DISPLAY_TZ = process.env.CAL_BOOKING_TIMEZONE || 'Asia/Karachi';
const INTRO_PUBLISH_DAYS = Math.min(30, Math.max(1, parseInt(process.env.INTRO_PUBLISH_DAYS, 10) || 15));
const HOLD_MINUTES = Math.min(30, Math.max(3, parseInt(process.env.INTRO_HOLD_MINUTES, 10) || 8));
const SLOT_DURATION_MS = 30 * 60 * 1000;

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const ACTIVE_BOOKING_STATUSES = new Set(['pending', 'confirmed', 'accepted']);

function throwIfSupabaseError(error, context) {
  if (error) throw new Error(`${context}: ${error.message || error}`);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function dateKeyInTimezone(isoString, timeZone = DISPLAY_TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoString));
}

function normalizeInstant(iso) {
  return new Date(iso).toISOString();
}

function slotEndFromStart(startIso) {
  return new Date(new Date(startIso).getTime() + SLOT_DURATION_MS).toISOString();
}

function mapSlotRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    talentId: row.talent_id || row.talentId,
    start: row.start_at || row.start,
    end: row.end_at || row.end,
    dayKey: row.day_key || row.dayKey,
    status: row.status,
    heldUntil: row.held_until || row.heldUntil || null,
    heldByEmail: row.held_by_email || row.heldByEmail || null,
  };
}

async function resolveTalentContext(talentId) {
  const tid = String(talentId || '').trim();
  if (!tid) return null;

  if (supabaseAdmin) {
    let { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, cal_username, email, name')
      .eq('user_id', tid)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const byId = await supabaseAdmin
        .from('profiles')
        .select('id, user_id, cal_username, email, name')
        .eq('id', tid)
        .maybeSingle();
      if (byId.error) throw byId.error;
      data = byId.data;
    }
    if (!data) return null;
    return {
      profileId: data.id,
      userId: data.user_id,
      talentKey: data.id,
      calUsername: data.cal_username || null,
      email: data.email || '',
      name: data.name || '',
    };
  }

  const local = await db.getCalConnectionByTalentId(tid);
  return {
    profileId: tid,
    userId: tid,
    talentKey: tid,
    calUsername: local?.username || null,
    email: local?.email || '',
    name: '',
  };
}

async function releaseExpiredHolds(talentKey) {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    const q = supabaseAdmin
      .from('talent_intro_slots')
      .update({ status: 'open', held_until: null, held_by_email: null, updated_at: now })
      .eq('status', 'held')
      .lt('held_until', now);
    if (talentKey) q.eq('talent_id', talentKey);
    await q;
    return;
  }
  await db.releaseExpiredIntroHolds(talentKey, now);
}

async function listSlotsForTalent(talentKey, { statuses } = {}) {
  await releaseExpiredHolds(talentKey);
  const statusList = statuses || ['open', 'held', 'booked'];

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('talent_intro_slots')
      .select('*')
      .eq('talent_id', talentKey)
      .in('status', statusList)
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapSlotRow);
  }

  return (await db.listIntroSlots(talentKey, { statuses: statusList })).map(mapSlotRow);
}

async function getTalentSchedulingTimezone(talentKey) {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('talent_intro_slots')
      .select('timezone')
      .eq('talent_id', talentKey)
      .not('timezone', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.timezone) {
      return calSchedule.resolveIanaTimezone(data.timezone, DISPLAY_TZ);
    }
  }
  return DISPLAY_TZ;
}

async function replaceOpenPublishedSlots(talentKey, slotStarts, talentTimeZone = DISPLAY_TZ) {
  const tz = calSchedule.resolveIanaTimezone(talentTimeZone, DISPLAY_TZ);
  const now = new Date().toISOString();
  const bookedDays = await getBookedDayKeys(talentKey);
  const rows = [];
  const seenDays = new Set();

  for (const start of slotStarts) {
    const startIso = normalizeInstant(start);
    const dayKey = dateKeyInTimezone(startIso, tz);
    if (bookedDays.has(dayKey)) {
      throw new Error(
        `You already have a booked intro on ${dayKey}. Only one interview per day is allowed.`
      );
    }
    if (seenDays.has(dayKey)) {
      throw new Error('Only one slot per day is allowed.');
    }
    seenDays.add(dayKey);
    rows.push({
      talent_id: talentKey,
      start_at: startIso,
      end_at: slotEndFromStart(startIso),
      day_key: dayKey,
      timezone: tz,
      status: 'open',
      held_until: null,
      held_by_email: null,
      updated_at: now,
    });
  }

  if (supabaseAdmin) {
    const startAts = rows.map((r) => r.start_at);
    if (startAts.length) {
      const { data: bookedAtStart, error: conflictErr } = await supabaseAdmin
        .from('talent_intro_slots')
        .select('id, start_at, day_key')
        .eq('talent_id', talentKey)
        .in('start_at', startAts)
        .eq('status', 'booked');
      throwIfSupabaseError(conflictErr, 'check booked slot conflicts');
      if (bookedAtStart?.length) {
        const dk = bookedAtStart[0].day_key;
        throw new Error(
          `You already have a booked intro on ${dk}. Only one interview per day is allowed.`
        );
      }
    }

    const { error: clearErr } = await supabaseAdmin
      .from('talent_intro_slots')
      .delete()
      .eq('talent_id', talentKey)
      .in('status', ['open', 'held']);
    throwIfSupabaseError(clearErr, 'clear open talent_intro_slots');

    if (rows.length === 0) return [];

    // Reuse expired/cancelled rows at the same start_at (unique on talent_id + start_at).
    const { data, error } = await supabaseAdmin
      .from('talent_intro_slots')
      .upsert(rows, { onConflict: 'talent_id,start_at' })
      .select();
    throwIfSupabaseError(error, 'upsert talent_intro_slots');
    return (data || []).map(mapSlotRow);
  }

  const saved = await db.replaceOpenIntroSlots(talentKey, rows);
  return saved.map(mapSlotRow);
}

async function getActiveBookingRowForPair(talentKey, clientEmail) {
  const email = normalizeEmail(clientEmail);
  if (!email) return null;

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .select('*')
      .eq('talent_id', talentKey)
      .or(`client_email.eq.${email},guest_email.eq.${email}`)
      .in('status', Array.from(ACTIVE_BOOKING_STATUSES))
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  return db.getIntroBookingByClientTalent(talentKey, email);
}

async function getActiveBookingForPair(talentKey, clientEmail) {
  return getActiveBookingRowForPair(talentKey, clientEmail);
}

/** Most recent intro_bookings row for this client + talent (any status). */
async function getLatestBookingRowForPair(talentKey, clientEmail) {
  const email = normalizeEmail(clientEmail);
  if (!email) return null;

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .select('*')
      .eq('talent_id', talentKey)
      .or(`client_email.eq.${email},guest_email.eq.${email}`)
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  return db.getLatestIntroBookingByClientTalent(talentKey, email);
}

function cancelledIntroNotice() {
  return {
    type: 'cancelled',
    message:
      'Your previous intro with this talent was cancelled. You can choose a new time below.',
  };
}

async function getBookingById(id) {
  if (!id) return null;
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return db.getIntroBookingById(id);
}

async function listActiveBookingRowsForTalent(talentKey) {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .select('*')
      .eq('talent_id', talentKey)
      .in('status', Array.from(ACTIVE_BOOKING_STATUSES))
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  return db.listActiveIntroBookingsForTalent(talentKey);
}

async function reopenSlotById(slotId) {
  const id = String(slotId || '').trim();
  if (!id) return false;
  const now = new Date().toISOString();

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('talent_intro_slots')
      .update({
        status: 'open',
        held_until: null,
        held_by_email: null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('status', 'booked')
      .select('id')
      .maybeSingle();
    throwIfSupabaseError(error, 'reopen talent_intro_slots');
    return Boolean(data?.id);
  }

  return db.reopenIntroSlotById(id, now);
}

async function getLatestBookingRowBySlotId(slotId) {
  const id = String(slotId || '').trim();
  if (!id) return null;

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .select('*')
      .eq('slot_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfSupabaseError(error, 'lookup intro_bookings by slot_id');
    return data;
  }

  return db.getLatestIntroBookingBySlotId(id);
}

/**
 * Booked slots must have an active intro_bookings row. Cancelled or missing rows → reopen slot.
 */
async function reconcileBookedSlotsForTalent(talentKey) {
  const results = [];
  const bookedSlots = await listSlotsForTalent(talentKey, { statuses: ['booked'] });

  for (const slot of bookedSlots) {
    try {
      const row = await getLatestBookingRowBySlotId(slot.id);
      const status = String(row?.status || '').toLowerCase();

      if (!row || !ACTIVE_BOOKING_STATUSES.has(status)) {
        const reopened = await reopenSlotById(slot.id);
        if (reopened) {
          results.push({
            action: row ? 'reopened_cancelled_slot' : 'reopened_orphan_slot',
            slotId: slot.id,
            bookingId: row?.id || null,
            dayKey: slot.dayKey,
          });
        }
      }
    } catch (err) {
      console.warn('reconcileBookedSlots slot failed:', slot.id, err?.message || err);
    }
  }

  return results;
}

async function cancelBookingAndReopenSlot(row) {
  const now = new Date().toISOString();
  const bookingId = row.id;
  const slotId = row.slot_id || row.slotId;

  if (supabaseAdmin) {
    const { error: bookingErr } = await supabaseAdmin
      .from('intro_bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);
    throwIfSupabaseError(bookingErr, 'cancel intro_bookings');

    if (slotId) {
      await reopenSlotById(slotId);
    }
  } else {
    await db.cancelIntroBookingAndReopenSlot({ bookingId, slotId, now });
  }

  const startIso = row.start_at || row.start;
  const talentKey = row.talent_id || row.talentId;
  if (startIso && talentKey) {
    try {
      await reactivatePeerExpiredSlotsAtStart(startIso, talentKey);
    } catch (peerErr) {
      console.warn('reactivatePeerExpiredSlotsAtStart failed:', peerErr?.message || peerErr);
    }
  }
}

async function updateBookingAndSlotFromCal(row, cal) {
  const now = new Date().toISOString();
  const startIso = normalizeInstant(cal.start);
  const endIso = cal.end ? normalizeInstant(cal.end) : slotEndFromStart(startIso);
  const dayKey = dateKeyInTimezone(startIso);

  if (supabaseAdmin) {
    const { error: bookingErr } = await supabaseAdmin
      .from('intro_bookings')
      .update({
        cal_uid: cal.uid || row.cal_uid,
        title: cal.title,
        start_at: startIso,
        end_at: endIso,
        meeting_url: cal.meetingUrl || null,
        status: 'confirmed',
      })
      .eq('id', row.id);
    throwIfSupabaseError(bookingErr, 'update intro_bookings from Cal');

    const slotId = row.slot_id || row.slotId;
    if (slotId) {
      const { error: slotErr } = await supabaseAdmin
        .from('talent_intro_slots')
        .update({
          start_at: startIso,
          end_at: endIso,
          day_key: dayKey,
          status: 'booked',
          updated_at: now,
        })
        .eq('id', slotId);
      throwIfSupabaseError(slotErr, 'update talent_intro_slots from Cal');
    }
    return;
  }

  await db.updateIntroBookingAndSlotFromCal({
    bookingId: row.id,
    slotId: row.slot_id || row.slotId,
    cal,
    startIso,
    endIso,
    dayKey,
    now,
  });
}

async function getBookedDayKeys(talentKey) {
  const slots = await listSlotsForTalent(talentKey, { statuses: ['booked'] });
  return new Set(slots.map((s) => s.dayKey));
}

/**
 * Open/held publishes must stay in live HR ∩ talent availability.
 * Reopened or stale slots where HR is now busy → expired (hidden from talent + clients).
 */
async function expireUnbookableOpenSlots(talentKey, { hrSet, talentSet, mutualSet }) {
  const openSlots = await listSlotsForTalent(talentKey, { statuses: ['open', 'held'] });
  const toExpire = openSlots.filter(
    (slot) => !calSchedule.isInstantBookable(slot.start, hrSet, talentSet, mutualSet)
  );
  if (!toExpire.length) return [];

  const now = new Date().toISOString();
  const ids = toExpire.map((s) => s.id);

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('talent_intro_slots')
      .update({
        status: 'expired',
        held_until: null,
        held_by_email: null,
        updated_at: now,
      })
      .in('id', ids);
    throwIfSupabaseError(error, 'expire unbookable talent_intro_slots');
    return ids;
  }

  return db.expireIntroSlotsByIds(ids, now);
}

/** Restore a slot that was auto-expired when HR was busy elsewhere. */
async function reactivateExpiredSlotById(slotId) {
  const id = String(slotId || '').trim();
  if (!id) return false;
  const now = new Date().toISOString();

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('talent_intro_slots')
      .update({
        status: 'open',
        held_until: null,
        held_by_email: null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('status', 'expired')
      .select('id')
      .maybeSingle();
    throwIfSupabaseError(error, 'reactivate expired talent_intro_slots');
    return Boolean(data?.id);
  }

  return db.reactivateExpiredIntroSlotById(id, now);
}

/**
 * When HR becomes free again, bring back this talent's expired publishes (no republish needed).
 */
async function reactivateBookableExpiredSlots(talentKey, { hrSet, talentSet, mutualSet }) {
  const expiredSlots = await listSlotsForTalent(talentKey, { statuses: ['expired'] });
  if (!expiredSlots.length) return [];

  const bookedDays = await getBookedDayKeys(talentKey);
  const liveSlots = await listSlotsForTalent(talentKey, {
    statuses: ['open', 'held', 'booked'],
  });
  const liveDays = new Set(liveSlots.map((s) => s.dayKey));
  const reactivated = [];

  for (const slot of expiredSlots) {
    if (bookedDays.has(slot.dayKey) || liveDays.has(slot.dayKey)) continue;
    if (!calSchedule.isInstantBookable(slot.start, hrSet, talentSet, mutualSet)) continue;
    const ok = await reactivateExpiredSlotById(slot.id);
    if (ok) {
      reactivated.push(slot.id);
      liveDays.add(slot.dayKey);
    }
  }

  return reactivated;
}

/** Expire slots HR can no longer take; reactivate expired slots HR can take again. */
async function syncPublishedSlotsWithAvailability(talentKey, availability) {
  const expired = await expireUnbookableOpenSlots(talentKey, availability);
  const reactivated = await reactivateBookableExpiredSlots(talentKey, availability);
  return { expired, reactivated };
}

/**
 * When Talent A cancels, auto-restore other talents' expired slots at the same time
 * (they already published; HR is free again).
 */
async function reactivatePeerExpiredSlotsAtStart(startIso, sourceTalentKey) {
  const startNorm = normalizeInstant(startIso);
  const sourceKey = String(sourceTalentKey || '').trim();
  if (!startNorm || !sourceKey) return [];

  const hrUsername = String(process.env.CAL_USERNAME || '').trim().toLowerCase();
  if (!hrUsername || !calSchedule.getCalApiKey()) return [];

  let peers = [];
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('talent_intro_slots')
      .select('id, talent_id, day_key, start_at, timezone')
      .eq('status', 'expired')
      .eq('start_at', startNorm)
      .neq('talent_id', sourceKey);
    throwIfSupabaseError(error, 'list peer expired talent_intro_slots');
    peers = data || [];
  } else {
    peers = await db.listExpiredIntroSlotsAtStart(startNorm, sourceKey);
  }

  const results = [];
  const availabilityCache = new Map();

  for (const row of peers) {
    try {
      const talentKey = row.talent_id || row.talentId;
      const dayKey = row.day_key || row.dayKey;
      const bookedDays = await getBookedDayKeys(talentKey);
      if (bookedDays.has(dayKey)) continue;

      const liveSlots = await listSlotsForTalent(talentKey, {
        statuses: ['open', 'held', 'booked'],
      });
      if (liveSlots.some((s) => s.dayKey === dayKey)) continue;

      let availability = availabilityCache.get(talentKey);
      if (!availability) {
        const ctx = await resolveTalentContext(talentKey);
        if (!ctx?.calUsername) continue;
        const tz = calSchedule.resolveIanaTimezone(
          row.timezone,
          await getTalentSchedulingTimezone(talentKey)
        );
        availability = await calSchedule.fetchAvailabilitySets({
          hrUsername,
          talentUsername: ctx.calUsername,
          daysAhead: INTRO_PUBLISH_DAYS,
          talentTimeZone: tz,
        });
        availabilityCache.set(talentKey, availability);
      }

      if (
        !calSchedule.isInstantBookable(
          startNorm,
          availability.hrSet,
          availability.talentSet,
          availability.mutualSet
        )
      ) {
        continue;
      }

      const ok = await reactivateExpiredSlotById(row.id);
      if (ok) results.push({ slotId: row.id, talentId: talentKey });
    } catch (err) {
      console.warn('reactivatePeerExpiredSlotsAtStart row failed:', err?.message || err);
    }
  }

  return results;
}

async function holdSlot(slotId, clientEmail) {
  const email = normalizeEmail(clientEmail);
  if (!email) throw new Error('Email is required to reserve a slot.');

  await releaseExpiredHolds();

  const heldUntil = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  if (supabaseAdmin) {
    const { data: slot, error: fetchErr } = await supabaseAdmin
      .from('talent_intro_slots')
      .select('*')
      .eq('id', slotId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!slot || slot.status !== 'open') {
      throw new Error('SLOT_UNAVAILABLE');
    }

    const { data, error } = await supabaseAdmin
      .from('talent_intro_slots')
      .update({
        status: 'held',
        held_until: heldUntil,
        held_by_email: email,
        updated_at: now,
      })
      .eq('id', slotId)
      .eq('status', 'open')
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('SLOT_UNAVAILABLE');
    return { slot: mapSlotRow(data), heldUntil, holdMinutes: HOLD_MINUTES };
  }

  const held = await db.holdIntroSlot(slotId, email, heldUntil);
  if (!held) throw new Error('SLOT_UNAVAILABLE');
  return { slot: mapSlotRow(held), heldUntil, holdMinutes: HOLD_MINUTES };
}

async function markSlotBooked(slotId) {
  const now = new Date().toISOString();
  if (supabaseAdmin) {
    const { data: slot, error: sErr } = await supabaseAdmin
      .from('talent_intro_slots')
      .select('*')
      .eq('id', slotId)
      .single();
    if (sErr) throw sErr;

    await supabaseAdmin
      .from('talent_intro_slots')
      .update({ status: 'booked', held_until: null, held_by_email: null, updated_at: now })
      .eq('id', slotId);

    await supabaseAdmin
      .from('talent_intro_slots')
      .update({ status: 'expired', updated_at: now })
      .eq('talent_id', slot.talent_id)
      .eq('day_key', slot.day_key)
      .eq('status', 'open');

    await supabaseAdmin
      .from('talent_intro_slots')
      .update({ status: 'expired', held_until: null, held_by_email: null, updated_at: now })
      .eq('talent_id', slot.talent_id)
      .eq('day_key', slot.day_key)
      .eq('status', 'held');

    return mapSlotRow(slot);
  }

  return db.markIntroSlotBooked(slotId, now);
}

async function upsertClientByEmail({ email, name, company }) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const now = new Date().toISOString();
  const row = {
    email: normalized,
    name: name || null,
    company: company || null,
    updated_at: now,
  };

  if (supabaseAdmin) {
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id, name, company')
      .eq('email', normalized)
      .maybeSingle();

    if (existing?.id) {
      const updates = { updated_at: now };
      if (name && !existing.name) updates.name = name;
      if (company && !existing.company) updates.company = company;
      if (Object.keys(updates).length > 1) {
        await supabaseAdmin.from('clients').update(updates).eq('id', existing.id);
      }
      return existing.id;
    }

    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert({ ...row, created_at: now })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id || null;
  }

  return db.upsertClient({ email: normalized, name, company, now });
}

async function saveBookingRecord({
  talentKey,
  slotId,
  clientId,
  clientEmail,
  clientName,
  company,
  calUid,
  title,
  start,
  end,
  meetingUrl,
  status,
}) {
  const payload = {
    talent_id: talentKey,
    slot_id: slotId,
    client_id: clientId || null,
    client_email: normalizeEmail(clientEmail),
    guest_name: clientName || null,
    guest_email: normalizeEmail(clientEmail),
    company: company || null,
    cal_uid: calUid || null,
    title: title || 'Intro Interview',
    start_at: new Date(start).toISOString(),
    end_at: end ? new Date(end).toISOString() : null,
    meeting_url: meetingUrl || null,
    status: status || 'confirmed',
  };

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  return db.saveIntroBookingV2({
    talentId: talentKey,
    slotId,
    clientId: payload.client_id,
    clientEmail: payload.client_email,
    clientName,
    company,
    calUid: payload.cal_uid,
    title: payload.title,
    start: payload.start_at,
    end: payload.end_at,
    meetingUrl: payload.meeting_url,
    status: payload.status,
  });
}

function formatBookingForClient(row) {
  if (!row) return null;
  return {
    uid: row.cal_uid || row.calUid,
    title: row.title,
    start: row.start_at || row.start,
    end: row.end_at || row.end,
    meetingUrl: row.meeting_url || row.meetingUrl,
    guestName: row.guest_name || row.guestName,
    guestEmail: row.guest_email || row.guestEmail || row.client_email,
  };
}

module.exports = {
  DISPLAY_TZ,
  INTRO_PUBLISH_DAYS,
  HOLD_MINUTES,
  SLOT_DURATION_MS,
  normalizeEmail,
  dateKeyInTimezone,
  normalizeInstant,
  slotEndFromStart,
  resolveTalentContext,
  releaseExpiredHolds,
  listSlotsForTalent,
  getTalentSchedulingTimezone,
  replaceOpenPublishedSlots,
  getActiveBookingForPair,
  getActiveBookingRowForPair,
  getLatestBookingRowForPair,
  cancelledIntroNotice,
  getBookingById,
  listActiveBookingRowsForTalent,
  cancelBookingAndReopenSlot,
  reopenSlotById,
  getLatestBookingRowBySlotId,
  reconcileBookedSlotsForTalent,
  expireUnbookableOpenSlots,
  reactivateBookableExpiredSlots,
  syncPublishedSlotsWithAvailability,
  reactivatePeerExpiredSlotsAtStart,
  updateBookingAndSlotFromCal,
  getBookedDayKeys,
  holdSlot,
  markSlotBooked,
  upsertClientByEmail,
  saveBookingRecord,
  formatBookingForClient,
  mapSlotRow,
};

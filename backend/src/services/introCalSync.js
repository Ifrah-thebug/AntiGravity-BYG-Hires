/**
 * Sync intro_bookings + talent_intro_slots from Cal.com (no webhooks).
 * Cal is source of truth when client or talent loads scheduling UI.
 */
const introSlots = require('./introSlotsService');

const CAL_API_BASE = (process.env.CAL_API_BASE || 'https://api.cal.com').replace(/\/+$/, '');
const INACTIVE_CAL_STATUSES = new Set(['cancelled', 'canceled', 'rejected']);

function getCalApiKey() {
  return process.env.CAL_API_KEY;
}

function calHeaders() {
  return {
    'cal-api-version': '2024-08-13',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getCalApiKey()}`,
  };
}

async function fetchCalBookingByUid(uid) {
  const id = String(uid || '').trim();
  if (!id || !getCalApiKey()) return null;
  try {
    const resp = await fetch(`${CAL_API_BASE}/v2/bookings/${encodeURIComponent(id)}`, {
      headers: calHeaders(),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (resp.status === 404) return { _gone: true };
      return null;
    }
    return data?.data ?? data;
  } catch (err) {
    console.warn('introCalSync fetch uid failed:', err?.message || err);
    return null;
  }
}

function mapCalBooking(calRaw) {
  if (!calRaw || calRaw._gone) return { gone: true };
  const start = calRaw.start || calRaw.startTime;
  if (!start) return { gone: true };
  const status = String(calRaw.status || 'accepted').toLowerCase();
  const cancelledByEmail = String(calRaw.cancelledByEmail || '').trim();
  const cancellationReason = String(calRaw.cancellationReason || '').trim();
  const inactive =
    INACTIVE_CAL_STATUSES.has(status) ||
    Boolean(cancelledByEmail) ||
    Boolean(cancellationReason);
  const attendee = Array.isArray(calRaw.attendees) ? calRaw.attendees[0] : null;
  return {
    gone: false,
    inactive,
    uid: calRaw.uid,
    title: calRaw.title || process.env.CAL_BOOKING_TITLE || 'Intro Interview',
    start,
    end: calRaw.end || calRaw.endTime || null,
    meetingUrl: calRaw.meetingUrl || calRaw.location || null,
    status: calRaw.status || 'accepted',
    guestName: attendee?.name || null,
    guestEmail: attendee?.email || null,
  };
}

/**
 * Sync one intro_bookings row with Cal. Returns action for UI hints.
 * cancelled | updated | unchanged | skipped
 */
async function syncOneBookingRow(row) {
  if (!row) return { action: 'skipped' };

  const calUid = row.cal_uid || row.calUid;
  if (!calUid) return { action: 'skipped' };

  const cal = mapCalBooking(await fetchCalBookingByUid(calUid));

  if (cal.gone || cal.inactive) {
    await introSlots.cancelBookingAndReopenSlot(row);
    return { action: 'cancelled', bookingId: row.id };
  }

  const prevStart = introSlots.normalizeInstant(row.start_at || row.start);
  const nextStart = introSlots.normalizeInstant(cal.start);
  const changed =
    prevStart !== nextStart ||
    (row.meeting_url || row.meetingUrl) !== (cal.meetingUrl || null);

  if (changed) {
    await introSlots.updateBookingAndSlotFromCal(row, cal);
    const fresh = await introSlots.getBookingById(row.id);
    return {
      action: 'updated',
      booking: introSlots.formatBookingForClient(fresh),
    };
  }

  return {
    action: 'unchanged',
    booking: introSlots.formatBookingForClient(row),
  };
}

/** After client enters email — sync their booking with this talent. */
async function syncClientTalentBooking(talentKey, clientEmail) {
  const email = introSlots.normalizeEmail(clientEmail);
  if (!email) return { action: 'none' };

  const row = await introSlots.getActiveBookingRowForPair(talentKey, email);
  if (!row) return { action: 'none' };

  return syncOneBookingRow(row);
}

/** Talent portal load — sync every upcoming active booking for this talent. */
async function syncTalentUpcomingBookings(talentKey) {
  const results = [];

  try {
    const reconciled = await introSlots.reconcileBookedSlotsForTalent(talentKey);
    results.push(...reconciled);
  } catch (err) {
    console.warn('syncTalentUpcomingBookings reconcile failed:', err?.message || err);
  }

  const rows = await introSlots.listActiveBookingRowsForTalent(talentKey);
  for (const row of rows) {
    try {
      results.push(await syncOneBookingRow(row));
    } catch (err) {
      console.warn('syncTalentUpcomingBookings row failed:', err?.message || err);
    }
  }
  return results;
}

module.exports = {
  syncClientTalentBooking,
  syncTalentUpcomingBookings,
  syncOneBookingRow,
};

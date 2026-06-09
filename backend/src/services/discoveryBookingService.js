/**
 * Discovery-call bookings (Cal.com public page) → client record + DB row + activation email.
 */

const crypto = require('crypto');
const introSlots = require('./introSlotsService');
const clientActivation = require('./clientActivationService');
const discoveryStore = require('./discoveryBookingStore');

function getDiscoverySlug() {
  return String(process.env.CAL_DISCOVERY_SLUG || 'discovery-call').trim().toLowerCase();
}

function getHrUsername() {
  return String(process.env.CAL_USERNAME || '').trim().toLowerCase();
}

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

function extractGuestFromPayload(payload) {
  const attendees = Array.isArray(payload?.attendees) ? payload.attendees : [];
  let email = attendees[0]?.email;
  let name = attendees[0]?.name;

  const responses = payload?.responses || {};
  if (responses.email?.value) email = responses.email.value;
  if (responses.name?.value) name = responses.name.value;

  return {
    email: String(email || '').trim().toLowerCase(),
    name: String(name || '').trim() || null,
  };
}

function extractMeetingUrl(payload) {
  const loc = payload?.meetingUrl || payload?.location;
  if (typeof loc === 'string' && loc.trim()) return loc.trim();
  if (loc && typeof loc === 'object') {
    const v = loc.link || loc.value || loc.joinUrl;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function extractBookingTimes(payload) {
  const start = payload?.startTime || payload?.start;
  const end = payload?.endTime || payload?.end;
  return { start, end };
}

function extractCalUid(payload) {
  return String(payload?.uid || payload?.bookingUid || payload?.bookingId || '').trim() || null;
}

function isDiscoveryBookingPayload(payload) {
  if (!payload) return false;

  const discoverySlug = getDiscoverySlug();
  const eventSlug = normalizeSlug(payload.type || payload.eventSlug || payload.slug);
  if (eventSlug !== discoverySlug) return false;

  const hrUsername = getHrUsername();
  const organizerUsername = normalizeSlug(payload.organizer?.username);
  if (hrUsername && organizerUsername && organizerUsername !== hrUsername) {
    return false;
  }

  return true;
}

function verifyCalWebhookSignature(rawBody, signatureHeader) {
  const secret = String(process.env.CAL_WEBHOOK_SECRET || '').trim();
  if (!secret) return true;

  const signature = String(signatureHeader || '').trim();
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expected = hmac.digest('hex');

  const received = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(received, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

async function ensureClientForDiscovery(guest) {
  return introSlots.upsertClientByEmail({
    email: guest.email,
    name: guest.name,
    company: null,
  });
}

async function handleDiscoveryBookingCreated(payload) {
  if (!isDiscoveryBookingPayload(payload)) {
    return { handled: false, reason: 'not_discovery_event' };
  }

  const guest = extractGuestFromPayload(payload);
  if (!guest.email) {
    return { handled: false, reason: 'missing_guest_email' };
  }

  const organizerEmail = String(payload.organizer?.email || '').trim().toLowerCase();
  if (organizerEmail && organizerEmail === guest.email) {
    return { handled: false, reason: 'organizer_is_guest' };
  }

  const calUid = extractCalUid(payload);
  const { start, end } = extractBookingTimes(payload);
  if (!calUid || !start) {
    return { handled: false, reason: 'missing_cal_uid_or_start' };
  }

  let clientId = null;
  try {
    clientId = await ensureClientForDiscovery(guest);
  } catch (err) {
    console.error('[discovery] clients upsert failed:', err?.message || err);
    return { handled: false, reason: 'client_upsert_failed', error: err?.message };
  }

  if (!clientId) {
    return { handled: false, reason: 'no_client_id' };
  }

  let booking = null;
  try {
    booking = await discoveryStore.upsertDiscoveryBooking({
      clientId,
      calUid,
      title: payload.title || 'Discovery Call',
      startAt: start,
      endAt: end,
      meetingUrl: extractMeetingUrl(payload),
      guestName: guest.name,
      guestEmail: guest.email,
      status: 'confirmed',
    });
  } catch (err) {
    console.error('[discovery] booking save failed:', err?.message || err);
    return { handled: false, reason: 'booking_save_failed', error: err?.message };
  }

  let activation = { sent: false, reason: 'skipped' };
  try {
    activation = await clientActivation.sendPostBookingActivation({
      clientId,
      clientEmail: guest.email,
      clientName: guest.name,
      bookingContext: 'discovery',
    });
  } catch (err) {
    console.warn('[discovery] activation email failed:', err?.message || err);
    activation = { sent: false, reason: 'send_failed', error: err?.message };
  }

  return {
    handled: true,
    clientId,
    bookingId: booking?.id || null,
    bookingUid: calUid,
    activation,
  };
}

async function handleDiscoveryBookingCancelled(payload) {
  if (!isDiscoveryBookingPayload(payload)) {
    return { handled: false, reason: 'not_discovery_event' };
  }

  const calUid = extractCalUid(payload);
  if (!calUid) return { handled: false, reason: 'missing_cal_uid' };

  const row = await discoveryStore.updateDiscoveryBookingByCalUid(calUid, {
    status: 'cancelled',
  });

  return { handled: true, bookingUid: calUid, updated: Boolean(row) };
}

async function handleDiscoveryBookingRescheduled(payload) {
  if (!isDiscoveryBookingPayload(payload)) {
    return { handled: false, reason: 'not_discovery_event' };
  }

  const calUid = extractCalUid(payload);
  const { start, end } = extractBookingTimes(payload);
  if (!calUid || !start) {
    return { handled: false, reason: 'missing_cal_uid_or_start' };
  }

  const row = await discoveryStore.updateDiscoveryBookingByCalUid(calUid, {
    status: 'confirmed',
    start_at: new Date(start).toISOString(),
    end_at: end ? new Date(end).toISOString() : null,
    meeting_url: extractMeetingUrl(payload),
    title: payload.title || 'Discovery Call',
  });

  return { handled: true, bookingUid: calUid, updated: Boolean(row) };
}

async function processCalWebhookBody(rawBody, signatureHeader) {
  if (!verifyCalWebhookSignature(rawBody, signatureHeader)) {
    const err = new Error('Invalid Cal.com webhook signature.');
    err.code = 'INVALID_SIGNATURE';
    throw err;
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    const err = new Error('Invalid webhook JSON.');
    err.code = 'INVALID_JSON';
    throw err;
  }

  const triggerEvent = String(body.triggerEvent || body.event || '').trim().toUpperCase();
  const payload = body.payload || body;

  if (triggerEvent === 'BOOKING_CREATED') {
    const result = await handleDiscoveryBookingCreated(payload);
    return { ok: true, ...result };
  }

  if (triggerEvent === 'BOOKING_CANCELLED' || triggerEvent === 'BOOKING_CANCELED') {
    const result = await handleDiscoveryBookingCancelled(payload);
    return { ok: true, ...result };
  }

  if (triggerEvent === 'BOOKING_RESCHEDULED') {
    const result = await handleDiscoveryBookingRescheduled(payload);
    return { ok: true, ...result };
  }

  return { ok: true, handled: false, reason: 'ignored_trigger', triggerEvent };
}

module.exports = {
  processCalWebhookBody,
  verifyCalWebhookSignature,
  isDiscoveryBookingPayload,
  handleDiscoveryBookingCreated,
};

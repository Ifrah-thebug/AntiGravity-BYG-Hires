/**
 * Discovery-call bookings (Cal.com public page) → client record + activation email.
 */

const crypto = require('crypto');
const introSlots = require('./introSlotsService');
const clientActivation = require('./clientActivationService');

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

/**
 * Verify Cal.com webhook signature (x-cal-signature-256).
 * Skips verification when CAL_WEBHOOK_SECRET is unset (dev only).
 */
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

  let clientId = null;
  try {
    clientId = await introSlots.upsertClientByEmail({
      email: guest.email,
      name: guest.name,
      company: null,
    });
  } catch (err) {
    console.error('[discovery] clients upsert failed:', err?.message || err);
    return { handled: false, reason: 'client_upsert_failed', error: err?.message };
  }

  if (!clientId) {
    return { handled: false, reason: 'no_client_id' };
  }

  try {
    const activation = await clientActivation.sendPostBookingActivation({
      clientId,
      clientEmail: guest.email,
      clientName: guest.name,
      bookingContext: 'discovery',
    });
    return {
      handled: true,
      clientId,
      bookingUid: payload.uid || payload.bookingUid || null,
      activation,
    };
  } catch (err) {
    console.error('[discovery] activation email failed:', err?.message || err);
    return {
      handled: true,
      clientId,
      activation: { sent: false, reason: 'send_failed', error: err?.message },
    };
  }
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
  if (triggerEvent !== 'BOOKING_CREATED') {
    return { ok: true, handled: false, reason: 'ignored_trigger', triggerEvent };
  }

  const payload = body.payload || body;
  const result = await handleDiscoveryBookingCreated(payload);
  return { ok: true, ...result };
}

module.exports = {
  processCalWebhookBody,
  verifyCalWebhookSignature,
  isDiscoveryBookingPayload,
  handleDiscoveryBookingCreated,
};

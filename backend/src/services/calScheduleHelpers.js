/**
 * Shared Cal.com slot + booking helpers for intro MVP.
 */
const CAL_API_VERSION = process.env.CAL_API_VERSION || '2024-06-14';
const CAL_SLOTS_API_VERSION = process.env.CAL_SLOTS_API_VERSION || '2024-06-14';
const CAL_API_BASE = (process.env.CAL_API_BASE || 'https://api.cal.com').replace(/\/+$/, '');
const DEFAULT_BOOKING_TIMEZONE = process.env.CAL_BOOKING_TIMEZONE || 'Asia/Karachi';

function getCalApiKey() {
  return process.env.CAL_API_KEY;
}

function formatCalApiError(data, fallback = 'Cal.com API error') {
  if (!data) return fallback;
  const err = data.error ?? data;
  if (typeof err === 'string') return err;
  if (typeof err?.message === 'string') return err.message;
  try {
    return JSON.stringify(err?.details || err);
  } catch {
    return fallback;
  }
}

function calApiHeaders(accessToken, apiVersion = CAL_API_VERSION) {
  const headers = {
    'cal-api-version': apiVersion,
    'Content-Type': 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function calFetch(path, { method = 'GET', body, accessToken, apiVersion } = {}) {
  const url = `${CAL_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const resp = await fetch(url, {
    method,
    headers: calApiHeaders(accessToken, apiVersion ?? CAL_API_VERSION),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(formatCalApiError(data, `Cal.com API error (${resp.status})`));
  }
  return data;
}

function flattenCalSlotsResponse(payload) {
  const slotsByDate = payload?.data?.slots ?? payload?.slots;
  if (!slotsByDate || typeof slotsByDate !== 'object') return [];

  const flat = [];
  for (const [date, entries] of Object.entries(slotsByDate)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      let start = null;
      if (typeof entry === 'string') {
        start = entry.includes('T') ? entry : `${date}T${entry}`;
      } else if (entry && typeof entry === 'object') {
        start = entry.time || entry.start;
      }
      if (!start) continue;
      const iso = new Date(start).toISOString();
      if (!Number.isNaN(new Date(iso).getTime())) flat.push({ start: iso });
    }
  }
  return flat.sort((a, b) => new Date(a.start) - new Date(b.start));
}

function normalizeEventSlug(raw) {
  let slug = String(raw || '30min').trim().toLowerCase();
  slug = slug.split('?')[0].split('/')[0];
  if (!slug || slug === 'dynamic' || slug.startsWith('dynamic')) slug = '30min';
  return slug;
}

async function resolveEventTypeId(username, slug) {
  const data = await calFetch(
    `/v2/event-types?username=${encodeURIComponent(username)}`,
    { accessToken: getCalApiKey(), apiVersion: CAL_SLOTS_API_VERSION }
  );
  const list = data?.data ?? [];
  const match = list.find((e) => String(e.slug || '').toLowerCase() === slug.toLowerCase());
  return match?.id ?? null;
}

async function fetchSlotsForUser({ username, eventTypeId, startDate, endDate, timeZone }) {
  const params = new URLSearchParams({
    eventTypeId: String(eventTypeId),
    startTime: `${startDate}T00:00:00Z`,
    endTime: `${endDate}T23:59:59Z`,
    timeZone,
  });
  const data = await calFetch(`/v2/slots/available?${params.toString()}`, {
    accessToken: getCalApiKey(),
    apiVersion: CAL_SLOTS_API_VERSION,
  });
  return flattenCalSlotsResponse(data);
}

function normalizeSlotInstant(iso) {
  return new Date(iso).toISOString();
}

function intersectSlotLists(slotsA, slotsB) {
  const setB = new Set(slotsB.map((s) => normalizeSlotInstant(s.start)));
  return slotsA.filter((s) => setB.has(normalizeSlotInstant(s.start)));
}

function resolveIanaTimezone(raw, fallback = DEFAULT_BOOKING_TIMEZONE) {
  const tz = String(raw || '').trim();
  if (!tz || tz.length > 64) return fallback;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return fallback;
  }
}

function dateKeyInTimezone(isoString, timeZone = DEFAULT_BOOKING_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoString));
}

function groupSlotsByDay(slots, timeZone = DEFAULT_BOOKING_TIMEZONE) {
  const byDay = new Map();
  for (const slot of slots) {
    const day = dateKeyInTimezone(slot.start, timeZone);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(slot);
  }
  return byDay;
}

async function fetchAvailabilitySets({
  hrUsername,
  talentUsername,
  daysAhead = 15,
  talentTimeZone,
}) {
  const eventSlug = normalizeEventSlug(process.env.CAL_EVENT_SLUG);
  const hrTimeZone = DEFAULT_BOOKING_TIMEZONE;
  const talentTz = resolveIanaTimezone(talentTimeZone, DEFAULT_BOOKING_TIMEZONE);
  const start = new Date();
  const end = new Date(start.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const hrEventTypeId = await resolveEventTypeId(hrUsername, eventSlug);
  if (!hrEventTypeId) {
    throw new Error(`HR Cal account "${hrUsername}" has no event type "${eventSlug}".`);
  }

  let talentEventTypeId = await resolveEventTypeId(talentUsername, eventSlug);
  if (!talentEventTypeId) talentEventTypeId = hrEventTypeId;

  const [hrSlots, talentSlots] = await Promise.all([
    fetchSlotsForUser({
      username: hrUsername,
      eventTypeId: hrEventTypeId,
      startDate: startStr,
      endDate: endStr,
      timeZone: hrTimeZone,
    }),
    fetchSlotsForUser({
      username: talentUsername,
      eventTypeId: talentEventTypeId,
      startDate: startStr,
      endDate: endStr,
      timeZone: talentTz,
    }),
  ]);

  const mutual = intersectSlotLists(hrSlots, talentSlots);
  const hrSet = new Set(hrSlots.map((s) => normalizeSlotInstant(s.start)));
  const talentSet = new Set(talentSlots.map((s) => normalizeSlotInstant(s.start)));
  const mutualSet = new Set(mutual.map((s) => normalizeSlotInstant(s.start)));

  return {
    hrSlots,
    talentSlots,
    mutual,
    hrSet,
    talentSet,
    mutualSet,
    eventSlug,
    hrTimeZone,
    talentTimeZone: talentTz,
    /** @deprecated use talentTimeZone */
    timeZone: talentTz,
  };
}

function isInstantBookable(iso, hrSet, talentSet, mutualSet) {
  const key = normalizeSlotInstant(iso);
  return mutualSet.has(key) && hrSet.has(key) && talentSet.has(key);
}

async function createCalIntroBooking({
  talentId,
  slotId,
  hrUsername,
  talentUsername,
  talentEmail,
  talentName,
  startIso,
  name,
  email,
}) {
  const eventSlug = normalizeEventSlug(process.env.CAL_EVENT_SLUG);
  const bookingTitle = String(process.env.CAL_BOOKING_TITLE || 'Intro Interview').trim();
  const dynamicUsername = `${hrUsername}+${talentUsername}`;
  const clientEmail = String(email).trim().toLowerCase();
  const talentEmailNorm = String(talentEmail || '').trim().toLowerCase();

  const hrEventTypeId = await resolveEventTypeId(hrUsername, eventSlug);
  if (!hrEventTypeId) {
    throw new Error(`HR event "${eventSlug}" not found on Cal account ${hrUsername}`);
  }

  // Cal sends calendar mail to: attendee (client), organizer/host (HR), and guests[].
  // Dynamic hr+talent username does not always email the talent co-host — add explicitly.
  const guests = [];
  if (talentEmailNorm && talentEmailNorm !== clientEmail) {
    guests.push(talentEmailNorm);
  }

  const bookingBody = {
    start: startIso,
    eventTypeId: hrEventTypeId,
    username: dynamicUsername,
    attendee: {
      name: String(name).trim(),
      email: clientEmail,
      timeZone: DEFAULT_BOOKING_TIMEZONE,
      language: 'en',
    },
    bookingFieldsResponses: { title: bookingTitle },
    metadata: {
      talentId: String(talentId),
      slotId: String(slotId),
      talentUsername: String(talentUsername),
      talentEmail: talentEmailNorm || null,
      talentName: talentName || null,
    },
  };

  if (guests.length) {
    bookingBody.guests = guests;
  }

  const created = await calFetch('/v2/bookings', {
    method: 'POST',
    body: bookingBody,
    accessToken: getCalApiKey(),
    apiVersion: '2024-08-13',
  });

  const booking = created?.data ?? created;
  return {
    uid: booking?.uid,
    title: booking?.title || bookingTitle,
    start: booking?.start,
    end: booking?.end,
    meetingUrl: booking?.meetingUrl || booking?.location || null,
    status: booking?.status,
  };
}

module.exports = {
  DEFAULT_BOOKING_TIMEZONE,
  resolveIanaTimezone,
  normalizeEventSlug,
  dateKeyInTimezone,
  groupSlotsByDay,
  fetchAvailabilitySets,
  isInstantBookable,
  normalizeSlotInstant,
  createCalIntroBooking,
  getCalApiKey,
};

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const db = require('../services/dbService');

const router = express.Router();

const CAL_API_VERSION = process.env.CAL_API_VERSION || '2024-06-14';
const CAL_SLOTS_API_VERSION = process.env.CAL_SLOTS_API_VERSION || '2024-06-14';
const CAL_API_BASE = (process.env.CAL_API_BASE || 'https://api.cal.com').replace(/\/+$/, '');
const CAL_AUTH_ORIGIN = (process.env.CAL_AUTH_ORIGIN || 'https://app.cal.com').replace(/\/+$/, '');
const DEFAULT_BOOKING_TIMEZONE = process.env.CAL_BOOKING_TIMEZONE || 'Asia/Karachi';
const OAUTH_SCOPES = process.env.CAL_OAUTH_SCOPES || 'PROFILE_READ APPS_READ';

const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null;

function getServerBaseUrl(req) {
  return process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
}

function getOAuthRedirectUri(req) {
  return process.env.CAL_REDIRECT_URI || `${getServerBaseUrl(req)}/api/cal/connect/callback`;
}

function getClientBaseUrl() {
  return process.env.CLIENT_URI || process.env.FRONTEND_URL || 'http://localhost:5173';
}

function requireCalOAuthConfig(res) {
  if (!process.env.CAL_CLIENT_ID || !process.env.CAL_CLIENT_SECRET) {
    res.status(500).json({
      error: 'Missing Cal.com OAuth env vars. Required: CAL_CLIENT_ID, CAL_CLIENT_SECRET',
    });
    return false;
  }
  return true;
}

function requireCalBookingConfig(res) {
  if (!process.env.CAL_USERNAME || !process.env.CAL_EVENT_SLUG) {
    res.status(500).json({
      error: 'Missing Cal.com booking env vars. Required: CAL_USERNAME, CAL_EVENT_SLUG',
    });
    return false;
  }
  return true;
}

function requireCalApiKey(res) {
  if (!process.env.CAL_API_KEY) {
    res.status(500).json({
      error: 'Missing CAL_API_KEY. Create one at Cal.com → Settings → Developer → API keys.',
    });
    return false;
  }
  return true;
}

function getCalApiKey() {
  return process.env.CAL_API_KEY;
}

function dateKeyInTimezone(isoString, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoString));
}

/** Flatten Cal /v2/slots response into sorted { start } objects (UTC ISO). */
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

/** Keep earliest mutual slot per calendar day in booker timezone. */
function pickFirstSlotPerDay(slots, timeZone) {
  const byDay = new Map();
  for (const slot of slots) {
    const day = dateKeyInTimezone(slot.start, timeZone);
    if (!byDay.has(day)) byDay.set(day, slot);
  }
  return Array.from(byDay.values());
}

async function fetchMutualCalSlots({ hrUsername, talentUsername, daysAhead = 14 }) {
  const eventSlug = normalizeEventSlug(process.env.CAL_EVENT_SLUG);
  const timeZone = DEFAULT_BOOKING_TIMEZONE;
  const start = new Date();
  const end = new Date(start.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const hrEventTypeId = await resolveEventTypeId(hrUsername, eventSlug);
  if (!hrEventTypeId) {
    throw new Error(
      `HR Cal account "${hrUsername}" has no event type with slug "${eventSlug}". Create it in Cal.com first.`
    );
  }

  let talentEventTypeId = await resolveEventTypeId(talentUsername, eventSlug);
  if (!talentEventTypeId) {
    talentEventTypeId = hrEventTypeId;
  }

  const [hrSlots, talentSlots] = await Promise.all([
    fetchSlotsForUser({
      username: hrUsername,
      eventTypeId: hrEventTypeId,
      startDate: startStr,
      endDate: endStr,
      timeZone,
    }),
    fetchSlotsForUser({
      username: talentUsername,
      eventTypeId: talentEventTypeId,
      startDate: startStr,
      endDate: endStr,
      timeZone,
    }),
  ]);

  const mutual = intersectSlotLists(hrSlots, talentSlots);
  const firstPerDay = pickFirstSlotPerDay(mutual, timeZone);
  return {
    allSlots: mutual,
    slots: firstPerDay,
    eventSlug,
    timeZone,
    hrEventTypeId,
    talentEventTypeId,
  };
}

function formatCalApiError(data, fallback = 'Cal.com API error') {
  if (!data) return fallback;
  const err = data.error ?? data;
  if (typeof err === 'string') return err;
  if (typeof err?.message === 'string') return err.message;
  if (typeof data.message === 'string') return data.message;
  if (Array.isArray(data.message)) {
    return data.message.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('; ');
  }
  if (err?.details?.message) return String(err.details.message);
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

/** Mutual slots = same start instants present in both users' availability. */
function intersectSlotLists(slotsA, slotsB) {
  const setB = new Set(slotsB.map((s) => normalizeSlotInstant(s.start)));
  return slotsA.filter((s) => setB.has(normalizeSlotInstant(s.start)));
}

async function saveTalentCalConnection({ talentId, email, username, userId }) {
  const payload = {
    cal_username: username,
    cal_user_id: userId ? String(userId) : null,
    cal_connected_at: new Date().toISOString(),
  };

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update(payload)
      .eq('user_id', talentId);
    if (error) throw error;
    return { talentId, email, username, userId, source: 'supabase' };
  }

  const record = await db.saveCalConnection({ talentId, email, username, userId });
  return { ...record, source: 'local-db' };
}

async function loadTalentCalConnection(talentId) {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('cal_username, cal_user_id, email')
      .eq('user_id', talentId)
      .maybeSingle();
    if (error) throw error;
    return {
      username: data?.cal_username || null,
      userId: data?.cal_user_id || null,
      email: data?.email || '',
    };
  }
  const local = await db.getCalConnectionByTalentId(talentId);
  return {
    username: local?.username || null,
    userId: local?.userId || null,
    email: local?.email || '',
  };
}

const INACTIVE_BOOKING_STATUSES = new Set(['cancelled', 'canceled', 'rejected']);

function isActiveBookingStatus(status) {
  return !INACTIVE_BOOKING_STATUSES.has(String(status || '').toLowerCase());
}

function formatIntroBookingResponse(row) {
  if (!row) return null;
  return {
    uid: row.cal_uid || row.calUid || null,
    title: row.title || String(process.env.CAL_BOOKING_TITLE || 'Intro Interview'),
    start: row.start_at || row.start,
    end: row.end_at || row.end || null,
    meetingUrl: row.meeting_url || row.meetingUrl || null,
    status: row.status || 'accepted',
    guestName: row.guest_name || row.guestName || null,
    guestEmail: row.guest_email || row.guestEmail || null,
  };
}

function mapCalApiBookingToIntro(calBooking) {
  if (!calBooking) return null;
  const start = calBooking.start || calBooking.startTime;
  if (!start) return null;
  if (!isActiveBookingStatus(calBooking.status)) return null;
  if (new Date(start).getTime() < Date.now()) return null;

  const attendee = Array.isArray(calBooking.attendees) ? calBooking.attendees[0] : null;
  return {
    uid: calBooking.uid,
    title: calBooking.title || String(process.env.CAL_BOOKING_TITLE || 'Intro Interview'),
    start,
    end: calBooking.end || calBooking.endTime || null,
    meetingUrl: calBooking.meetingUrl || calBooking.location || null,
    status: calBooking.status || 'accepted',
    guestName: attendee?.name || null,
    guestEmail: attendee?.email || null,
  };
}

async function saveIntroBookingRecord({
  talentId,
  calUid,
  title,
  start,
  end,
  guestName,
  guestEmail,
  meetingUrl,
  status,
}) {
  const payload = {
    talent_id: talentId,
    cal_uid: calUid || null,
    title: title || String(process.env.CAL_BOOKING_TITLE || 'Intro Interview'),
    start_at: new Date(start).toISOString(),
    end_at: end ? new Date(end).toISOString() : null,
    guest_name: guestName || null,
    guest_email: guestEmail || null,
    meeting_url: meetingUrl || null,
    status: status || 'accepted',
  };

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .upsert(payload, { onConflict: 'talent_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  return db.saveIntroBooking({
    talentId,
    calUid: payload.cal_uid,
    title: payload.title,
    start: payload.start_at,
    end: payload.end_at,
    guestName: payload.guest_name,
    guestEmail: payload.guest_email,
    meetingUrl: payload.meeting_url,
    status: payload.status,
  });
}

async function findStoredIntroBookingRecord(talentId) {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .select('*')
      .eq('talent_id', talentId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
  return db.getIntroBookingByTalentId(talentId);
}

async function clearIntroBookingRecord(talentId) {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('intro_bookings')
      .delete()
      .eq('talent_id', talentId);
    if (error) throw error;
    return;
  }
  await db.deleteIntroBooking(talentId);
}

async function fetchCalBookingByUid(uid) {
  const id = String(uid || '').trim();
  if (!id) return null;
  try {
    const data = await calFetch(`/v2/bookings/${encodeURIComponent(id)}`, {
      accessToken: getCalApiKey(),
      apiVersion: '2024-08-13',
    });
    return data?.data ?? data;
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('404') || msg.toLowerCase().includes('not found')) return null;
    throw err;
  }
}

async function findCalIntroBooking({ talentId, hrUsername, talentUsername, eventSlug }) {
  const hrEventTypeId = await resolveEventTypeId(hrUsername, eventSlug);
  if (!hrEventTypeId) return null;

  const params = new URLSearchParams({
    eventTypeId: String(hrEventTypeId),
    status: 'upcoming',
    take: '50',
  });

  const data = await calFetch(`/v2/bookings?${params}`, {
    accessToken: getCalApiKey(),
    apiVersion: '2024-08-13',
  });

  const list = Array.isArray(data?.data) ? data.data : [];
  const dynamicNeedle = `${hrUsername}+${talentUsername}`.toLowerCase();

  for (const booking of list) {
    const metaTalent = booking?.metadata?.talentId ?? booking?.metadata?.talent_id;
    if (metaTalent && String(metaTalent) === String(talentId)) {
      return mapCalApiBookingToIntro(booking);
    }

    const blob = JSON.stringify({
      hosts: booking?.hosts,
      users: booking?.users,
      user: booking?.user,
      responses: booking?.responses,
    }).toLowerCase();

    if (blob.includes(dynamicNeedle)) {
      return mapCalApiBookingToIntro(booking);
    }

    const full = JSON.stringify(booking).toLowerCase();
    if (
      full.includes(talentUsername.toLowerCase())
      && (full.includes(dynamicNeedle) || full.includes(`"${hrUsername}+`))
    ) {
      return mapCalApiBookingToIntro(booking);
    }
  }

  return null;
}

/**
 * Cal.com is source of truth: refresh DB on each check so cancel/reschedule in Cal
 * is reflected on the portal (clears block or updates shown time).
 */
async function syncIntroBookingState(talentId, talentUsername) {
  const hrUsername = String(process.env.CAL_USERNAME || '').trim().toLowerCase();
  const eventSlug = normalizeEventSlug(process.env.CAL_EVENT_SLUG);

  let stored = null;
  try {
    stored = await findStoredIntroBookingRecord(talentId);
  } catch (err) {
    console.warn('intro_bookings lookup failed:', err?.message || err);
  }

  const fallback = {
    guestName: stored?.guest_name || stored?.guestName,
    guestEmail: stored?.guest_email || stored?.guestEmail,
  };

  let activeBooking = null;

  if (stored?.cal_uid) {
    try {
      const raw = await fetchCalBookingByUid(stored.cal_uid);
      activeBooking = mapCalApiBookingToIntro(raw);
    } catch (err) {
      console.warn('Cal booking-by-uid failed:', err?.message || err);
    }
  }

  if (!activeBooking) {
    try {
      activeBooking = await findCalIntroBooking({
        talentId,
        hrUsername,
        talentUsername,
        eventSlug,
      });
    } catch (err) {
      console.warn('Cal existing-booking lookup failed:', err?.message || err);
    }
  }

  if (activeBooking) {
    try {
      await saveIntroBookingRecord({
        talentId: String(talentId),
        calUid: activeBooking.uid,
        title: activeBooking.title,
        start: activeBooking.start,
        end: activeBooking.end,
        guestName: activeBooking.guestName || fallback.guestName,
        guestEmail: activeBooking.guestEmail || fallback.guestEmail,
        meetingUrl: activeBooking.meetingUrl,
        status: activeBooking.status,
      });
    } catch (err) {
      console.warn('intro_bookings sync save failed:', err?.message || err);
    }
    return { source: 'cal', booking: activeBooking };
  }

  if (stored) {
    try {
      await clearIntroBookingRecord(talentId);
    } catch (err) {
      console.warn('intro_bookings clear failed:', err?.message || err);
    }
  }

  return null;
}

async function resolveExistingIntroBooking(talentId, talentUsername) {
  return syncIntroBookingState(talentId, talentUsername);
}

/** Real event-type slug on HR Cal account (e.g. 30min). Never "dynamic" — that weakens busy checks. */
function normalizeEventSlug(raw) {
  let slug = String(raw || '30min').trim().toLowerCase();
  slug = slug.split('?')[0].split('/')[0];
  if (!slug || slug === 'dynamic' || slug.startsWith('dynamic')) {
    slug = '30min';
  }
  return slug;
}

/**
 * Dynamic group embed path: {hr}+{talent}/{eventSlug}
 * Example: aaqibhr+talentuser/30min
 * Avoid: aaqibhr+talent/dynamic?duration=30 (only blocks exact 30m overlaps, not longer events)
 */
function buildDynamicCalLink(hrUsername, talentUsername) {
  const hr = String(hrUsername || '').trim().toLowerCase();
  const talent = String(talentUsername || '').trim().toLowerCase();
  const eventSlug = normalizeEventSlug(process.env.CAL_EVENT_SLUG);
  if (!hr || !talent) return null;
  return `${hr}+${talent}/${eventSlug}`;
}

function sanitizeCalLink(calLink) {
  if (!calLink) return '';
  let path = String(calLink).trim().replace(/^https?:\/\/[^/]+\//i, '');
  path = path.split('?')[0];
  // Cal falls back to /dynamic?duration=30 when slug is wrong — rewrite to real event slug
  path = path.replace(/\/dynamic$/i, `/${normalizeEventSlug(process.env.CAL_EVENT_SLUG)}`);
  const match = path.match(/^([^/]+\+[^/]+)(?:\/(.+))?$/);
  if (!match) return path;
  const hosts = match[1];
  const slug = normalizeEventSlug(match[2] || process.env.CAL_EVENT_SLUG);
  return `${hosts}/${slug}`;
}

// Talent OAuth — link Cal.com account (username used for dynamic group booking)
router.get('/connect/start', (req, res) => {
  if (!requireCalOAuthConfig(res)) return;

  const talentId = String(req.query.talentId || '').trim();
  const email = String(req.query.email || '').trim();
  if (!talentId) return res.status(400).json({ error: 'talentId is required' });

  const redirectUri = getOAuthRedirectUri(req);
  const state = Buffer.from(JSON.stringify({ talentId, email })).toString('base64url');

  const authUrl = new URL(`${CAL_AUTH_ORIGIN}/auth/oauth2/authorize`);
  authUrl.searchParams.set('client_id', process.env.CAL_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', OAUTH_SCOPES.replace(/,/g, ' '));

  return res.redirect(authUrl.toString());
});

router.get('/connect/callback', async (req, res) => {
  if (!requireCalOAuthConfig(res)) return;

  const clientUrl = new URL('/portal', getClientBaseUrl());

  try {
    const code = String(req.query.code || '');
    const stateEncoded = String(req.query.state || '');
    const oauthError = String(req.query.error || '');
    if (oauthError) {
      clientUrl.searchParams.set('cal', 'error');
      clientUrl.searchParams.set('cal_reason', oauthError);
      return res.redirect(clientUrl.toString());
    }
    if (!code || !stateEncoded) {
      return res.status(400).send('Missing OAuth parameters');
    }

    const state = JSON.parse(Buffer.from(stateEncoded, 'base64url').toString('utf8'));
    const talentId = String(state.talentId || '').trim();
    const talentEmail = String(state.email || '').trim();
    if (!talentId) return res.status(400).send('Invalid OAuth state');

    const redirectUri = getOAuthRedirectUri(req);
    const tokenData = await calFetch('/v2/auth/oauth2/token', {
      method: 'POST',
      body: {
        client_id: process.env.CAL_CLIENT_ID,
        client_secret: process.env.CAL_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      },
    });

    const accessToken = tokenData?.access_token;
    if (!accessToken) throw new Error('Cal.com OAuth did not return an access token');

    const profile = await calFetch('/v2/me', { accessToken });
    const me = profile?.data || profile;
    const username = String(me?.username || me?.user?.username || '').trim().toLowerCase();
    const userId = me?.id ?? me?.user?.id ?? null;
    if (!username) {
      throw new Error('Could not read Cal.com username from profile');
    }

    await saveTalentCalConnection({
      talentId,
      email: talentEmail,
      username,
      userId,
    });

    clientUrl.searchParams.set('cal', 'connected');
    return res.redirect(clientUrl.toString());
  } catch (error) {
    console.error('Cal.com callback error:', error?.message || error);
    clientUrl.searchParams.set('cal', 'error');
    return res.redirect(clientUrl.toString());
  }
});

router.get('/connection/:talentId', async (req, res) => {
  const talentId = String(req.params.talentId || '').trim();
  if (!talentId) return res.status(400).json({ error: 'talentId is required' });
  try {
    const record = await loadTalentCalConnection(talentId);
    res.json({
      connected: Boolean(record?.username),
      username: record?.username || null,
      userId: record?.userId || null,
    });
  } catch (error) {
    console.error('Cal connection lookup error:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Failed to load connection' });
  }
});

// Dynamic collective booking link for Request Intro (HR + talent mutual availability)
router.get('/booking-link/:talentId', async (req, res) => {
  if (!requireCalBookingConfig(res)) return;

  const talentId = String(req.params.talentId || '').trim();
  if (!talentId) return res.status(400).json({ error: 'talentId is required' });

  try {
    const talent = await loadTalentCalConnection(talentId);
    if (!talent?.username) {
      return res.status(400).json({
        error: 'Talent has not connected Cal.com yet. Ask them to connect from the portal.',
        code: 'TALENT_CAL_NOT_CONNECTED',
      });
    }

    const calLink = sanitizeCalLink(
      buildDynamicCalLink(process.env.CAL_USERNAME, talent.username)
    );
    if (!calLink) {
      return res.status(500).json({ error: 'Could not build Cal.com booking link' });
    }

    const eventSlug = normalizeEventSlug(process.env.CAL_EVENT_SLUG);

    console.log('[Cal.com] booking-link', {
      talentId,
      calLink,
      eventSlug,
      bookingUrl: `https://cal.com/${calLink}`,
    });

    const bookingTitle = String(
      process.env.CAL_BOOKING_TITLE || 'Intro Interview'
    ).trim();

    return res.json({
      calLink,
      eventSlug,
      bookingTitle,
      timezone: DEFAULT_BOOKING_TIMEZONE,
      hrUsername: process.env.CAL_USERNAME,
      talentUsername: talent.username,
      bookingUrl: `https://cal.com/${calLink}`,
      hint: `Use a real ${eventSlug} event on the HR Cal account (${process.env.CAL_USERNAME}), not /dynamic?duration=30.`,
    });
  } catch (error) {
    console.error('Cal booking-link error:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to build booking link' });
  }
});

// Mutual HR + talent slots — backend filters to first slot per day (embed cannot enforce this for all hosts)
router.get('/slots/:talentId', async (req, res) => {
  if (!requireCalBookingConfig(res)) return;
  if (!requireCalApiKey(res)) return;

  const talentId = String(req.params.talentId || '').trim();
  if (!talentId) return res.status(400).json({ error: 'talentId is required' });

  try {
    const talent = await loadTalentCalConnection(talentId);
    if (!talent?.username) {
      return res.status(400).json({
        error: 'Talent has not connected Cal.com yet. Ask them to connect from the portal.',
        code: 'TALENT_CAL_NOT_CONNECTED',
      });
    }

    const hrUsername = String(process.env.CAL_USERNAME || '').trim().toLowerCase();
    const existing = await resolveExistingIntroBooking(talentId, talent.username);
    if (existing?.booking) {
      const bookingTitle = String(process.env.CAL_BOOKING_TITLE || 'Intro Interview').trim();
      return res.json({
        success: true,
        slots: [],
        existingBooking: existing.booking,
        alreadyBooked: true,
        totalMutualSlots: 0,
        eventSlug: normalizeEventSlug(process.env.CAL_EVENT_SLUG),
        bookingTitle,
        timezone: DEFAULT_BOOKING_TIMEZONE,
        hrUsername,
        talentUsername: talent.username,
        dynamicUsername: `${hrUsername}+${talent.username}`,
      });
    }

    const daysAhead = Math.min(60, Math.max(1, parseInt(req.query.days, 10) || 14));
    const { slots, allSlots, eventSlug, timeZone } = await fetchMutualCalSlots({
      hrUsername,
      talentUsername: talent.username,
      daysAhead,
    });

    const bookingTitle = String(process.env.CAL_BOOKING_TITLE || 'Intro Interview').trim();

    return res.json({
      success: true,
      slots,
      existingBooking: null,
      alreadyBooked: false,
      totalMutualSlots: allSlots.length,
      eventSlug,
      bookingTitle,
      timezone: timeZone,
      hrUsername,
      talentUsername: talent.username,
      dynamicUsername: `${hrUsername}+${talent.username}`,
    });
  } catch (error) {
    const message = error?.message || formatCalApiError(error, 'Failed to load slots');
    console.error('Cal slots error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /v2/bookings — dynamic group: username = "hr+talent", eventTypeSlug, start (UTC ISO).
 */
router.post('/bookings', async (req, res) => {
  if (!requireCalBookingConfig(res)) return;
  if (!requireCalApiKey(res)) return;

  try {
    const {
      talentId,
      start,
      name,
      email,
    } = req.body || {};

    if (!talentId || !start || !name || !email) {
      return res.status(400).json({
        error: 'talentId, start, name, and email are required',
      });
    }

    const talent = await loadTalentCalConnection(String(talentId));
    if (!talent?.username) {
      return res.status(400).json({
        error: 'Talent has not connected Cal.com yet.',
        code: 'TALENT_CAL_NOT_CONNECTED',
      });
    }

    const existing = await resolveExistingIntroBooking(String(talentId), talent.username);
    if (existing?.booking) {
      return res.status(409).json({
        success: false,
        code: 'INTRO_ALREADY_BOOKED',
        error: 'An intro call is already scheduled for this talent with HR.',
        booking: existing.booking,
      });
    }

    const hrUsername = String(process.env.CAL_USERNAME || '').trim().toLowerCase();
    const eventSlug = normalizeEventSlug(process.env.CAL_EVENT_SLUG);
    const bookingTitle = String(process.env.CAL_BOOKING_TITLE || 'Intro Interview').trim();
    const dynamicUsername = `${hrUsername}+${talent.username}`;

    const startIso = new Date(start).toISOString();
    if (Number.isNaN(new Date(startIso).getTime())) {
      return res.status(400).json({ error: 'Invalid start time' });
    }

    const hrEventTypeId = await resolveEventTypeId(hrUsername, eventSlug);
    if (!hrEventTypeId) {
      return res.status(500).json({
        error: `HR event "${eventSlug}" not found on Cal account ${hrUsername}`,
      });
    }

    const bookingBody = {
      start: startIso,
      eventTypeId: hrEventTypeId,
      username: dynamicUsername,
      attendee: {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        timeZone: DEFAULT_BOOKING_TIMEZONE,
        language: 'en',
      },
      bookingFieldsResponses: {
        title: bookingTitle,
      },
      metadata: {
        talentId: String(talentId),
      },
    };

    let created;
    try {
      created = await calFetch('/v2/bookings', {
        method: 'POST',
        body: bookingBody,
        accessToken: getCalApiKey(),
        apiVersion: '2024-08-13',
      });
    } catch (bookErr) {
      const bookUrl = new URL(`https://cal.com/${dynamicUsername}/${eventSlug}`);
      bookUrl.searchParams.set('date', startIso.slice(0, 10));
      bookUrl.searchParams.set('slot', startIso);
      bookUrl.searchParams.set('name', String(name).trim());
      bookUrl.searchParams.set('email', String(email).trim().toLowerCase());
      if (bookingTitle) bookUrl.searchParams.set('title', bookingTitle);
      throw new Error(
        `${bookErr.message} Open this link to complete booking: ${bookUrl.toString()}`
      );
    }

    const booking = created?.data ?? created;
    const saved = {
      uid: booking?.uid,
      title: booking?.title || bookingTitle,
      start: booking?.start,
      end: booking?.end,
      meetingUrl: booking?.meetingUrl || booking?.location || null,
      status: booking?.status,
      guestName: String(name).trim(),
      guestEmail: String(email).trim().toLowerCase(),
    };

    try {
      await saveIntroBookingRecord({
        talentId: String(talentId),
        calUid: saved.uid,
        title: saved.title,
        start: saved.start,
        end: saved.end,
        guestName: saved.guestName,
        guestEmail: saved.guestEmail,
        meetingUrl: saved.meetingUrl,
        status: saved.status,
      });
    } catch (saveErr) {
      console.warn('Intro booking saved in Cal but DB persist failed:', saveErr?.message || saveErr);
    }

    return res.status(201).json({
      success: true,
      booking: saved,
    });
  } catch (error) {
    console.error('Cal create booking error:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create booking',
    });
  }
});

module.exports = router;

/**
 * Persist discovery-call rows (Cal.com webhook → client_discovery_bookings).
 */

const { createClient } = require('@supabase/supabase-js');
const db = require('./dbService');

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const INACTIVE_STATUSES = new Set(['cancelled', 'canceled', 'rejected']);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id || row.clientId,
    calUid: row.cal_uid || row.calUid,
    title: row.title || 'Discovery Call',
    start: row.start_at || row.start,
    end: row.end_at || row.end,
    meetingUrl: row.meeting_url || row.meetingUrl || null,
    guestName: row.guest_name || row.guestName || null,
    guestEmail: row.guest_email || row.guestEmail || null,
    status: row.status || 'confirmed',
  };
}

/**
 * @param {object} fields
 * @returns {Promise<object|null>}
 */
async function upsertDiscoveryBooking({
  clientId,
  calUid,
  title,
  startAt,
  endAt,
  meetingUrl,
  guestName,
  guestEmail,
  status = 'confirmed',
}) {
  const uid = String(calUid || '').trim();
  const email = normalizeEmail(guestEmail);
  const start = startAt ? new Date(startAt).toISOString() : null;

  if (!clientId || !uid || !email || !start) {
    throw new Error('Discovery booking requires clientId, calUid, guestEmail, and startAt.');
  }

  const now = new Date().toISOString();
  const payload = {
    client_id: clientId,
    cal_uid: uid,
    title: String(title || 'Discovery Call').trim() || 'Discovery Call',
    start_at: start,
    end_at: endAt ? new Date(endAt).toISOString() : null,
    meeting_url: meetingUrl || null,
    guest_name: guestName || null,
    guest_email: email,
    status,
    updated_at: now,
  };

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_discovery_bookings')
      .upsert(payload, { onConflict: 'cal_uid' })
      .select()
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  return db.upsertDiscoveryBooking(payload);
}

async function updateDiscoveryBookingByCalUid(calUid, patch) {
  const uid = String(calUid || '').trim();
  if (!uid) return null;

  const now = new Date().toISOString();
  const updates = { updated_at: now, ...patch };

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_discovery_bookings')
      .update(updates)
      .eq('cal_uid', uid)
      .select()
      .maybeSingle();
    if (error) throw error;
    return mapRow(data);
  }

  return db.updateDiscoveryBookingByCalUid(uid, updates);
}

async function listUpcomingDiscoveryBookingsForClientId(clientId) {
  if (!clientId) return [];

  const nowIso = new Date().toISOString();

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('client_discovery_bookings')
      .select('id, client_id, cal_uid, title, start_at, end_at, meeting_url, guest_name, guest_email, status')
      .eq('client_id', clientId)
      .gte('start_at', nowIso)
      .order('start_at', { ascending: true });
    if (error) throw error;

    return (data || [])
      .filter((row) => !INACTIVE_STATUSES.has(String(row.status || '').toLowerCase()))
      .map(mapRow);
  }

  return db.listUpcomingDiscoveryBookingsForClientId(clientId);
}

module.exports = {
  upsertDiscoveryBooking,
  updateDiscoveryBookingByCalUid,
  listUpcomingDiscoveryBookingsForClientId,
  mapRow,
};

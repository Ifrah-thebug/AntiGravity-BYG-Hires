const express = require('express');
const { requireAdmin, supabaseAdmin } = require('../middleware/requireAdmin');

const router = express.Router();
router.use(requireAdmin);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function mapIntroRow(row, talentById) {
  return {
    id: row.id,
    talentId: row.talent_id,
    talentName: talentById.get(row.talent_id)?.name || row.guest_name || null,
    title: row.title || 'Intro Interview',
    startAt: row.start_at,
    endAt: row.end_at,
    meetingUrl: row.meeting_url || null,
    status: row.status || 'accepted',
    company: row.company || null,
    guestName: row.guest_name || null,
    guestEmail: row.guest_email || row.client_email || null,
    calUid: row.cal_uid || null,
    createdAt: row.created_at,
  };
}

async function fetchTalentNames(talentIds) {
  const ids = [...new Set(talentIds.filter(Boolean))];
  if (!ids.length || !supabaseAdmin) return new Map();

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, job_title')
    .in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((p) => [p.id, p]));
}

async function fetchIntrosForClient(client) {
  if (!supabaseAdmin || !client) return [];

  const email = normalizeEmail(client.email);
  const selectCols =
    'id, talent_id, title, start_at, end_at, meeting_url, status, company, guest_name, guest_email, client_email, cal_uid, created_at, client_id';

  const merged = new Map();

  if (client.id) {
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .select(selectCols)
      .eq('client_id', client.id);
    if (error) throw error;
    (data || []).forEach((row) => merged.set(row.id, row));
  }

  if (email) {
    const { data, error } = await supabaseAdmin
      .from('intro_bookings')
      .select(selectCols)
      .or(`client_email.eq.${email},guest_email.eq.${email}`);
    if (error) throw error;
    (data || []).forEach((row) => merged.set(row.id, row));
  }

  const rows = [...merged.values()].sort(
    (a, b) => new Date(b.start_at || 0) - new Date(a.start_at || 0)
  );
  const talentById = await fetchTalentNames(rows.map((r) => r.talent_id));
  return rows.map((row) => mapIntroRow(row, talentById));
}

function summarizeIntros(intros) {
  const now = Date.now();
  let upcoming = 0;
  let past = 0;
  const inactive = new Set(['cancelled', 'rejected', 'canceled']);

  for (const intro of intros) {
    const status = String(intro.status || '').toLowerCase();
    if (inactive.has(status)) continue;
    const start = intro.startAt ? new Date(intro.startAt).getTime() : 0;
    if (start >= now) upcoming += 1;
    else past += 1;
  }

  const lastIntro = intros.find((i) => i.startAt) || null;
  return {
    total: intros.length,
    upcoming,
    past,
    lastIntroAt: lastIntro?.startAt || null,
  };
}

function mapClientRow(client, intros) {
  const stats = summarizeIntros(intros);
  return {
    id: client.id,
    email: client.email,
    name: client.name || null,
    company: client.company || null,
    userId: client.user_id || null,
    activated: Boolean(client.account_confirmed_at),
    activatedAt: client.account_confirmed_at || null,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
    introCount: stats.total,
    upcomingIntroCount: stats.upcoming,
    lastIntroAt: stats.lastIntroAt,
  };
}

/** GET /api/admin/clients — all clients with intro summary */
router.get('/', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Server database is not configured.' });
    }

    const search = String(req.query.search || '').trim().toLowerCase();

    const { data: clients, error: clientsErr } = await supabaseAdmin
      .from('clients')
      .select('id, email, name, company, user_id, account_confirmed_at, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (clientsErr) throw clientsErr;

    const { data: bookings, error: bookingsErr } = await supabaseAdmin
      .from('intro_bookings')
      .select('id, client_id, client_email, talent_id, start_at, status, title, end_at, meeting_url, guest_name, guest_email, cal_uid, created_at')
      .order('start_at', { ascending: false });
    if (bookingsErr) throw bookingsErr;

    const introsByClientId = new Map();
    const introsByEmail = new Map();

    for (const row of bookings || []) {
      const intro = {
        id: row.id,
        talentId: row.talent_id,
        title: row.title,
        startAt: row.start_at,
        endAt: row.end_at,
        status: row.status,
        meetingUrl: row.meeting_url,
        guestName: row.guest_name,
        guestEmail: row.guest_email || row.client_email,
      };

      if (row.client_id) {
        if (!introsByClientId.has(row.client_id)) introsByClientId.set(row.client_id, []);
        introsByClientId.get(row.client_id).push(intro);
      }

      const email = normalizeEmail(row.client_email || row.guest_email);
      if (email) {
        if (!introsByEmail.has(email)) introsByEmail.set(email, []);
        introsByEmail.get(email).push(intro);
      }
    }

    let rows = (clients || []).map((client) => {
      const byId = introsByClientId.get(client.id) || [];
      const byEmail = introsByEmail.get(normalizeEmail(client.email)) || [];
      const merged = new Map();
      [...byId, ...byEmail].forEach((i) => merged.set(i.id, i));
      const intros = [...merged.values()].sort(
        (a, b) => new Date(b.startAt || 0) - new Date(a.startAt || 0)
      );
      return mapClientRow(client, intros);
    });

    if (search) {
      rows = rows.filter((c) =>
        [c.name, c.email, c.company].filter(Boolean).join(' ').toLowerCase().includes(search)
      );
    }

    return res.json({ clients: rows });
  } catch (err) {
    console.error('[admin/clients list]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not load clients.' });
  }
});

/** GET /api/admin/clients/:id — client detail + intros */
router.get('/:id', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Server database is not configured.' });
    }

    const clientId = String(req.params.id || '').trim();
    if (!clientId) return res.status(400).json({ error: 'Client id is required.' });

    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, email, name, company, user_id, account_confirmed_at, created_at, updated_at')
      .eq('id', clientId)
      .maybeSingle();
    if (clientErr) throw clientErr;
    if (!client) return res.status(404).json({ error: 'Client not found.' });

    const intros = await fetchIntrosForClient(client);

    return res.json({
      client: mapClientRow(client, intros),
      intros,
    });
  } catch (err) {
    console.error('[admin/clients detail]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not load client.' });
  }
});

module.exports = router;

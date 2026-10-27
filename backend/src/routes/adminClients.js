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

function mapClientRow(client, intros, workforce = {}) {
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
    hiredTalentCount: workforce.hiredTalentCount || 0,
    activeHireCount: workforce.activeHireCount || 0,
    engagementCount: workforce.engagementCount || 0,
    contractCount: workforce.contractCount || 0,
    signedContractCount: workforce.signedContractCount || 0,
  };
}

function isMissingWorkforceSchema(err) {
  const msg = String(err?.message || err?.details || '');
  return /does not exist|schema cache|Could not find the table/i.test(msg);
}

/** Aggregate hire/contract counts per client email from Workforce tables. */
async function fetchWorkforceSummaryByEmail() {
  const byEmail = new Map();
  const empty = () => ({
    hiredTalentCount: 0,
    activeHireCount: 0,
    engagementCount: 0,
    contractCount: 0,
    signedContractCount: 0,
    talentEmails: new Set(),
    engagementIds: [],
  });

  try {
    const { data: engagements, error: engErr } = await supabaseAdmin
      .from('wf_engagements')
      .select('id, client_email, talent_email, status');
    if (engErr) throw engErr;

    for (const row of engagements || []) {
      const email = normalizeEmail(row.client_email);
      if (!email) continue;
      if (!byEmail.has(email)) byEmail.set(email, empty());
      const bucket = byEmail.get(email);
      bucket.engagementCount += 1;
      bucket.engagementIds.push(row.id);
      if (row.talent_email) bucket.talentEmails.add(normalizeEmail(row.talent_email));
      if (['active', 'contracted', 'offered', 'paused'].includes(row.status)) {
        bucket.activeHireCount += 1;
      }
    }

    const allEngIds = [...byEmail.values()].flatMap((b) => b.engagementIds);
    if (allEngIds.length) {
      const { data: contracts, error: cErr } = await supabaseAdmin
        .from('wf_contracts')
        .select('id, engagement_id, status')
        .in('engagement_id', allEngIds)
        .neq('status', 'void');
      if (cErr) throw cErr;

      const engToEmail = new Map();
      for (const [email, bucket] of byEmail) {
        for (const id of bucket.engagementIds) engToEmail.set(id, email);
      }
      for (const c of contracts || []) {
        const email = engToEmail.get(c.engagement_id);
        if (!email || !byEmail.has(email)) continue;
        const bucket = byEmail.get(email);
        bucket.contractCount += 1;
        if (c.status === 'signed') bucket.signedContractCount += 1;
      }
    }

    for (const bucket of byEmail.values()) {
      bucket.hiredTalentCount = bucket.talentEmails.size;
      delete bucket.talentEmails;
      delete bucket.engagementIds;
    }
  } catch (err) {
    if (!isMissingWorkforceSchema(err)) {
      console.warn('[admin/clients] workforce summary:', err?.message || err);
    }
  }

  return byEmail;
}

/** Engagements + contracts (+ signature summary) for one client email. */
async function fetchWorkforceDetailForClient(clientEmail) {
  const email = normalizeEmail(clientEmail);
  if (!email) return { engagements: [], contracts: [] };

  try {
    const { data: engRows, error: engErr } = await supabaseAdmin
      .from('wf_engagements')
      .select('id, talent_email, talent_name, role_title, status, start_date, end_date, created_at, client_email, client_name')
      .ilike('client_email', email)
      .order('created_at', { ascending: false });
    if (engErr) throw engErr;

    const engagements = (engRows || []).map((r) => ({
      id: r.id,
      talentEmail: r.talent_email,
      talentName: r.talent_name,
      roleTitle: r.role_title,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
      createdAt: r.created_at,
      clientEmail: r.client_email,
      clientName: r.client_name,
    }));

    const engIds = engagements.map((e) => e.id);
    if (!engIds.length) return { engagements, contracts: [] };

    const { data: contractRows, error: cErr } = await supabaseAdmin
      .from('wf_contracts')
      .select('id, engagement_id, status, ai_review_status, rendered_html, created_at, updated_at')
      .in('engagement_id', engIds)
      .neq('status', 'void')
      .order('created_at', { ascending: false });
    if (cErr) throw cErr;

    const contractIds = (contractRows || []).map((c) => c.id);
    let sigsByContract = new Map();
    if (contractIds.length) {
      const { data: sigs, error: sErr } = await supabaseAdmin
        .from('wf_signatures')
        .select('id, contract_id, role, signed_at, signer_email')
        .in('contract_id', contractIds);
      if (!sErr) {
        for (const s of sigs || []) {
          if (!sigsByContract.has(s.contract_id)) sigsByContract.set(s.contract_id, []);
          sigsByContract.get(s.contract_id).push({
            id: s.id,
            role: s.role,
            signedAt: s.signed_at,
            signerEmail: s.signer_email,
          });
        }
      }
    }

    const engById = new Map(engagements.map((e) => [e.id, e]));
    const contracts = (contractRows || []).map((c) => {
      const eng = engById.get(c.engagement_id);
      const signatures = sigsByContract.get(c.id) || [];
      return {
        id: c.id,
        engagementId: c.engagement_id,
        status: c.status,
        aiReviewStatus: c.ai_review_status,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        hasHtml: Boolean(c.rendered_html),
        renderedHtml: c.rendered_html || null,
        signatures,
        signedRoles: signatures.filter((s) => s.signedAt).map((s) => s.role),
        talentName: eng?.talentName || null,
        talentEmail: eng?.talentEmail || null,
        roleTitle: eng?.roleTitle || null,
        engagementStatus: eng?.status || null,
      };
    });

    return { engagements, contracts };
  } catch (err) {
    if (!isMissingWorkforceSchema(err)) {
      console.warn('[admin/clients] workforce detail:', err?.message || err);
    }
    return { engagements: [], contracts: [] };
  }
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

    const workforceByEmail = await fetchWorkforceSummaryByEmail();

    let rows = (clients || []).map((client) => {
      const byId = introsByClientId.get(client.id) || [];
      const byEmail = introsByEmail.get(normalizeEmail(client.email)) || [];
      const merged = new Map();
      [...byId, ...byEmail].forEach((i) => merged.set(i.id, i));
      const intros = [...merged.values()].sort(
        (a, b) => new Date(b.startAt || 0) - new Date(a.startAt || 0)
      );
      const wf = workforceByEmail.get(normalizeEmail(client.email)) || {};
      return mapClientRow(client, intros, wf);
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

/** GET /api/admin/clients/:id — client detail + intros + workforce hires/contracts */
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
    const workforce = await fetchWorkforceDetailForClient(client.email);
    const talentEmails = new Set(
      workforce.engagements.map((e) => normalizeEmail(e.talentEmail)).filter(Boolean)
    );
    const wfSummary = {
      hiredTalentCount: talentEmails.size,
      activeHireCount: workforce.engagements.filter((e) =>
        ['active', 'contracted', 'offered', 'paused'].includes(e.status)
      ).length,
      engagementCount: workforce.engagements.length,
      contractCount: workforce.contracts.length,
      signedContractCount: workforce.contracts.filter((c) => c.status === 'signed').length,
    };

    return res.json({
      client: mapClientRow(client, intros, wfSummary),
      intros,
      engagements: workforce.engagements,
      contracts: workforce.contracts,
    });
  } catch (err) {
    console.error('[admin/clients detail]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not load client.' });
  }
});

module.exports = router;

const express = require('express');
const rateLimit = require('express-rate-limit');
const clientActivation = require('../services/clientActivationService');
const discoveryStore = require('../services/discoveryBookingStore');
const db = require('../services/dbService');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

router.use(activateLimiter);

/** Validate activation token before showing password form. */
router.get('/activate/verify', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const result = await clientActivation.verifyActivationToken(token);
    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        code: result.code,
        error: result.message,
        email: result.email || undefined,
      });
    }
    return res.json({ ok: true, ...result.client });
  } catch (err) {
    console.error('[client/activate/verify]', err?.message || err);
    return res.status(500).json({ error: 'Could not verify activation link.' });
  }
});

/** Set password and activate client account. */
router.post('/activate/set-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');

    if (!token) {
      return res.status(400).json({ error: 'Activation token is required.' });
    }

    const result = await clientActivation.completeClientActivation({ token, password });
    return res.json({
      ok: true,
      email: result.email,
      name: result.name,
    });
  } catch (err) {
    const code = err.code || 'ACTIVATION_FAILED';
    const status =
      code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED' || code === 'ALREADY_ACTIVE'
        ? 400
        : 500;
    console.error('[client/activate/set-password]', err?.message || err);
    return res.status(status).json({
      error: err.message || 'Activation failed.',
      code,
    });
  }
});

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Pre-login UI hint — talent is checked before client (no password check). */
router.get('/role-hint', async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    if (!email) return res.status(400).json({ error: 'email is required' });

    let authUserId = null;
    if (supabaseAdmin) {
      authUserId = await clientActivation.findAuthUserIdByEmail(email);
      if (authUserId) {
        const { data: profile, error: profileErr } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('user_id', authUserId)
          .maybeSingle();
        if (profileErr) throw profileErr;
        if (profile) {
          return res.json({ role: 'talent', label: 'Talent account' });
        }
      }
    }

    let client = null;
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('id, email, user_id, account_confirmed_at')
        .eq('email', email)
        .maybeSingle();
      if (error) throw error;
      client = data;
    } else {
      const row = await db.getClientByEmail(email);
      client = row || null;
    }

    if (client?.user_id) {
      return res.json({ role: 'client', label: 'Client account' });
    }
    if (client) {
      return res.json({ role: 'client_pending', label: 'Client — activation required' });
    }

    if (authUserId) {
      return res.json({ role: 'talent', label: 'Talent account — profile setup' });
    }

    return res.json({ role: 'talent', label: 'Talent or new user' });
  } catch (err) {
    console.error('[client/role-hint]', err?.message || err);
    return res.status(500).json({ error: 'Could not look up email.' });
  }
});

/** Client dashboard: upcoming interviews + editable company name. */
router.get('/dashboard/overview', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    let client = null;
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('id, email, name, company, user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      client = data || null;
    } else {
      client = await db.getClientByUserId(userId);
    }

    if (!client) {
      return res.status(404).json({ error: 'Client profile not found.' });
    }

    const nowIso = new Date().toISOString();
    const inactive = new Set(['cancelled', 'rejected', 'canceled']);

    let bookings = [];
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('intro_bookings')
        .select(
          'id,talent_id,title,start_at,end_at,meeting_url,status,company'
        )
        .eq('client_id', client.id)
        .gte('start_at', nowIso)
        .order('start_at', { ascending: true });
      if (error) throw error;

      bookings = (data || [])
        .filter((b) => !inactive.has(String(b.status || '').toLowerCase()))
        .map((b) => ({
          id: b.id,
          talentId: b.talent_id,
          title: b.title,
          start: b.start_at,
          end: b.end_at,
          meetingUrl: b.meeting_url,
          status: b.status,
          company: b.company || null,
          talentName: null,
        }));

      const talentIds = [...new Set(bookings.map((b) => b.talentId).filter(Boolean))];
      if (talentIds.length) {
        const { data: profiles, error: pErr } = await supabaseAdmin
          .from('profiles')
          .select('id,name')
          .in('id', talentIds);
        if (pErr) throw pErr;
        const byId = new Map((profiles || []).map((p) => [p.id, p]));
        bookings = bookings.map((b) => ({
          ...b,
          type: 'intro',
          talentName: byId.get(b.talentId)?.name || null,
        }));
      }
    } else {
      bookings = await db.listUpcomingIntroBookingsForClientUserId(userId);
    }

    const introBookings = bookings.map((b) => ({ ...b, type: 'intro' }));

    let discoveryBookings = [];
    try {
      const rows = await discoveryStore.listUpcomingDiscoveryBookingsForClientId(client.id);
      discoveryBookings = rows.map((b) => ({
        id: b.id,
        type: 'discovery',
        title: b.title || 'Discovery Call',
        start: b.start,
        end: b.end,
        meetingUrl: b.meetingUrl,
        status: b.status,
      }));
    } catch (discErr) {
      console.warn('[client/dashboard] discovery bookings:', discErr?.message || discErr);
    }

    const mergedBookings = [...discoveryBookings, ...introBookings].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    return res.json({
      ok: true,
      profile: {
        id: client.id,
        email: client.email,
        name: client.name || null,
        company: client.company || null,
      },
      bookings: mergedBookings,
      discoveryBookings,
      introBookings,
    });
  } catch (err) {
    console.error('[client/dashboard/overview]', err?.message || err);
    return res.status(500).json({ error: 'Could not load client dashboard.' });
  }
});

/** Client dashboard: update company name. */
router.post('/dashboard/company', async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    const company = String(req.body?.company || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    let client = null;
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('id, company')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      client = data || null;
    } else {
      client = await db.getClientByUserId(userId);
    }

    if (!client) return res.status(404).json({ error: 'Client not found.' });

    const patch = { company: company || null, updated_at: new Date().toISOString() };

    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('clients')
        .update({ company: patch.company, updated_at: patch.updated_at })
        .eq('id', client.id);
      if (error) throw error;
    } else {
      await db.updateClient(client.id, { company: patch.company, updated_at: patch.updated_at });
    }

    return res.json({ ok: true, company: patch.company });
  } catch (err) {
    console.error('[client/dashboard/company]', err?.message || err);
    return res.status(500).json({ error: 'Could not update company name.' });
  }
});

module.exports = router;

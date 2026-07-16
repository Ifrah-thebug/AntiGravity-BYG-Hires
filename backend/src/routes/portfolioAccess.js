const express = require('express');
const { requireActivatedClient } = require('../middleware/requireActivatedClient');
const { requireTalent } = require('../middleware/requireTalent');
const { supabaseAdmin } = require('../middleware/requireAdmin');
const store = require('../services/portfolioAccessRequestStore');
const introSlots = require('../services/introSlotsService');
const resendEmail = require('../services/resendEmailService');
const portfolioChatNudge = require('../services/portfolioChatNudgeService');

const router = express.Router();

async function notifyTalentPortfolioRequest({ talentId, talentCtx, clientName, company }) {
  let emailSent = false;
  try {
    const talent = await store.getTalentNotificationContact(talentId);
    if (talent.email) {
      await resendEmail.sendTalentPortfolioRequestEmail({
        to: talent.email,
        name: talent.name,
        clientName,
        company,
      });
      emailSent = true;
      console.log(`[portfolio-access] Talent portfolio request email sent to ${talent.email}`);
    } else {
      console.warn('[portfolio-access] No talent email for portfolio request notification');
    }
  } catch (mailErr) {
    console.warn('[portfolio-access/request] talent email:', mailErr?.message || mailErr);
  }

  try {
    if (talentCtx?.userId) {
      const pendingCount = await store.countPendingForTalent(talentId);
      await portfolioChatNudge.notifyTalentPortfolioRequestViaChat({
        talentUserId: talentCtx.userId,
        talentProfileId: talentCtx.talentKey,
        clientName,
        company,
        pendingCount,
      });
    }
  } catch (chatErr) {
    console.warn('[portfolio-access/request] chat nudge:', chatErr?.message || chatErr);
  }

  return { emailSent };
}

async function resolveViewer(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !supabaseAdmin) return { user: null, email: '' };

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return { user: user || null, email: String(user?.email || '').trim().toLowerCase() };
}

/** GET /api/portfolio-access/client-status?talentId=&email= */
router.get('/client-status', async (req, res) => {
  try {
    const talentId = String(req.query.talentId || '').trim();
    const email = String(req.query.email || '').trim();
    if (!talentId || !email) {
      return res.status(400).json({ error: 'talentId and email are required.' });
    }
    const state = await store.getClientAccessState(talentId, email);
    return res.json(state);
  } catch (err) {
    console.error('[portfolio-access/client-status]', err?.message || err);
    return res.status(500).json({ error: 'Could not load portfolio request status.' });
  }
});

/** GET /api/portfolio-access/view/:talentId — owner, approved client, or gate reason */
router.get('/view/:talentId', async (req, res) => {
  try {
    const talentId = String(req.params.talentId || '').trim();
    if (!talentId) return res.status(400).json({ error: 'talentId is required.' });

    const viewer = await resolveViewer(req);
    const ctx = await introSlots.resolveTalentContext(talentId);
    const isOwner = Boolean(viewer.user?.id && ctx?.userId && viewer.user.id === ctx.userId);

    const shareToken = String(req.query.share || req.query.token || '').trim();

    const access = await store.resolveViewAccess({
      talentId,
      viewerUserId: viewer.user?.id || null,
      viewerEmail: viewer.email,
      isTalentOwner: isOwner,
      shareToken,
    });

    return res.json(access);
  } catch (err) {
    console.error('[portfolio-access/view]', err?.message || err);
    return res.status(500).json({ error: 'Could not load portfolio access.' });
  }
});

/** POST /api/portfolio-access/request — activated client */
router.post('/request', requireActivatedClient, async (req, res) => {
  try {
    const talentId = String(req.body?.talentId || '').trim();
    if (!talentId) return res.status(400).json({ error: 'talentId is required.' });

    const client = req.client;
    const talentCtx = await introSlots.resolveTalentContext(talentId);
    const clientEmail = String(client.email || '').trim().toLowerCase();
    const talentEmail = String(talentCtx?.email || '').trim().toLowerCase();

    if (clientEmail && talentEmail && clientEmail === talentEmail) {
      return res.status(403).json({
        error: 'You cannot request your own portfolio.',
        code: 'SELF_REQUEST_NOT_ALLOWED',
      });
    }

    if (talentCtx?.userId && req.authUser?.id === talentCtx.userId) {
      return res.status(403).json({
        error: 'You cannot request your own portfolio.',
        code: 'SELF_REQUEST_NOT_ALLOWED',
      });
    }

    const result = await store.createRequest({
      talentId,
      clientId: client.id,
      clientEmail: client.email,
      clientName: client.name,
      company: client.company,
    });

    // Respond immediately so the browser doesn't time out; notify talent in background.
    if (result.created) {
      const notifyPayload = {
        talentId,
        talentCtx,
        clientName: result.clientName || client.name,
        company: result.company || client.company,
      };
      setImmediate(() => {
        notifyTalentPortfolioRequest(notifyPayload).catch((err) => {
          console.warn('[portfolio-access/request] background notify:', err?.message || err);
        });
      });
    }

    return res.json({
      ok: true,
      created: result.created,
      duplicate: result.duplicate,
      alreadyApproved: Boolean(result.alreadyApproved),
      requestedAt: result.requestedAt,
      emailSent: null,
    });
  } catch (err) {
    if (err.code === 'TALENT_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    console.error('[portfolio-access/request]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not send portfolio request.' });
  }
});

/** GET /api/portfolio-access/talent/sharing */
router.get('/talent/sharing', requireTalent, async (req, res) => {
  try {
    const talentId = req.talentProfile?.id || req.talentProfile?.talent_id;
    const settings = await store.getTalentSharingSettings(talentId);
    return res.json({
      portfolioPublicEnabled: settings.portfolioPublicEnabled,
      shareToken: settings.shareToken,
      directoryStatus: settings.directoryStatus,
    });
  } catch (err) {
    if (err.code === 'TALENT_NOT_FOUND') return res.status(404).json({ error: err.message });
    console.error('[portfolio-access/talent/sharing GET]', err?.message || err);
    return res.status(500).json({ error: 'Could not load portfolio sharing settings.' });
  }
});

/** PATCH /api/portfolio-access/talent/sharing */
router.patch('/talent/sharing', requireTalent, async (req, res) => {
  try {
    const talentId = req.talentProfile?.id || req.talentProfile?.talent_id;
    const settings = await store.updateTalentSharingSettings(talentId, {
      portfolioPublicEnabled: req.body?.portfolioPublicEnabled,
    });
    return res.json({
      portfolioPublicEnabled: settings.portfolioPublicEnabled,
      shareToken: settings.shareToken,
      directoryStatus: settings.directoryStatus,
    });
  } catch (err) {
    if (err.code === 'TALENT_NOT_FOUND') return res.status(404).json({ error: err.message });
    console.error('[portfolio-access/talent/sharing PATCH]', err?.message || err);
    return res.status(500).json({ error: 'Could not update portfolio sharing settings.' });
  }
});

/** POST /api/portfolio-access/talent/sharing/rotate-token */
router.post('/talent/sharing/rotate-token', requireTalent, async (req, res) => {
  try {
    const talentId = req.talentProfile?.id || req.talentProfile?.talent_id;
    const settings = await store.rotateTalentShareToken(talentId);
    return res.json({
      portfolioPublicEnabled: settings.portfolioPublicEnabled,
      shareToken: settings.shareToken,
      directoryStatus: settings.directoryStatus,
    });
  } catch (err) {
    if (err.code === 'TALENT_NOT_FOUND') return res.status(404).json({ error: err.message });
    console.error('[portfolio-access/talent/sharing/rotate]', err?.message || err);
    return res.status(500).json({ error: 'Could not rotate share link.' });
  }
});

/** GET /api/portfolio-access/talent/requests */
router.get('/talent/requests', requireTalent, async (req, res) => {
  try {
    const talentId = req.talentProfile?.id || req.talentProfile?.talent_id;
    const status = String(req.query.status || '').trim() || null;
    const rows = await store.listRequestsForTalent(talentId, { status });
    const pendingCount = rows.filter((r) => r.status === 'pending').length;
    return res.json({ requests: rows, pendingCount });
  } catch (err) {
    console.error('[portfolio-access/talent/requests]', err?.message || err);
    return res.status(500).json({ error: 'Could not load portfolio requests.' });
  }
});

/** POST /api/portfolio-access/talent/requests/:id/approve */
router.post('/talent/requests/:id/approve', requireTalent, async (req, res) => {
  try {
    const talentId = req.talentProfile?.id || req.talentProfile?.talent_id;
    const requestId = String(req.params.id || '').trim();
    const updated = await store.respondToRequest({ talentId, requestId, decision: 'approve' });

    // Notify client in background so approval feels instant.
    setImmediate(() => {
      (async () => {
        try {
          const talentName = String(req.talentProfile?.name || '').trim();
          const clientEmail = String(updated.client_email || '').trim();
          if (!clientEmail) return;
          await resendEmail.sendClientPortfolioApprovedEmail({
            to: clientEmail,
            name: updated.client_name,
            talentName,
            talentId,
          });
          console.log(`[portfolio-access] Client approval email sent to ${clientEmail}`);
        } catch (mailErr) {
          console.warn('[portfolio-access/approve] client email:', mailErr?.message || mailErr);
        }
      })().catch(() => {});
    });

    return res.json({ ok: true, request: updated });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'ALREADY_HANDLED') return res.status(409).json({ error: err.message });
    console.error('[portfolio-access/approve]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not approve request.' });
  }
});

/** POST /api/portfolio-access/talent/requests/:id/decline */
router.post('/talent/requests/:id/decline', requireTalent, async (req, res) => {
  try {
    const talentId = req.talentProfile?.id || req.talentProfile?.talent_id;
    const requestId = String(req.params.id || '').trim();
    const updated = await store.respondToRequest({ talentId, requestId, decision: 'decline' });
    return res.json({ ok: true, request: updated });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'ALREADY_HANDLED') return res.status(409).json({ error: err.message });
    console.error('[portfolio-access/decline]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not decline request.' });
  }
});

module.exports = router;

const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const store = require('../services/ambassadorStore');
const ambassadorService = require('../services/ambassadorService');

const router = express.Router();

router.use(requireAdmin);

router.get('/', async (_req, res) => {
  try {
    const ambassadors = await store.listAmbassadors(100);
    return res.json({ ambassadors });
  } catch (err) {
    console.error('[admin/ambassadors]', err?.message || err);
    return res.status(500).json({ error: 'Could not list ambassadors.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const ambassador = await store.createAmbassador({
      code: req.body?.code,
      name: req.body?.name,
      email: req.body?.email,
      kind: req.body?.kind,
      promoTitle: req.body?.promoTitle,
      promoDescription: req.body?.promoDescription,
      promoReward: req.body?.promoReward,
      notes: req.body?.notes,
    });
    return res.status(201).json({ ambassador });
  } catch (err) {
    const status = err.code === 'INVALID_CODE' || err.code === 'CODE_TAKEN' ? 400 : 500;
    console.error('[admin/ambassadors create]', err?.message || err);
    return res.status(status).json({ error: err.message || 'Could not create ambassador.', code: err.code });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const ambassador = await store.updateAmbassador(req.params.id, {
      name: req.body?.name,
      email: req.body?.email,
      kind: req.body?.kind,
      promoTitle: req.body?.promoTitle,
      promoDescription: req.body?.promoDescription,
      promoReward: req.body?.promoReward,
      notes: req.body?.notes,
      active: req.body?.active,
    });

    if (ambassador.userId && req.body?.name) {
      try {
        const { supabaseAdmin } = require('../middleware/requireAdmin');
        await supabaseAdmin.auth.admin.updateUserById(ambassador.userId, {
          user_metadata: { role: 'ambassador', full_name: ambassador.name },
        });
      } catch (metaErr) {
        console.warn('[admin/ambassadors] name metadata sync:', metaErr?.message || metaErr);
      }
    }

    return res.json({ ambassador });
  } catch (err) {
    const status =
      err.code === 'INVALID_NAME' || err.code === 'INVALID_ID' || err.code === 'KIND_COLUMN_MISSING'
        ? 400
        : err.code === 'NOT_FOUND'
          ? 404
          : 500;
    console.error('[admin/ambassadors patch]', err?.message || err);
    return res.status(status).json({ error: err.message || 'Could not update ambassador.', code: err.code });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await store.deleteAmbassador(req.params.id);
    return res.json(result);
  } catch (err) {
    const status =
      err.code === 'INVALID_ID' ? 400 : err.code === 'NOT_FOUND' ? 404 : 500;
    console.error('[admin/ambassadors delete]', err?.message || err);
    return res.status(status).json({
      error: err.message || 'Could not delete ambassador.',
      code: err.code,
    });
  }
});

/** Approved talent attributed to an ambassador — for hire picker. */
router.get('/hireable-talent', async (_req, res) => {
  try {
    const talent = await ambassadorService.listHireableTalentForAdmin();
    return res.json({ talent });
  } catch (err) {
    console.error('[admin/ambassadors/hireable-talent]', err?.message || err);
    return res.status(500).json({ error: 'Could not list hireable talent.' });
  }
});

/** List recent hire rewards attributed to ambassadors. */
router.get('/hires', async (_req, res) => {
  try {
    const hires = await ambassadorService.listHiresForAdmin(50);
    return res.json({ hires });
  } catch (err) {
    console.error('[admin/ambassadors/hires]', err?.message || err);
    return res.status(500).json({ error: 'Could not list hires.' });
  }
});

/**
 * Admin marks talent as successfully hired.
 * Creates a pending ambassador reward from the decaying schedule (if attributed).
 */
router.post('/hires', async (req, res) => {
  try {
    const result = await ambassadorService.recordHireByAdmin({
      talentEmail: req.body?.talentEmail,
      clientName: req.body?.clientName,
      notes: req.body?.notes,
    });
    return res.status(201).json(result);
  } catch (err) {
    const status =
      err.code === 'INVALID_EMAIL' ||
      err.code === 'TALENT_NOT_FOUND' ||
      err.code === 'NO_AMBASSADOR' ||
      err.code === 'AMBASSADOR_INACTIVE'
        ? 400
        : 500;
    console.error('[admin/ambassadors/hires create]', err?.message || err);
    return res.status(status).json({
      error: err.message || 'Could not record hire.',
      code: err.code,
    });
  }
});

module.exports = router;

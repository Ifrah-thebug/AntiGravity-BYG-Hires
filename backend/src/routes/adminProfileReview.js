const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const review = require('../services/profileReviewService');

const router = express.Router();
router.use(requireAdmin);

/** GET /api/admin/profile-review/queue?status=pending_review */
router.get('/queue', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending_review').trim();
    const rows = await review.listReviewQueue({ status });
    return res.json({ profiles: rows });
  } catch (err) {
    console.error('[admin/profile-review/queue]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not load review queue.' });
  }
});

/** GET /api/admin/profile-review/:profileKey */
router.get('/:profileKey', async (req, res) => {
  try {
    const profile = await review.getProfileByKey(req.params.profileKey);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    return res.json({ profile });
  } catch (err) {
    console.error('[admin/profile-review/get]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not load profile.' });
  }
});

/** POST /api/admin/profile-review/:profileKey/approve */
router.post('/:profileKey/approve', async (req, res) => {
  try {
    const result = await review.approveProfile({
      profileKey: req.params.profileKey,
      adminUserId: req.adminUser?.id,
    });
    return res.json({ ok: true, profile: result.profile, email: result.email });
  } catch (err) {
    console.error('[admin/profile-review/approve]', err?.message || err);
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ error: err.message || 'Could not approve profile.' });
  }
});

/** POST /api/admin/profile-review/:profileKey/request-changes */
router.post('/:profileKey/request-changes', async (req, res) => {
  try {
    const result = await review.requestProfileChanges({
      profileKey: req.params.profileKey,
      adminUserId: req.adminUser?.id,
      issues: req.body?.issues,
      notes: req.body?.notes,
    });
    return res.json({ ok: true, profile: result.profile, email: result.email });
  } catch (err) {
    console.error('[admin/profile-review/request-changes]', err?.message || err);
    const status =
      err.code === 'NOT_FOUND' ? 404 : err.code === 'NOTES_REQUIRED' ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Could not request changes.' });
  }
});

module.exports = router;

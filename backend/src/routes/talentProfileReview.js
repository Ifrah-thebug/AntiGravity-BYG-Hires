const express = require('express');
const { requireTalent } = require('../middleware/requireTalent');
const review = require('../services/profileReviewService');

const router = express.Router();

/** POST /api/talent/profile/submit-review */
router.post('/submit-review', requireTalent, async (req, res) => {
  try {
    const profile = await review.submitProfileForReview(req.authUser.id);
    return res.json({ ok: true, profile });
  } catch (err) {
    console.error('[talent/profile/submit-review]', err?.message || err);
    const status =
      err.code === 'PROFILE_MISSING' || err.code === 'PROFILE_INCOMPLETE' || err.code === 'PHOTO_REQUIRED'
        ? 400
        : err.code === 'INVALID_STATUS'
          ? 409
          : 500;
    return res.status(status).json({ error: err.message || 'Could not submit profile for review.' });
  }
});

module.exports = router;

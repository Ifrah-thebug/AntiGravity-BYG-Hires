const express = require('express');
const { fetchRemotiveJobs } = require('../services/remotiveJobsService');

const router = express.Router();

/** Public: live remote jobs for homepage hero ticker */
router.get('/live', async (req, res) => {
  try {
    const category = String(req.query.category || '').trim();
    const limit = req.query.limit;
    const result = await fetchRemotiveJobs({ category, limit });
    return res.json(result);
  } catch (err) {
    console.error('[jobs/live]', err?.message || err);
    return res.status(502).json({
      error: 'Could not load live jobs right now.',
      source: 'remotive',
      jobs: [],
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const emailService = require('../services/emailService');

// POST /api/assessment/submit
router.post('/submit', async (req, res) => {
  try {
    const { talentId, assessmentData } = req.body;
    if (!talentId || !assessmentData) {
      return res.status(400).json({ error: 'Missing talentId or assessmentData' });
    }
    // Store assessment in DB
    const assessmentRecord = await dbService.createAssessment(talentId, assessmentData);
    // Send notification email to talent
    await emailService.sendAssessmentReceived(talentId, assessmentRecord.id);
    res.status(201).json({ message: 'Assessment submitted', assessmentId: assessmentRecord.id });
  } catch (err) {
    console.error('Assessment submission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// src/routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../services/dbService');
const email = require('../services/emailService');

// Middleware to simulate admin auth (replace with real auth as needed)
router.use((req, res, next) => {
  // In production, verify admin JWT or session
  next();
});

// Get list of pending assessments
router.get('/pending', async (req, res) => {
  try {
    const { data, error } = await db.getPendingAssessments();
    if (error) throw error;
    res.json({ pending: data });
  } catch (err) {
    console.error('Admin pending error', err);
    res.status(500).json({ error: 'Failed to fetch pending assessments' });
  }
});

// Approve or reject an assessment
router.post('/decision', async (req, res) => {
  const { assessmentId, decision, notes } = req.body; // decision: 'approved' | 'rejected'
  if (!assessmentId || !decision) {
    return res.status(400).json({ error: 'assessmentId and decision required' });
  }
  try {
    const { error: updErr } = await db.updateAssessmentDecision(assessmentId, decision, notes);
    if (updErr) throw updErr;
    // Notify talent via email
    const talent = await db.getTalentByAssessmentId(assessmentId);
    await email.sendDecisionEmail(talent.email, decision, notes);
    res.json({ success: true });
  } catch (err) {
    console.error('Admin decision error', err);
    res.status(500).json({ error: 'Failed to record decision' });
  }
});

module.exports = router;

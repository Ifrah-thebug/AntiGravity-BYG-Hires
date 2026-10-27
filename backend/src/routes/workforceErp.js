/**
 * Read-oriented ERP pull API.
 * Auth: Authorization: Bearer <WORKFORCE_ERP_API_KEY>
 */
const crypto = require('crypto');
const express = require('express');
const workforce = require('../services/workforceService');

const router = express.Router();

function requireErpKey(req, res, next) {
  if (!workforce.isEnabled()) {
    return res.status(503).json({ error: 'Workforce disabled', code: 'WORKFORCE_DISABLED' });
  }
  const expected = process.env.WORKFORCE_ERP_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: 'ERP API key not configured', code: 'ERP_UNCONFIGURED' });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Invalid API key', code: 'UNAUTHORIZED' });
  }
  return next();
}

router.use(requireErpKey);

router.get('/engagements', async (req, res) => {
  try {
    res.json({ data: await workforce.listEngagements({ status: req.query.status }) });
  } catch (err) {
    res.status(400).json({ error: err.message, code: err.code });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    res.json({ data: await workforce.listInvoices({ status: req.query.status }) });
  } catch (err) {
    res.status(400).json({ error: err.message, code: err.code });
  }
});

router.get('/snapshot', async (_req, res) => {
  try {
    const snap = await workforce.snapshot();
    res.json({
      data: {
        engagements: snap.engagements,
        invoices: snap.invoices,
        payouts: snap.payouts,
        ledger: snap.ledger,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message, code: err.code });
  }
});

module.exports = router;

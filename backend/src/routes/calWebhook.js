const express = require('express');
const discoveryBooking = require('../services/discoveryBookingService');

const router = express.Router();

/**
 * Cal.com → Settings → Developer → Webhooks
 * - Triggers: Booking Created, Booking Cancelled, Booking Rescheduled
 * - Event type: discovery-call (or scope to that event only)
 * - Subscriber URL: {BACKEND_PUBLIC_URL}/api/cal/webhook
 * - Secret: set CAL_WEBHOOK_SECRET in .env to match
 */
router.post('/', async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
    const signature = req.get('x-cal-signature-256');
    const result = await discoveryBooking.processCalWebhookBody(rawBody, signature);
    return res.status(200).json(result);
  } catch (err) {
    const code = err.code || 'WEBHOOK_FAILED';
    if (code === 'INVALID_SIGNATURE') {
      return res.status(401).json({ error: err.message, code });
    }
    if (code === 'INVALID_JSON') {
      return res.status(400).json({ error: err.message, code });
    }
    console.error('[cal/webhook]', err?.message || err);
    return res.status(500).json({ error: 'Webhook processing failed.', code });
  }
});

module.exports = router;

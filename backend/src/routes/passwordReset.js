const express = require('express');
const rateLimit = require('express-rate-limit');
const passwordReset = require('../services/passwordResetService');

const router = express.Router();

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

router.use(resetLimiter);

router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const result = await passwordReset.requestPasswordReset(email);
    return res.json(result);
  } catch (err) {
    console.error('[auth/forgot-password]', err?.message || err);
    return res.status(500).json({ error: 'Could not process password reset request.' });
  }
});

router.get('/reset-password/verify', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const result = await passwordReset.verifyResetToken(token);
    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        code: result.code,
        error: result.message,
        email: result.email || undefined,
      });
    }
    return res.json({ ok: true, email: result.email });
  } catch (err) {
    console.error('[auth/reset-password/verify]', err?.message || err);
    return res.status(500).json({ error: 'Could not verify reset link.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');

    if (!token) {
      return res.status(400).json({ error: 'Reset token is required.', code: 'INVALID_TOKEN' });
    }

    const result = await passwordReset.completePasswordReset({ token, password });
    return res.json(result);
  } catch (err) {
    const code = err.code || 'RESET_FAILED';
    const status =
      code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED' || code === 'WEAK_PASSWORD'
        ? 400
        : 500;
    console.error('[auth/reset-password]', err?.message || err);
    return res.status(status).json({
      error: err.message || 'Could not reset password.',
      code,
    });
  }
});

module.exports = router;

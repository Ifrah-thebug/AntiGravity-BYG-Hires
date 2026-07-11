const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireTalentChat } = require('../middleware/requireTalentChat');
const chat = require('../services/talentChatService');

const router = express.Router();

function getBackendBaseUrl(req) {
  return (process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chat messages. Please try again later.' },
});

router.use(requireTalentChat);
router.use(chatLimiter);

/** GET /api/talent/chat/session?path=/portal */
router.get('/session', async (req, res) => {
  try {
    const payload = await chat.loadChatSession({
      user: req.authUser,
      currentPath: String(req.query.path || '').trim(),
      backendBaseUrl: getBackendBaseUrl(req),
    });
    return res.json(payload);
  } catch (err) {
    console.error('[talent/chat/session]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not load chat.' });
  }
});

/** POST /api/talent/chat/message */
router.post('/message', async (req, res) => {
  try {
    const payload = await chat.sendChatMessage({
      user: req.authUser,
      message: req.body?.message,
      currentPath: String(req.body?.path || '').trim(),
      backendBaseUrl: getBackendBaseUrl(req),
    });
    return res.json(payload);
  } catch (err) {
    if (err.code === 'MESSAGE_REQUIRED') {
      return res.status(400).json({ error: err.message });
    }
    console.error('[talent/chat/message]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not send message.' });
  }
});

module.exports = router;

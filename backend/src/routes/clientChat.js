const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireClientChat } = require('../middleware/requireClientChat');
const chat = require('../services/clientChatService');

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chat messages. Please try again later.' },
});

router.use(requireClientChat);
router.use(chatLimiter);

/** GET /api/client/chat/session */
router.get('/session', async (req, res) => {
  try {
    const payload = await chat.loadChatSession({
      user: req.authUser,
      client: req.clientRecord,
    });
    return res.json(payload);
  } catch (err) {
    console.error('[client/chat/session]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not load chat.' });
  }
});

/** POST /api/client/chat/message */
router.post('/message', async (req, res) => {
  try {
    const payload = await chat.sendChatMessage({
      user: req.authUser,
      client: req.clientRecord,
      message: req.body?.message,
    });
    return res.json(payload);
  } catch (err) {
    if (err.code === 'MESSAGE_REQUIRED') {
      return res.status(400).json({ error: err.message });
    }
    console.error('[client/chat/message]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Could not send message.' });
  }
});

module.exports = router;

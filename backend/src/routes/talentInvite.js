const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const talentActivation = require('../services/talentActivationService');

const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router = express.Router();

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

router.use(activateLimiter);

router.get('/activate/verify', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const result = await talentActivation.verifyActivationToken(token);
    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        code: result.code,
        error: result.message,
        email: result.email || undefined,
        name: result.name || undefined,
      });
    }
    return res.json({ ok: true, ...result.invite });
  } catch (err) {
    console.error('[talent-invite/activate/verify]', err?.message || err);
    return res.status(500).json({ error: 'Could not verify activation link.' });
  }
});

router.post('/activate/set-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');

    if (!token) {
      return res.status(400).json({ error: 'Activation token is required.' });
    }

    const result = await talentActivation.completeTalentActivation({ token, password });
    return res.json({
      ok: true,
      email: result.email,
      name: result.name,
      cvUrl: result.cvUrl,
      inviteSetup: true,
    });
  } catch (err) {
    const code = err.code || 'ACTIVATION_FAILED';
    const status =
      code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED' || code === 'ALREADY_ACTIVE'
        ? 400
        : 500;
    console.error('[talent-invite/activate/set-password]', err?.message || err);
    return res.status(status).json({
      error: err.message || 'Activation failed.',
      code,
    });
  }
});

async function requireAuthUser(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Server database is not configured.' });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Authorization required.' });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid or expired session.' });
  req.authUser = user;
  return next();
}

router.get('/setup/status', requireAuthUser, async (req, res) => {
  try {
    const status = await talentActivation.getSetupStatusForUser(req.authUser.id);
    return res.json(status);
  } catch (err) {
    console.error('[talent-invite/setup/status]', err?.message || err);
    return res.status(500).json({ error: 'Could not load setup status.' });
  }
});

function cvParseErrorStatus(result) {
  if (result.status) return result.status;
  return result.retryable === false ? 422 : 503;
}

router.post('/setup/parse-cv', requireAuthUser, async (req, res) => {
  try {
    const result = await talentActivation.parseInviteCvForUser(req.authUser.id);
    if (!result.ok) {
      return res.status(cvParseErrorStatus(result)).json({
        error: result.error || 'Parse failed.',
        retryable: result.retryable !== false,
        code: result.code,
      });
    }
    return res.json(result);
  } catch (err) {
    console.error('[talent-invite/setup/parse-cv]', err?.message || err);
    return res.status(500).json({ error: 'Could not parse CV.', retryable: true });
  }
});

router.post('/setup/reupload-cv', requireAuthUser, cvUpload.single('cv'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'CV file is required.', retryable: false });
    }

    const result = await talentActivation.reuploadInviteCvForUser(
      req.authUser.id,
      req.file.buffer,
      req.file.mimetype || 'application/pdf',
      req.file.originalname
    );

    if (!result.ok) {
      return res.status(cvParseErrorStatus(result)).json({
        error: result.error || 'Parse failed.',
        retryable: result.retryable !== false,
        code: result.code,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('[talent-invite/setup/reupload-cv]', err?.message || err);
    return res.status(500).json({ error: 'Could not re-upload CV.', retryable: true });
  }
});

module.exports = router;

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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain HTML bridge for Gmail in-app browsers → opens React activation in a real tab. */
router.get('/activate/open', (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    res.status(400).type('html').send('<!DOCTYPE html><html><body><p>Invalid activation link.</p></body></html>');
    return;
  }

  const appBase = (
    process.env.CLIENT_URI ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173'
  ).replace(/\/$/, '');
  const appUrl = `${appBase}/talent/activate?token=${encodeURIComponent(token)}`;
  const safeAppUrl = escapeHtml(appUrl);

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Activate your BYG Hires account</title>
</head>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 480px; margin: 0 auto; padding: 32px 20px; text-align: center;">
  <p style="font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #ff3d3d; margin: 0 0 20px;">BYG Hires</p>
  <h1 style="font-size: 1.5rem; margin: 0 0 12px;">Activate your talent account</h1>
  <p style="color: #555; font-size: 15px; margin: 0 0 28px;">Tap below to open activation in your browser and set your password.</p>
  <p style="margin: 0 0 24px;">
    <a href="${safeAppUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Continue to activation</a>
  </p>
  <p style="font-size: 12px; color: #888; margin: 0;">If nothing happens, copy this link into Chrome or Safari:<br /><span style="word-break: break-all; color: #444;">${safeAppUrl}</span></p>
</body>
</html>`);
});

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

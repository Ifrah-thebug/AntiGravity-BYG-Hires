const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/requireAdmin');
const store = require('../services/talentInviteStore');
const { extractEmailFromCv } = require('../services/cvEmailExtract');
const { uploadCvToStorage, sendInviteEmail } = require('../services/talentActivationService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 50 },
});

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/x-pdf',
  'text/plain',
]);

function extFromFilename(name) {
  const m = String(name || '').match(/\.([^.]+)$/);
  return (m?.[1] || 'pdf').toLowerCase();
}

router.use(requireAdmin);

/** POST /api/admin/talent-import/upload — multi-file CV upload */
router.post('/upload', upload.array('cvs', 50), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No CV files uploaded.' });
    }

    const batch = await store.createBatch({
      invitedBy: req.adminUser.id,
      label: req.body?.label || `Import ${new Date().toISOString().slice(0, 10)}`,
    });

    const results = [];

    for (const file of files) {
      const mime = file.mimetype || 'application/pdf';
      const ext = extFromFilename(file.originalname);

      if (!ALLOWED_MIME.has(mime) && ext !== 'pdf' && ext !== 'txt') {
        results.push({
          filename: file.originalname,
          ok: false,
          error: 'Only PDF files are supported in this version.',
        });
        continue;
      }

      const inviteId = uuidv4();
      const storagePath = `invites/${inviteId}/cv.${ext}`;

      try {
        await uploadCvToStorage(storagePath, file.buffer, mime);

        const extracted = await extractEmailFromCv(file.buffer, mime, file.originalname);
        const email = extracted.email;
        const name = extracted.name || null;

        let status = email ? 'ready' : 'uploaded';
        let skipReason = null;

        if (email) {
          const existingProfile = await store.findProfileByEmail(email);
          if (existingProfile) {
            status = 'skipped';
            skipReason = 'already_registered';
          }
        }

        const invite = await store.insertInvite({
          id: inviteId,
          batch_id: batch.id,
          email: email || null,
          name,
          original_filename: file.originalname,
          cv_storage_path: storagePath,
          cv_mime_type: mime,
          email_extract_status: extracted.emailExtractStatus,
          invited_by: req.adminUser.id,
          status,
        });

        results.push({
          ok: true,
          invite,
          skipReason,
        });
      } catch (err) {
        results.push({
          filename: file.originalname,
          ok: false,
          error: err?.message || 'Upload failed',
        });
      }
    }

    return res.status(201).json({
      batchId: batch.id,
      results,
    });
  } catch (err) {
    console.error('[admin/talent-import/upload]', err?.message || err);
    return res.status(500).json({ error: 'Bulk upload failed.' });
  }
});

/** GET /api/admin/talent-import/batches — recent imports with funnel stats */
router.get('/batches', async (req, res) => {
  try {
    const batches = await store.listRecentBatches(25);
    return res.json({ batches });
  } catch (err) {
    console.error('[admin/talent-import/batches list]', err?.message || err);
    return res.status(500).json({ error: 'Could not load import history.' });
  }
});

/** GET /api/admin/talent-import/batches/:batchId */
router.get('/batches/:batchId', async (req, res) => {
  try {
    const invites = await store.listInvitesByBatch(req.params.batchId);
    return res.json({ invites });
  } catch (err) {
    console.error('[admin/talent-import/batches]', err?.message || err);
    return res.status(500).json({ error: 'Could not load batch.' });
  }
});

/** PATCH /api/admin/talent-import/invites/:id */
router.patch('/invites/:id', async (req, res) => {
  try {
    const { email, name } = req.body || {};
    const patch = {};

    if (email !== undefined) {
      const normalized = String(email || '').trim().toLowerCase();
      if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return res.status(400).json({ error: 'Invalid email address.' });
      }
      patch.email = normalized || null;
      patch.email_extract_status = normalized ? 'manual' : 'missing';
      patch.status = normalized ? 'ready' : 'uploaded';
    }

    if (name !== undefined) {
      patch.name = String(name || '').trim() || null;
    }

    const invite = await store.updateInvite(req.params.id, patch);
    return res.json({ invite });
  } catch (err) {
    console.error('[admin/talent-import/invites PATCH]', err?.message || err);
    return res.status(500).json({ error: 'Could not update invite.' });
  }
});

const SENDABLE_STATUSES = new Set(['ready', 'uploaded', 'invited']);

function inviteSendBlockMessage(invite, result) {
  if (invite.status === 'activated') {
    return 'This talent has already activated. They should log in instead.';
  }
  if (invite.status === 'skipped' || result?.reason === 'already_registered') {
    return 'This email already has a talent profile. They should log in instead.';
  }
  if (result?.reason === 'no_email') {
    return 'Add an email address before sending.';
  }
  return result?.error || 'Could not send invite.';
}

/** POST /api/admin/talent-import/batches/:batchId/send-invites */
router.post('/batches/:batchId/send-invites', async (req, res) => {
  try {
    const invites = await store.listInvitesByBatch(req.params.batchId);
    const toSend = invites.filter(
      (inv) => inv.email && SENDABLE_STATUSES.has(inv.status)
    );

    const outcomes = [];
    for (const invite of toSend) {
      try {
        const result = await sendInviteEmail(invite);
        outcomes.push({
          inviteId: invite.id,
          resent: invite.status === 'invited',
          ...result,
        });
      } catch (err) {
        outcomes.push({
          inviteId: invite.id,
          sent: false,
          reason: 'send_failed',
          error: err?.message,
        });
      }
    }

    return res.json({ outcomes, eligible: toSend.length });
  } catch (err) {
    console.error('[admin/talent-import/send-invites]', err?.message || err);
    return res.status(500).json({ error: 'Could not send invites.' });
  }
});

/** POST /api/admin/talent-import/invites/:id/send — resend single invite */
router.post('/invites/:id/send', async (req, res) => {
  try {
    const invite = await store.getInviteById(req.params.id);
    if (!invite) return res.status(404).json({ error: 'Invite not found.' });
    if (!invite.email) return res.status(400).json({ error: 'Email is required before sending.' });
    if (invite.status === 'activated') {
      return res.status(400).json({ error: inviteSendBlockMessage(invite) });
    }
    if (invite.status === 'skipped') {
      return res.status(400).json({ error: inviteSendBlockMessage(invite) });
    }

    const result = await sendInviteEmail(invite);
    if (!result.sent) {
      return res.status(400).json({
        error: inviteSendBlockMessage(invite, result),
        ...result,
      });
    }

    return res.json({
      ...result,
      resent: invite.status === 'invited',
    });
  } catch (err) {
    console.error('[admin/talent-import/invites/send]', err?.message || err);
    return res.status(500).json({ error: 'Could not send invite.' });
  }
});

module.exports = router;

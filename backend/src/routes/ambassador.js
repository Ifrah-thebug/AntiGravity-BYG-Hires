const express = require('express');
const multer = require('multer');
const { requireUser } = require('../middleware/requireUser');
const ambassadorService = require('../services/ambassadorService');
const store = require('../services/ambassadorStore');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 20 },
});

router.post('/verify-code', async (req, res) => {
  try {
    const result = await ambassadorService.verifyCode(req.body?.code);
    if (!result.ok) {
      return res.status(404).json({ error: result.message, code: result.code });
    }
    return res.json({ ambassador: result.ambassador });
  } catch (err) {
    console.error('[ambassador/verify-code]', err?.message || err);
    return res.status(500).json({ error: 'Could not verify code.' });
  }
});

router.post('/claim', async (req, res) => {
  try {
    const result = await ambassadorService.claimWithPassword({
      code: req.body?.code,
      name: req.body?.name,
      email: req.body?.email,
      password: req.body?.password,
    });
    return res.json(result);
  } catch (err) {
    const status =
      err.code === 'INVALID_CODE' || err.code === 'ALREADY_CLAIMED'
        ? 409
        : err.code === 'WEAK_PASSWORD' || err.code === 'INVALID_EMAIL'
          ? 400
          : err.code === 'EMAIL_IN_USE' || err.code === 'EMAIL_TALENT'
            ? 409
            : 500;
    console.error('[ambassador/claim]', err?.message || err);
    return res.status(status).json({ error: err.message || 'Could not claim code.', code: err.code });
  }
});

router.get('/me', requireUser, async (req, res) => {
  try {
    const dashboard = await ambassadorService.getDashboardForUser(req.user.id);
    return res.json(dashboard);
  } catch (err) {
    const status = err.code === 'NOT_AMBASSADOR' ? 403 : 500;
    return res.status(status).json({ error: err.message || 'Not an ambassador.', code: err.code });
  }
});

router.patch('/me', requireUser, async (req, res) => {
  try {
    const result = await ambassadorService.updateProfileForUser(req.user.id, {
      name: req.body?.name,
    });
    return res.json(result);
  } catch (err) {
    const status =
      err.code === 'NOT_AMBASSADOR' ? 403 : err.code === 'INVALID_NAME' ? 400 : 500;
    console.error('[ambassador/me patch]', err?.message || err);
    return res.status(status).json({ error: err.message || 'Could not update profile.', code: err.code });
  }
});

router.post('/invite', requireUser, async (req, res) => {
  try {
    const result = await ambassadorService.inviteTalent({
      userId: req.user.id,
      email: req.body?.email,
      name: req.body?.name,
    });
    return res.json(result);
  } catch (err) {
    const status =
      err.code === 'NOT_AMBASSADOR'
        ? 403
        : err.code === 'INVALID_EMAIL' || err.code === 'ALREADY_REGISTERED'
          ? 400
          : 500;
    console.error('[ambassador/invite]', err?.message || err);
    return res.status(status).json({ error: err.message || 'Could not send invite.', code: err.code });
  }
});

router.post('/upload-cvs', requireUser, upload.array('cvs', 20), async (req, res) => {
  try {
    const result = await ambassadorService.uploadTalentCvs({
      userId: req.user.id,
      files: req.files || [],
      autoSend: req.body?.autoSend !== 'false',
    });
    return res.json(result);
  } catch (err) {
    const status =
      err.code === 'NOT_AMBASSADOR' ? 403 : err.code === 'NO_FILES' ? 400 : 500;
    console.error('[ambassador/upload-cvs]', err?.message || err);
    return res.status(status).json({ error: err.message || 'Upload failed.', code: err.code });
  }
});

router.patch('/invites/:id', requireUser, async (req, res) => {
  try {
    const result = await ambassadorService.updateInviteForUser(req.user.id, {
      inviteId: req.params.id,
      email: req.body?.email,
      name: req.body?.name,
      send: req.body?.send !== false,
    });
    return res.json(result);
  } catch (err) {
    const status =
      err.code === 'NOT_AMBASSADOR'
        ? 403
        : err.code === 'INVITE_NOT_FOUND'
          ? 404
          : err.code === 'INVALID_EMAIL' ||
              err.code === 'NOT_EDITABLE' ||
              err.code === 'ALREADY_REGISTERED' ||
              err.code === 'NO_CHANGES'
            ? 400
            : 500;
    console.error('[ambassador/invites PATCH]', err?.message || err);
    return res.status(status).json({
      error: err.message || 'Could not update invite.',
      code: err.code,
    });
  }
});

/** @deprecated prefer PATCH /invites/:id */
router.patch('/invites/:id/email', requireUser, async (req, res) => {
  try {
    const result = await ambassadorService.updateInviteForUser(req.user.id, {
      inviteId: req.params.id,
      email: req.body?.email,
      name: req.body?.name,
      send: req.body?.send !== false,
    });
    return res.json(result);
  } catch (err) {
    const status =
      err.code === 'NOT_AMBASSADOR'
        ? 403
        : err.code === 'INVITE_NOT_FOUND'
          ? 404
          : err.code === 'INVALID_EMAIL' ||
              err.code === 'NOT_EDITABLE' ||
              err.code === 'ALREADY_REGISTERED' ||
              err.code === 'NO_CHANGES'
            ? 400
            : 500;
    console.error('[ambassador/invites email]', err?.message || err);
    return res.status(status).json({
      error: err.message || 'Could not update invite email.',
      code: err.code,
    });
  }
});

router.get('/is-ambassador', requireUser, async (req, res) => {
  try {
    const ambassador = await store.getByUserId(req.user.id);
    const isAmbassador = Boolean(ambassador?.active && ambassador?.userId);
    return res.json({
      isAmbassador,
      kind: ambassador?.kind || 'circle',
      isInternal: Boolean(isAmbassador && ambassador?.kind === 'internal'),
      code: ambassador?.code || null,
    });
  } catch (err) {
    console.error('[ambassador/is-ambassador]', err?.message || err);
    return res.status(500).json({ error: 'Could not check ambassador status.' });
  }
});

function internalErrorStatus(err) {
  if (err.statusHint) return err.statusHint;
  if (err.code === 'NOT_AMBASSADOR' || err.code === 'NOT_INTERNAL' || err.code === 'NOT_OWNED') return 403;
  if (err.code === 'NOT_FOUND') return 404;
  if (err.code === 'NUDGE_COOLDOWN') return 429;
  if (
    err.code === 'INVALID_STATUS' ||
    err.code === 'NO_EMAIL' ||
    err.code === 'SLOTS_ALREADY_PUBLISHED' ||
    err.code === 'TALENT_CAL_NOT_CONNECTED' ||
    err.code === 'AMBASSADOR_EMAIL_REQUIRED' ||
    err.code === 'SLOT_UNAVAILABLE' ||
    err.code === 'DAY_BOOKED' ||
    err.code === 'HR_OR_TALENT_BUSY' ||
    err.code === 'NOTES_REQUIRED'
  ) {
    return 400;
  }
  if (err.code === 'SLOT_UNAVAILABLE' || err.code === 'DAY_BOOKED') return 409;
  return 500;
}

router.get('/reviews', requireUser, async (req, res) => {
  try {
    const internal = require('../services/ambassadorInternalService');
    const result = await internal.listReviewsForUser(req.user.id, {
      status: req.query?.status,
    });
    return res.json(result);
  } catch (err) {
    console.error('[ambassador/reviews]', err?.message || err);
    return res.status(internalErrorStatus(err)).json({
      error: err.message || 'Could not load reviews.',
      code: err.code,
    });
  }
});

router.post('/reviews/:profileKey/approve', requireUser, async (req, res) => {
  try {
    const internal = require('../services/ambassadorInternalService');
    const result = await internal.approveReviewForUser(req.user.id, req.params.profileKey);
    return res.json(result);
  } catch (err) {
    console.error('[ambassador/reviews approve]', err?.message || err);
    return res.status(internalErrorStatus(err)).json({
      error: err.message || 'Could not approve profile.',
      code: err.code,
    });
  }
});

router.post('/reviews/:profileKey/request-changes', requireUser, async (req, res) => {
  try {
    const internal = require('../services/ambassadorInternalService');
    const result = await internal.requestChangesForUser(req.user.id, req.params.profileKey, {
      issues: req.body?.issues,
      notes: req.body?.notes,
    });
    return res.json(result);
  } catch (err) {
    console.error('[ambassador/reviews changes]', err?.message || err);
    const status = err.code === 'NOTES_REQUIRED' ? 400 : internalErrorStatus(err);
    return res.status(status).json({
      error: err.message || 'Could not request changes.',
      code: err.code,
    });
  }
});

router.post('/reviews/:profileKey/nudge-slots', requireUser, async (req, res) => {
  try {
    const internal = require('../services/ambassadorInternalService');
    const result = await internal.nudgePublishSlotsForUser(req.user.id, req.params.profileKey);
    return res.json(result);
  } catch (err) {
    console.error('[ambassador/reviews nudge]', err?.message || err);
    return res.status(internalErrorStatus(err)).json({
      error: err.message || 'Could not email talent.',
      code: err.code,
    });
  }
});

router.get('/screens', requireUser, async (req, res) => {
  try {
    const internal = require('../services/ambassadorInternalService');
    const result = await internal.listScreensForUser(req.user.id);
    return res.json(result);
  } catch (err) {
    console.error('[ambassador/screens]', err?.message || err);
    return res.status(internalErrorStatus(err)).json({
      error: err.message || 'Could not load screens.',
      code: err.code,
    });
  }
});

router.get('/screens/:talentKey/slots', requireUser, async (req, res) => {
  try {
    const internal = require('../services/ambassadorInternalService');
    const result = await internal.listScreenSlotsForUser(req.user.id, req.params.talentKey);
    return res.json(result);
  } catch (err) {
    console.error('[ambassador/screens slots]', err?.message || err);
    return res.status(internalErrorStatus(err)).json({
      error: err.message || 'Could not load slots.',
      code: err.code,
    });
  }
});

router.post('/screens/:talentKey/book', requireUser, async (req, res) => {
  try {
    const internal = require('../services/ambassadorInternalService');
    const result = await internal.bookScreenForUser(req.user.id, {
      talentKey: req.params.talentKey,
      slotId: req.body?.slotId,
    });
    return res.status(result.alreadyBooked ? 200 : 201).json(result);
  } catch (err) {
    console.error('[ambassador/screens book]', err?.message || err);
    const status =
      err.code === 'SLOT_UNAVAILABLE' || err.code === 'DAY_BOOKED' || err.code === 'HR_OR_TALENT_BUSY'
        ? 409
        : internalErrorStatus(err);
    return res.status(status).json({
      error: err.message || 'Could not book screening.',
      code: err.code,
    });
  }
});

module.exports = router;

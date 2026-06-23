const express = require('express');
const { requireTalent } = require('../middleware/requireTalent');
const { requireActivatedClient } = require('../middleware/requireActivatedClient');
const store = require('../services/skillAssessmentStore');
const voiceInterviewStore = require('../services/voiceInterviewStore');
const voiceInterviewRequestStore = require('../services/voiceInterviewRequestStore');
const introSlots = require('../services/introSlotsService');
const resendEmail = require('../services/resendEmailService');

const router = express.Router();

async function isInterviewUnlocked(talentId) {
  return voiceInterviewRequestStore.hasActiveRequest(talentId);
}

/** GET /api/voice-interview/public-badges?talentIds=id1,id2 */
router.get('/public-badges', async (req, res) => {
  try {
    const raw = String(req.query.talentIds || '').trim();
    const talentIds = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const badges = await voiceInterviewStore.getPublicAiVerifiedByTalentIds(talentIds);
    return res.json({ badges });
  } catch (err) {
    console.error('[voice-interview/public-badges]', err?.message || err);
    return res.status(500).json({ error: 'Could not load AI interview badges.' });
  }
});

/** GET /api/voice-interview/client-status?talentId=...&email=... */
router.get('/client-status', async (req, res) => {
  try {
    const talentId = String(req.query.talentId || '').trim();
    const email = String(req.query.email || '').trim();
    if (!talentId || !email) {
      return res.status(400).json({ error: 'talentId and email are required.' });
    }
    const state = await voiceInterviewRequestStore.getClientRequestState(talentId, email);
    const talentKey = await voiceInterviewRequestStore.resolveTalentKey(talentId);
    const talentContact = talentKey
      ? await voiceInterviewRequestStore.getTalentNotificationEmail(talentId)
      : { email: '' };
    const latest = talentKey
      ? await voiceInterviewStore.getLatestResultForTalent({
          talentId: talentKey,
          email: talentContact.email,
        })
      : null;
    const score = latest?.interview_score ?? null;
    const verified = voiceInterviewStore.isScoreVerified(score);
    return res.json({
      ...state,
      talentAiInterviewVerified: verified,
      hasCompleted: Boolean(latest),
      interviewScore: score,
      completedAt: latest?.completed_at || null,
      aiInterviewVerified: verified,
    });
  } catch (err) {
    console.error('[voice-interview/client-status]', err?.message || err);
    return res.status(500).json({ error: 'Could not load request status.' });
  }
});

/** POST /api/voice-interview/request — activated hiring client only */
router.post('/request', requireActivatedClient, async (req, res) => {
  try {
    const talentId = String(req.body?.talentId || '').trim();
    if (!talentId) {
      return res.status(400).json({ error: 'talentId is required.' });
    }

    const client = req.client;
    const talentContact = await voiceInterviewRequestStore.getTalentNotificationEmail(talentId);
    const talentCtx = await introSlots.resolveTalentContext(talentId);

    const clientEmail = String(client.email || '').trim().toLowerCase();
    const talentEmail = String(talentContact.email || '').trim().toLowerCase();

    if (clientEmail && talentEmail && clientEmail === talentEmail) {
      return res.status(403).json({
        error: 'You cannot request an AI interview for your own talent profile.',
        code: 'SELF_REQUEST_NOT_ALLOWED',
      });
    }

    if (talentCtx?.userId && req.authUser?.id === talentCtx.userId) {
      return res.status(403).json({
        error: 'You cannot request an AI interview for your own talent profile.',
        code: 'SELF_REQUEST_NOT_ALLOWED',
      });
    }

    const result = await voiceInterviewRequestStore.createRequest({
      talentId,
      clientId: client.id,
      clientEmail: client.email,
      clientName: client.name,
      company: client.company,
    });

    let emailSent = false;
    if (result.created) {
      try {
        const talent = await voiceInterviewRequestStore.getTalentNotificationEmail(talentId);
        if (talent.email) {
          await resendEmail.sendTalentAiInterviewRequestEmail({
            to: talent.email,
            name: talent.name,
          });
          emailSent = true;
        }
      } catch (mailErr) {
        console.warn('[voice-interview/request] talent email:', mailErr?.message || mailErr);
      }
    }

    return res.json({
      ok: true,
      created: result.created,
      duplicate: result.duplicate,
      requestedAt: result.requestedAt,
      emailSent,
    });
  } catch (err) {
    const code = err.code || 'REQUEST_FAILED';
    const status =
      code === 'TALENT_NOT_FOUND' || code === 'EMAIL_REQUIRED'
        ? 400
        : 500;
    console.error('[voice-interview/request]', err?.message || err);
    return res.status(status).json({
      error: err.message || 'Could not request AI interview.',
      code,
    });
  }
});

/** GET /api/voice-interview/status — latest score + unlock state for logged-in talent */
router.get('/status', requireTalent, async (req, res) => {
  try {
    const { talent_id: talentId } = req.talentProfile;
    const email = String(req.authUser?.email || '').trim();
    const interviewUnlocked = await isInterviewUnlocked(talentId);
    const status = await voiceInterviewStore.getInterviewStatus({
      email,
      talentId,
      interviewUnlocked,
    });
    return res.json(status);
  } catch (err) {
    console.error('[voice-interview/status]', err?.message || err);
    return res.status(500).json({ error: 'Could not load interview status.' });
  }
});

/** GET /api/voice-interview/context — dynamic VAPI variables */
router.get('/context', requireTalent, async (req, res) => {
  try {
    const { talent_id: talentId } = req.talentProfile;
    const interviewUnlocked = await isInterviewUnlocked(talentId);
    if (!interviewUnlocked) {
      return res.status(403).json({
        error: 'A client must request an AI interview before you can start. Check your email for a notification.',
        code: 'CLIENT_REQUEST_REQUIRED',
      });
    }

    const completedBySkill = await store.getLatestCompletedByTalent(talentId);
    const assessedSkills = Object.values(completedBySkill).map((row) => row.skill);
    const assessedCount = assessedSkills.length;

    if (assessedCount === 0) {
      return res.status(403).json({
        error: 'Complete at least one skills test before starting the AI voice interview.',
        code: 'SKILLS_TEST_REQUIRED',
      });
    }

    const jobTitle = String(req.talentProfile.job_title || '').trim() || 'Professional';

    return res.json({
      roleTitle: jobTitle,
      candidate_name: String(req.talentProfile.name || '').trim(),
      candidate_email: String(req.authUser?.email || '').trim(),
      best_skill: String(req.talentProfile.best_skill || '').trim(),
      assessed_skills: assessedSkills,
      assessed_count: assessedCount,
      talent_id: talentId,
      interviewUnlocked: true,
    });
  } catch (err) {
    console.error('[voice-interview/context]', err?.message || err);
    return res.status(500).json({ error: 'Could not load interview context.' });
  }
});

module.exports = router;

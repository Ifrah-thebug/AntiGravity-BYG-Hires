const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireTalent } = require('../middleware/requireTalent');
const store = require('../services/skillAssessmentStore');
const gemini = require('../services/geminiAssessmentService');

const router = express.Router();

const rateLimitDisabled =
  process.env.DISABLE_ASSESSMENT_RATE_LIMIT === 'true' ||
  process.env.NODE_ENV !== 'production';

if (!rateLimitDisabled) {
  const assessmentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many assessment requests. Please try again later.' },
  });
  router.use(assessmentLimiter);
}

function skillOnProfile(profile, skill) {
  const target = store.normalizeSkill(skill).toLowerCase();
  const skills = (profile.skills || []).map((s) => String(s).trim()).filter(Boolean);
  return skills.find((s) => s.toLowerCase() === target) || null;
}

/** GET /api/assessment/status */
router.get('/status', requireTalent, async (req, res) => {
  try {
    const { talent_id: talentId } = req.talentProfile;
    await store.expireStaleSessions(talentId);

    const [scoresBySkill, active] = await Promise.all([
      store.getLatestCompletedByTalent(talentId),
      store.getActiveSession(talentId),
    ]);

    const skills = (req.talentProfile.skills || []).map((s) => String(s).trim()).filter(Boolean);
    const skillScores = {};
    const completedSessions = {};
    for (const skill of skills) {
      const key = skill.toLowerCase();
      if (scoresBySkill[key]) {
        skillScores[skill] = scoresBySkill[key].total_score;
        completedSessions[skill] = {
          sessionId: scoresBySkill[key].id,
          submittedAt: scoresBySkill[key].submitted_at,
        };
      }
    }

    const assessedCount = Object.keys(skillScores).length;
    const avgScore = assessedCount
      ? Math.round(
          Object.values(skillScores).reduce((a, b) => a + b, 0) / assessedCount
        )
      : null;

    return res.json({
      skills,
      best_skill: req.talentProfile.best_skill,
      skillScores,
      completedSessions,
      assessedCount,
      averageScore: avgScore,
      activeSession: gemini.sanitizeSessionForClient(active),
    });
  } catch (err) {
    console.error('[assessment/status]', err?.message || err);
    return res.status(500).json({ error: 'Could not load assessment status.' });
  }
});

/** POST /api/assessment/start  { skill } */
router.post('/start', requireTalent, async (req, res) => {
  try {
    const skill = store.normalizeSkill(req.body?.skill);
    if (!skill) {
      return res.status(400).json({ error: 'Skill is required.' });
    }

    const canonical = skillOnProfile(req.talentProfile, skill);
    if (!canonical) {
      return res.status(400).json({ error: 'That skill is not on your profile.' });
    }

    const { talent_id: talentId, user_id: userId } = req.talentProfile;
    await store.expireStaleSessions(talentId);
    // Always abandon any live session — retakes and restarts get new questions (no resume).
    await store.abandonActiveSessions(talentId);

    const { questions, questionSource } = await gemini.generateQuestions(req.talentProfile, canonical);
    const session = await store.createSession({
      talentId,
      userId,
      skill: canonical,
      questions,
      durationMinutes: gemini.SESSION_MINUTES,
    });

    return res.status(201).json({
      session: gemini.sanitizeSessionForClient(session),
      resumed: false,
      questionSource: questionSource || 'gemini',
    });
  } catch (err) {
    console.error('[assessment/start]', err?.message || err);
    if (err.code === 'AI_GENERATE_UNAVAILABLE' || err.status === 503) {
      return res.status(503).json({
        error: err.message || 'AI question generator is busy. Please try again shortly.',
        retryable: err.retryable !== false,
        code: err.code || 'AI_GENERATE_UNAVAILABLE',
      });
    }
    return res.status(500).json({ error: 'Could not start assessment.' });
  }
});

/** GET /api/assessment/session/:id */
router.get('/session/:id', requireTalent, async (req, res) => {
  try {
    const session = await store.getSessionById(req.params.id, req.talentProfile.talent_id);
    if (!session) {
      return res.status(404).json({ error: 'Assessment session not found.' });
    }
    return res.json({ session: gemini.sanitizeSessionForClient(session) });
  } catch (err) {
    console.error('[assessment/session]', err?.message || err);
    return res.status(500).json({ error: 'Could not load session.' });
  }
});

/** PATCH /api/assessment/session/:id/draft  { answers } */
router.patch('/session/:id/draft', requireTalent, async (req, res) => {
  try {
    const talentId = req.talentProfile.talent_id;
    const session = await store.getSessionById(req.params.id, talentId);
    if (!session || session.status !== 'in_progress') {
      return res.status(404).json({ error: 'No active assessment session.' });
    }
    if (new Date(session.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Assessment session expired.' });
    }

    const answers = { ...(session.answers || {}), ...(req.body?.answers || {}) };
    const updated = await store.saveDraft(session.id, talentId, answers);
    return res.json({ session: gemini.sanitizeSessionForClient(updated) });
  } catch (err) {
    console.error('[assessment/draft]', err?.message || err);
    return res.status(500).json({ error: 'Could not save draft.' });
  }
});

/** POST /api/assessment/submit  { sessionId } */
router.post('/submit', requireTalent, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const talentId = req.talentProfile.talent_id;
    const session = await store.getSessionById(sessionId, talentId);
    if (!session || session.status !== 'in_progress') {
      return res.status(404).json({ error: 'No active assessment session.' });
    }

    const answers = { ...(session.answers || {}), ...(req.body?.answers || {}) };
    const questions = session.questions || [];

    const missing = questions.filter((q) => !String(answers[q.id] || '').trim());
    if (missing.length) {
      return res.status(400).json({
        error: `Please answer all questions (${missing.length} remaining).`,
      });
    }

    const grade = await gemini.gradeAnswers(
      req.talentProfile,
      session.skill,
      questions,
      answers
    );

    const completed = await store.completeSession(sessionId, talentId, {
      answers,
      scoreBreakdown: {
        per_question: grade.per_question,
        dimensions: grade.dimensions,
      },
      totalScore: grade.total_score,
      feedbackSummary: grade.summary,
    });

    const scoresBySkill = await store.getLatestCompletedByTalent(talentId);
    const skillScores = {};
    for (const [key, row] of Object.entries(scoresBySkill)) {
      skillScores[row.skill] = row.total_score;
    }

    return res.json({
      session: gemini.sanitizeSessionForClient(completed),
      skillScores,
      total_score: grade.total_score,
      summary: grade.summary,
    });
  } catch (err) {
    console.error('[assessment/submit]', err?.message || err);
    if (err.code === 'AI_GRADE_UNAVAILABLE' || err.status === 503) {
      return res.status(503).json({
        error: err.message || 'AI grader is busy. Please try submitting again shortly.',
        retryable: err.retryable !== false,
        code: err.code || 'AI_GRADE_UNAVAILABLE',
      });
    }
    return res.status(500).json({ error: 'Could not submit assessment.' });
  }
});

module.exports = router;

const express = require('express');
const { requireCronSecret } = require('../middleware/requireCronSecret');
const { runTalentReminders } = require('../services/talentReminderService');

const router = express.Router();

/**
 * POST /api/internal/cron/talent-reminders
 * VPS crontab example (hourly):
 * curl -fsS -X POST "https://YOUR_API/api/internal/cron/talent-reminders" \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
router.post('/talent-reminders', requireCronSecret, async (req, res) => {
  try {
    const result = await runTalentReminders();
    console.info(
      '[cron/talent-reminders]',
      `activation sent ${result.activation.sent}/${result.activation.eligible},`,
      `profile sent ${result.profile.sent}/${result.profile.eligible},`,
      `assessment sent ${result.assessment.sent}/${result.assessment.eligible}`
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/talent-reminders]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Reminder job failed.' });
  }
});

/** GET — health check that cron route is mounted (still requires secret via query for manual test) */
router.get('/talent-reminders', requireCronSecret, async (req, res) => {
  return res.json({
    ok: true,
    message: 'Talent reminder cron endpoint is ready. Use POST to run reminders.',
  });
});

module.exports = router;

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

/**
 * POST /api/internal/cron/workforce-billing
 * Issues the next invoice for every active engagement (billed in advance) and
 * auto-pays from client wallets where enabled. Safe to run repeatedly — periods
 * are unique per engagement. VPS crontab example (daily 06:00):
 * 0 6 * * * curl -fsS -X POST "https://YOUR_API/api/internal/cron/workforce-billing"  *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
router.post('/workforce-billing', requireCronSecret, async (req, res) => {
  try {
    const workforce = require('../services/workforceService');
    const result = await workforce.runBilling({}, 'system:cron');
    console.info('[cron/workforce-billing]', `issued ${result.issued}, auto-paid ${result.autoPaid}`);
    return res.json({ ok: true, asOf: result.asOf, issued: result.issued, autoPaid: result.autoPaid });
  } catch (err) {
    console.error('[cron/workforce-billing]', err?.code, err?.message || err);
    return res.status(500).json({ ok: false, error: 'Billing job failed.' });
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

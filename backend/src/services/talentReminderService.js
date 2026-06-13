/**
 * Scheduled talent reminders (activation ladder + profile + assessment).
 * Triggered by POST /api/internal/cron/talent-reminders (VPS crontab + CRON_SECRET).
 *
 * Activation ladder is anchored to first_invited_at (original admin Send), not invited_at
 * (which updates on each token refresh).
 *
 * Production defaults: reminder @ 24h, reminder @ 48h, full resend @ 72h.
 * Local testing: ACTIVATION_STEPS_MINUTES=10,20,30 or legacy ACTIVATION_REMINDER_AFTER_MINUTES.
 */

const { supabaseAdmin } = require('../middleware/requireAdmin');
const store = require('./talentInviteStore');
const {
  sendActivationReminderEmail,
  sendActivationFullResendEmail,
  getTokenTtlHours,
} = require('./talentActivationService');
const {
  sendTalentAssessmentReminderEmail,
  sendTalentProfileReminderEmail,
} = require('./resendEmailService');
const { enrichInvitesWithLifecycle, isProfileComplete } = require('./inviteLifecycle');

function hoursToMs(hours) {
  const n = Number(hours);
  return Number.isFinite(n) && n > 0 ? n * 3600000 : 0;
}

function minutesToMs(minutes) {
  const n = Number(minutes);
  return Number.isFinite(n) && n > 0 ? n * 60000 : 0;
}

function minutesSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function getCronEmailDelayMs() {
  const n = parseInt(process.env.CRON_EMAIL_DELAY_MS, 10);
  return Number.isFinite(n) && n >= 0 ? n : 600;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCommaNumbers(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * @returns {{ mode: 'minutes'|'hours', steps: Array<{ afterMinutes: number, kind: 'reminder'|'full' }> }}
 */
function getActivationSchedule() {
  const stepsMinutes = parseCommaNumbers(process.env.ACTIVATION_STEPS_MINUTES);
  if (stepsMinutes.length) {
    return {
      mode: 'minutes',
      steps: stepsMinutes.map((afterMinutes, index) => ({
        afterMinutes,
        kind: index === stepsMinutes.length - 1 ? 'full' : 'reminder',
      })),
    };
  }

  // Legacy local two-step: 10 min reminder → 20 min full resend
  const reminderMinutes = parseInt(process.env.ACTIVATION_REMINDER_AFTER_MINUTES, 10);
  const followupMinutes = parseInt(process.env.ACTIVATION_FOLLOWUP_AFTER_MINUTES, 10);
  if (Number.isFinite(reminderMinutes) && reminderMinutes > 0) {
    const steps = [{ afterMinutes: reminderMinutes, kind: 'reminder' }];
    if (Number.isFinite(followupMinutes) && followupMinutes > reminderMinutes) {
      steps.push({ afterMinutes: followupMinutes, kind: 'full' });
    }
    return { mode: 'minutes', steps };
  }

  const stepsHours = parseCommaNumbers(process.env.ACTIVATION_STEPS_HOURS);
  const hours = stepsHours.length ? stepsHours : [24, 48, 72];
  return {
    mode: 'hours',
    steps: hours.map((h, index) => ({
      afterMinutes: h * 60,
      kind: index === hours.length - 1 ? 'full' : 'reminder',
    })),
  };
}

function getActivationAnchor(invite) {
  return invite.firstInvitedAt || invite.invitedAt;
}

function minutesSinceFirstInvite(invite) {
  return minutesSince(getActivationAnchor(invite));
}

function getProfileReminderHours() {
  const reminderMinutes = parseInt(process.env.PROFILE_REMINDER_AFTER_MINUTES, 10);
  if (Number.isFinite(reminderMinutes) && reminderMinutes > 0) {
    return reminderMinutes / 60;
  }
  const n = parseInt(process.env.PROFILE_REMINDER_HOURS, 10);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

function getProfileReminderCutoffMs() {
  const reminderMinutes = parseInt(process.env.PROFILE_REMINDER_AFTER_MINUTES, 10);
  if (Number.isFinite(reminderMinutes) && reminderMinutes > 0) {
    return minutesToMs(reminderMinutes);
  }
  return hoursToMs(getProfileReminderHours());
}

function getAssessmentReminderHours() {
  const reminderMinutes = parseInt(process.env.ASSESSMENT_REMINDER_AFTER_MINUTES, 10);
  if (Number.isFinite(reminderMinutes) && reminderMinutes > 0) {
    return reminderMinutes / 60;
  }
  const n = parseInt(process.env.ASSESSMENT_REMINDER_HOURS, 10);
  return Number.isFinite(n) && n > 0 ? n : 24;
}

function getAssessmentReminderCutoffMs() {
  const reminderMinutes = parseInt(process.env.ASSESSMENT_REMINDER_AFTER_MINUTES, 10);
  if (Number.isFinite(reminderMinutes) && reminderMinutes > 0) {
    return minutesToMs(reminderMinutes);
  }
  return hoursToMs(getAssessmentReminderHours());
}

function isActivationStepDue(invite, schedule) {
  const count = invite.activationReminderCount || 0;
  if (count >= schedule.steps.length) return false;
  const step = schedule.steps[count];
  if (!step) return false;
  return minutesSinceFirstInvite(invite) >= step.afterMinutes;
}

async function listPendingActivationInvites() {
  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .select('*')
    .eq('status', 'invited')
    .not('email', 'is', null)
    .is('activated_at', null)
    .order('invited_at', { ascending: true });

  if (error) throw error;
  return (data || [])
    .map(store.mapInviteRow)
    .filter((inv) => getActivationAnchor(inv));
}

async function listActivationReminderCandidates() {
  const schedule = getActivationSchedule();
  const invites = await listPendingActivationInvites();
  return invites.filter((inv) => isActivationStepDue(inv, schedule));
}

async function processActivationInvite(invite, schedule) {
  const count = invite.activationReminderCount || 0;
  const outcomes = [];

  if (count >= schedule.steps.length) {
    return outcomes;
  }

  const step = schedule.steps[count];
  const elapsedMin = minutesSinceFirstInvite(invite);
  if (elapsedMin < step.afterMinutes) {
    return outcomes;
  }

  let result;
  let kind;

  if (step.kind === 'full') {
    result = await sendActivationFullResendEmail(invite);
    kind = 'activation_resend';
  } else {
    result = await sendActivationReminderEmail(invite);
    kind = count >= 1 ? 'activation_reminder_2' : 'activation_reminder';
  }

  outcomes.push({
    inviteId: invite.id,
    email: invite.email,
    kind,
    stepIndex: count,
    elapsedMinutes: Math.round(elapsedMin),
    anchorAt: getActivationAnchor(invite),
    ...result,
  });

  return outcomes;
}

async function listProfileReminderCandidates() {
  const cutoff = new Date(Date.now() - getProfileReminderCutoffMs()).toISOString();

  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .select('*')
    .eq('status', 'activated')
    .not('user_id', 'is', null)
    .not('email', 'is', null)
    .not('activated_at', 'is', null)
    .lte('activated_at', cutoff)
    .is('profile_reminder_sent_at', null)
    .order('activated_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(store.mapInviteRow);
}

async function listAssessmentReminderCandidates() {
  const cutoff = new Date(Date.now() - getAssessmentReminderCutoffMs()).toISOString();

  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .select('*')
    .eq('status', 'activated')
    .not('user_id', 'is', null)
    .not('email', 'is', null)
    .not('activated_at', 'is', null)
    .lte('activated_at', cutoff)
    .is('assessment_reminder_sent_at', null)
    .order('activated_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(store.mapInviteRow);
}

async function runWithSendDelay(items, handler) {
  const delayMs = getCronEmailDelayMs();
  const outcomes = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    try {
      const batch = await handler(item);
      outcomes.push(...(Array.isArray(batch) ? batch : [batch]));
    } catch (err) {
      outcomes.push({
        inviteId: item.id,
        email: item.email,
        sent: false,
        reason: 'send_failed',
        error: err?.message || String(err),
      });
    }
    if (delayMs > 0 && i < items.length - 1) {
      await sleep(delayMs);
    }
  }

  return outcomes;
}

async function runActivationReminders() {
  const schedule = getActivationSchedule();
  const candidates = await listActivationReminderCandidates();
  const outcomes = await runWithSendDelay(candidates, (invite) =>
    processActivationInvite(invite, schedule)
  );

  return {
    schedule,
    eligible: candidates.length,
    sent: outcomes.filter((o) => o.sent).length,
    outcomes,
  };
}

async function runProfileReminders() {
  const candidates = await listProfileReminderCandidates();
  const enriched = await enrichInvitesWithLifecycle(candidates);
  const eligible = enriched.filter((inv) => !inv.lifecycle?.profileComplete);
  const outcomes = await runWithSendDelay(eligible, async (invite) => {
    if (invite.lifecycle?.profileComplete) {
      return {
        inviteId: invite.id,
        email: invite.email,
        sent: false,
        reason: 'profile_complete',
      };
    }

    const displayName = invite.name || invite.lifecycle?.profileName || '';
    const mailResult = await sendTalentProfileReminderEmail({
      to: invite.email,
      name: displayName,
    });

    await store.updateInvite(invite.id, {
      profile_reminder_sent_at: new Date().toISOString(),
    });

    return {
      inviteId: invite.id,
      email: invite.email,
      sent: true,
      emailId: mailResult.id,
    };
  });

  return {
    eligible: eligible.length,
    sent: outcomes.filter((o) => o.sent).length,
    outcomes,
  };
}

async function runAssessmentReminders() {
  const candidates = await listAssessmentReminderCandidates();
  const enriched = await enrichInvitesWithLifecycle(candidates);
  const outcomes = await runWithSendDelay(enriched, async (invite) => {
    if (!invite.lifecycle?.profileComplete) {
      return {
        inviteId: invite.id,
        email: invite.email,
        sent: false,
        reason: 'profile_incomplete',
      };
    }

    if (invite.lifecycle?.assessmentDone) {
      return {
        inviteId: invite.id,
        email: invite.email,
        sent: false,
        reason: 'already_assessed',
      };
    }

    const displayName = invite.name || invite.lifecycle?.profileName || '';
    const mailResult = await sendTalentAssessmentReminderEmail({
      to: invite.email,
      name: displayName,
    });

    await store.updateInvite(invite.id, {
      assessment_reminder_sent_at: new Date().toISOString(),
    });

    return {
      inviteId: invite.id,
      email: invite.email,
      sent: true,
      emailId: mailResult.id,
    };
  });

  return {
    eligible: candidates.length,
    sent: outcomes.filter((o) => o.sent).length,
    outcomes,
  };
}

async function runTalentReminders() {
  const activation = await runActivationReminders();
  const profile = await runProfileReminders();
  const assessment = await runAssessmentReminders();

  return {
    ranAt: new Date().toISOString(),
    config: {
      activationSchedule: getActivationSchedule(),
      profileReminderHours: getProfileReminderHours(),
      profileReminderMinutes: parseInt(process.env.PROFILE_REMINDER_AFTER_MINUTES, 10) || null,
      assessmentReminderHours: getAssessmentReminderHours(),
      assessmentReminderMinutes: parseInt(process.env.ASSESSMENT_REMINDER_AFTER_MINUTES, 10) || null,
      tokenTtlHours: getTokenTtlHours(),
      emailDelayMs: getCronEmailDelayMs(),
    },
    activation,
    profile,
    assessment,
  };
}

module.exports = {
  runTalentReminders,
  runActivationReminders,
  runProfileReminders,
  runAssessmentReminders,
  isProfileComplete,
  getActivationSchedule,
  getActivationAnchor,
  minutesSinceFirstInvite,
  isActivationStepDue,
};

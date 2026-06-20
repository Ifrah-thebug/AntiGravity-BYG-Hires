/**
 * Transactional email via Resend (client activation, etc.).
 * Falls back to console logging when RESEND_API_KEY is missing or EMAIL_PROVIDER=console.
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  try {
    // Project root .env (same path as server.js)
    require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  } catch {
    // already loaded
  }
}

loadEnv();

function getAppPublicUrl() {
  return (
    process.env.CLIENT_URI ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173'
  ).replace(/\/$/, '');
}

function getBackendPublicUrl() {
  return (
    process.env.BACKEND_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || 5001}`
  ).replace(/\/$/, '');
}

function buildTalentActivationAppUrl(token) {
  return `${getAppPublicUrl()}/talent/activate?token=${encodeURIComponent(token)}`;
}

/** Email button → plain HTML bridge (works in Gmail in-app browsers). */
function buildTalentActivationEmailButtonUrl(token) {
  return `${getBackendPublicUrl()}/api/talent-invite/activate/open?token=${encodeURIComponent(token)}`;
}

function buildEmailLinkButton(href, label) {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">${label}</a>`;
}

function buildEmailBrowserHintHtml() {
  return `<p style="margin: 0 0 16px; font-size: 12px; color: #666; line-height: 1.5;">If the button shows a blank page in Gmail or your mail app, copy the link below and open it in <strong>Chrome</strong> or <strong>Safari</strong>.</p>`;
}

function getEmailLogoUrl() {
  const custom = String(process.env.EMAIL_LOGO_URL || '').trim();
  if (custom) return custom;
  return `${getAppPublicUrl()}/byg-hires-logo.png`;
}

function isLocalhostUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return true;
  }
}

let cachedInlineLogoDataUri = null;

function readInlineLogoDataUri() {
  if (cachedInlineLogoDataUri) return cachedInlineLogoDataUri;

  const candidates = [
    path.join(__dirname, '../../../public/byg-hires-logo.png'),
    path.join(__dirname, '../../../src/assets/BYG Hires Logo.png'),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    cachedInlineLogoDataUri = `data:${mime};base64,${buf.toString('base64')}`;
    return cachedInlineLogoDataUri;
  }

  return null;
}

function resolveEmailLogoSrc() {
  const publicUrl = getEmailLogoUrl();
  if (!isLocalhostUrl(publicUrl)) return publicUrl;
  return readInlineLogoDataUri() || publicUrl;
}

function buildEmailLogoHtml() {
  const logoSrc = resolveEmailLogoSrc();
  if (!logoSrc) {
    return `<p style="font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #ff3d3d; margin: 0 0 20px;">BYG Hires</p>`;
  }
  return `<img src="${logoSrc}" alt="BYG Hires" width="140" style="display: block; height: auto; max-width: 140px; margin: 0 0 20px; border: 0;" />`;
}

function getDevAllowlist() {
  const raw = String(process.env.EMAIL_DEV_ALLOWLIST || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** In non-production, optionally redirect sends to allowlisted inboxes. */
function resolveRecipient(intendedEmail) {
  const email = String(intendedEmail || '').trim().toLowerCase();
  const allowlist = getDevAllowlist();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd || !allowlist.length) return email;
  if (allowlist.includes(email)) return email;

  const fallback = allowlist[0];
  console.warn(`[email] Dev allowlist active — sending to ${fallback} instead of ${email}`);
  return fallback;
}

function useConsoleProvider() {
  if (process.env.EMAIL_PROVIDER === 'console') return true;
  return !String(process.env.RESEND_API_KEY || '').trim();
}

function buildActivationEmailHtml({ name, talentName, activationUrl, bookingContext }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  let bookingLine = 'Your intro call is booked.';
  if (bookingContext === 'discovery') {
    bookingLine = 'Your discovery call is booked.';
  } else if (talentName) {
    bookingLine = `Your intro with <strong>${talentName}</strong> is booked.`;
  }

  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 12px;">${bookingLine} Activate your client account to manage intros and access your talent portal.</p>
  <p style="margin: 24px 0;">
    ${buildEmailLinkButton(activationUrl, 'Activate account')}
  </p>
  ${buildEmailBrowserHintHtml()}
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Or copy this link:</p>
  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #444;">${activationUrl}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">This link expires in 72 hours. If you did not book an intro, you can ignore this email.</p>
</body>
</html>`.trim();
}

/**
 * @param {{ to: string, name?: string, talentName?: string, token: string }} params
 * @returns {Promise<{ id: string, activationUrl: string, redirectedTo?: string }>}
 */
async function sendClientActivationEmail({ to, name, talentName, token, bookingContext }) {
  const intended = String(to || '').trim().toLowerCase();
  if (!intended) throw new Error('Recipient email is required');

  const recipient = resolveRecipient(intended);
  const activationUrl = `${getAppPublicUrl()}/client/activate?token=${encodeURIComponent(token)}`;
  const subject = 'Activate your BYG Hires client account';
  const html = buildActivationEmailHtml({ name, talentName, activationUrl, bookingContext });

  if (useConsoleProvider()) {
    console.log('\n[email:console] Client activation');
    console.log(`  To: ${recipient}${recipient !== intended ? ` (requested: ${intended})` : ''}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Link: ${activationUrl}\n`);
    return {
      id: 'console',
      activationUrl,
      redirectedTo: recipient !== intended ? recipient : undefined,
    };
  }

  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || 'BYG Hires <onboarding@resend.dev>';

  const { data, error } = await resend.emails.send({
    from,
    to: [recipient],
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message || 'Resend send failed');
  }

  console.log(`[email] Client activation sent to ${recipient} (id: ${data?.id || 'unknown'})`);
  return {
    id: data?.id || 'sent',
    activationUrl,
    redirectedTo: recipient !== intended ? recipient : undefined,
  };
}

function buildTalentActivationEmailHtml({
  name,
  buttonUrl,
  copyUrl,
  reminder = false,
  tokenHours = 72,
  secondReminder = false,
}) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  let intro;
  if (secondReminder) {
    intro = `<p style="margin: 0 0 12px;">We still haven't seen your BYG Hires talent profile activation. Please set your password to join the <strong>BYG Hires Talent Pool</strong> and complete your profile.</p>`;
  } else if (reminder) {
    intro = `<p style="margin: 0 0 12px;">This is a friendly reminder — you were invited to join the <strong>BYG Hires Talent Pool</strong> but haven't activated your account yet. Set your password to continue.</p>`;
  } else {
    intro = `<p style="margin: 0 0 12px;">You've been invited to join the <strong>BYG Hires Talent Pool</strong>. Activate your account to set up your profile and get started.</p>`;
  }
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">${greeting}</p>
  ${intro}
  <p style="margin: 24px 0;">
    ${buildEmailLinkButton(buttonUrl, 'Activate account')}
  </p>
  ${buildEmailBrowserHintHtml()}
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Or copy this link:</p>
  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #444;">${copyUrl}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">This link expires in ${tokenHours} hours. If you were not expecting this invite, you can ignore this email.</p>
</body>
</html>`.trim();
}

function buildTalentAssessmentReminderEmailHtml({ name, assessmentUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 12px;">Your BYG Hires profile is set up — great work. Complete at least one <strong>skills assessment</strong> so clients can see your verified expertise.</p>
  <p style="margin: 24px 0;">
    <a href="${assessmentUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Take skills test</a>
  </p>
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Or copy this link:</p>
  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #444;">${assessmentUrl}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">Log in with the email and password you created when you activated your account.</p>
</body>
</html>`.trim();
}

async function sendTransactionalEmail({ to, subject, html, logLabel }) {
  const intended = String(to || '').trim().toLowerCase();
  if (!intended) throw new Error('Recipient email is required');

  const recipient = resolveRecipient(intended);

  if (useConsoleProvider()) {
    console.log(`\n[email:console] ${logLabel}`);
    console.log(`  To: ${recipient}${recipient !== intended ? ` (requested: ${intended})` : ''}`);
    console.log(`  Subject: ${subject}\n`);
    return {
      id: 'console',
      redirectedTo: recipient !== intended ? recipient : undefined,
    };
  }

  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || 'BYG Hires <onboarding@resend.dev>';

  const { data, error } = await resend.emails.send({
    from,
    to: [recipient],
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message || 'Resend send failed');
  }

  console.log(`[email] ${logLabel} sent to ${recipient} (id: ${data?.id || 'unknown'})`);
  return {
    id: data?.id || 'sent',
    redirectedTo: recipient !== intended ? recipient : undefined,
  };
}

async function sendTalentActivationEmail({ to, name, token, tokenHours = 72 }) {
  const copyUrl = buildTalentActivationAppUrl(token);
  const buttonUrl = buildTalentActivationEmailButtonUrl(token);
  const subject = 'Activate your BYG Hires talent profile';
  const html = buildTalentActivationEmailHtml({
    name,
    buttonUrl,
    copyUrl,
    reminder: false,
    tokenHours,
  });
  const result = await sendTransactionalEmail({ to, subject, html, logLabel: 'Talent activation' });
  return { ...result, activationUrl: copyUrl };
}

async function sendTalentActivationReminderEmail({
  to,
  name,
  token,
  tokenHours = 72,
  secondReminder = false,
}) {
  const copyUrl = buildTalentActivationAppUrl(token);
  const buttonUrl = buildTalentActivationEmailButtonUrl(token);
  const subject = secondReminder
    ? 'Second reminder: activate your BYG Hires talent profile'
    : 'Reminder: activate your BYG Hires talent profile';
  const html = buildTalentActivationEmailHtml({
    name,
    buttonUrl,
    copyUrl,
    reminder: true,
    tokenHours,
    secondReminder,
  });
  const result = await sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: secondReminder ? 'Talent activation reminder (2nd)' : 'Talent activation reminder',
  });
  return { ...result, activationUrl: copyUrl };
}

function buildTalentProfileReminderEmailHtml({ name, setupUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 12px;">Thanks for activating your BYG Hires account. Please finish your <strong>talent profile</strong> (name and job title at minimum) so clients can find you in the directory.</p>
  <p style="margin: 24px 0;">
    <a href="${setupUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Complete profile</a>
  </p>
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Or copy this link:</p>
  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #444;">${setupUrl}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">Log in with the email and password you created when you activated your account.</p>
</body>
</html>`.trim();
}

async function sendTalentProfileReminderEmail({ to, name }) {
  const setupUrl = `${getAppPublicUrl()}/talent/setup`;
  const subject = 'Complete your BYG Hires talent profile';
  const html = buildTalentProfileReminderEmailHtml({ name, setupUrl });
  return sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: 'Talent profile reminder',
  });
}

async function sendTalentAssessmentReminderEmail({ to, name }) {
  const assessmentUrl = `${getAppPublicUrl()}/assessment`;
  const subject = 'Complete your BYG Hires skills assessment';
  const html = buildTalentAssessmentReminderEmailHtml({ name, assessmentUrl });
  return sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: 'Talent assessment reminder',
  });
}

function buildPasswordResetEmailHtml({ name, resetUrl, tokenHours = 1 }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 12px;">We received a request to reset your <strong>BYG Hires</strong> password. Click below to choose a new password.</p>
  <p style="margin: 24px 0;">
    <a href="${resetUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Reset password</a>
  </p>
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Or copy this link:</p>
  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #444;">${resetUrl}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">This link expires in ${tokenHours} hour${tokenHours === 1 ? '' : 's'}. If you did not request a reset, you can ignore this email.</p>
</body>
</html>`.trim();
}

async function sendPasswordResetEmail({ to, name, token, tokenHours = 1 }) {
  const resetUrl = `${getAppPublicUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Reset your BYG Hires password';
  const html = buildPasswordResetEmailHtml({ name, resetUrl, tokenHours });
  const result = await sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: 'Password reset',
  });
  if (useConsoleProvider()) {
    console.log(`  Link: ${resetUrl}\n`);
  }
  return { ...result, resetUrl };
}

module.exports = {
  sendClientActivationEmail,
  sendTalentActivationEmail,
  sendTalentActivationReminderEmail,
  sendTalentProfileReminderEmail,
  sendTalentAssessmentReminderEmail,
  sendPasswordResetEmail,
  getAppPublicUrl,
  useConsoleProvider,
};

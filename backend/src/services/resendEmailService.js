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

/**
 * Button → static HTML bridge (no JS). Mail apps often sandbox the first click;
 * the bridge uses target="_top" so Continue opens the React app outside the iframe.
 * Copy-paste link still goes straight to the SPA for top-level browser tabs.
 */
function buildTalentActivationEmailButtonUrl(token) {
  return `${getBackendPublicUrl()}/api/talent-invite/activate/open?token=${encodeURIComponent(token)}`;
}

function buildEmailLinkButton(href, label) {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">${label}</a>`;
}

function buildEmailBrowserHintHtml() {
  return `<p style="margin: 0 0 16px; font-size: 12px; color: #666; line-height: 1.5;">If the button opens a blank page inside Gmail, tap <strong>Continue to activation</strong> or copy the link below into <strong>Chrome</strong> / <strong>Safari</strong>.</p>`;
}

function getEmailLogoUrl() {
  const custom = String(process.env.EMAIL_LOGO_URL || '').trim();
  if (custom) return custom;
  return `${getAppPublicUrl()}/byg-hires-email-logo-rounded.png`;
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
    path.join(__dirname, '../../../public/byg-hires-email-logo-rounded.png'),
    path.join(__dirname, '../../../public/byg-hires-email-logo-round.png'),
    path.join(__dirname, '../../../public/byg-hires-email-logo.png'),
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
  return `<img src="${logoSrc}" alt="BYG Hires" width="168" style="display: block; height: auto; max-width: 168px; margin: 0 0 20px; border: 0; border-radius: 14px;" />`;
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
  ambassadorCode = null,
  ambassadorName = null,
}) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const hasAmbassador = Boolean(ambassadorCode);
  let intro;
  if (secondReminder) {
    intro = hasAmbassador
      ? `<p style="margin: 0 0 12px;">We still haven't seen your BYG Hires activation. You were invited through the <strong>Byghires Circle</strong> ambassador program${ambassadorName ? ` by <strong>${ambassadorName}</strong>` : ''}. Please set your password to complete your profile.</p>`
      : `<p style="margin: 0 0 12px;">We still haven't seen your BYG Hires talent profile activation. Please set your password to join the <strong>BYG Hires Talent Pool</strong> and complete your profile.</p>`;
  } else if (reminder) {
    intro = hasAmbassador
      ? `<p style="margin: 0 0 12px;">Friendly reminder — you were invited to BYG Hires through the <strong>Byghires Circle</strong> ambassador program${ambassadorName ? ` by <strong>${ambassadorName}</strong>` : ''}. Activate your account to finish your profile.</p>`
      : `<p style="margin: 0 0 12px;">This is a friendly reminder — you were invited to join the <strong>BYG Hires Talent Pool</strong> but haven't activated your account yet. Set your password to continue.</p>`;
  } else if (hasAmbassador) {
    intro = `
      <p style="margin: 0 0 12px;">You've been invited to <strong>BYG Hires</strong> through the <strong>Byghires Circle</strong> ambassador program${ambassadorName ? ` by <strong>${ambassadorName}</strong>` : ''}.</p>
      <p style="margin: 0 0 12px;">Activate your account to create your talent profile. Your CV is already on file when one was uploaded — you'll review and complete your profile after signing in.</p>
      <p style="margin: 0 0 8px;"><strong>After your profile is set up, complete these steps:</strong></p>
      <ol style="margin: 0 0 12px; padding-left: 20px;">
        <li style="margin-bottom: 6px;">Submit your profile for admin review so you can go live on the talent directory</li>
        <li style="margin-bottom: 6px;">Connect your calendar and publish intro availability so clients can book calls</li>
        <li style="margin-bottom: 6px;">Take at least one skills assessment to show verified expertise</li>
        <li style="margin-bottom: 6px;">Add portfolio projects (optional, but helps you stand out)</li>
      </ol>
      <p style="margin: 0 0 12px;">You can do all of this from your talent portal after activation.</p>
    `;
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

async function sendTalentActivationEmail({
  to,
  name,
  token,
  tokenHours = 72,
  ambassadorCode = null,
  ambassadorName = null,
}) {
  const copyUrl = buildTalentActivationAppUrl(token);
  const buttonUrl = buildTalentActivationEmailButtonUrl(token);
  const hasAmbassador = Boolean(ambassadorCode);
  const subject = hasAmbassador
    ? 'Activate your BYG Hires profile (Ambassador invite)'
    : 'Activate your BYG Hires talent profile';
  const html = buildTalentActivationEmailHtml({
    name,
    buttonUrl,
    copyUrl,
    reminder: false,
    tokenHours,
    ambassadorCode,
    ambassadorName,
  });
  const result = await sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: hasAmbassador ? 'Talent activation (ambassador)' : 'Talent activation',
  });
  return { ...result, activationUrl: copyUrl };
}

async function sendTalentActivationReminderEmail({
  to,
  name,
  token,
  tokenHours = 72,
  secondReminder = false,
  ambassadorCode = null,
  ambassadorName = null,
}) {
  const copyUrl = buildTalentActivationAppUrl(token);
  const buttonUrl = buildTalentActivationEmailButtonUrl(token);
  const hasAmbassador = Boolean(ambassadorCode);
  const subject = secondReminder
    ? hasAmbassador
      ? 'Second reminder: activate your Ambassador invite'
      : 'Second reminder: activate your BYG Hires talent profile'
    : hasAmbassador
      ? 'Reminder: activate your Ambassador invite'
      : 'Reminder: activate your BYG Hires talent profile';
  const html = buildTalentActivationEmailHtml({
    name,
    buttonUrl,
    copyUrl,
    reminder: true,
    tokenHours,
    secondReminder,
    ambassadorCode,
    ambassadorName,
  });
  const result = await sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: secondReminder
      ? hasAmbassador
        ? 'Talent activation reminder (2nd, ambassador)'
        : 'Talent activation reminder (2nd)'
      : hasAmbassador
        ? 'Talent activation reminder (ambassador)'
        : 'Talent activation reminder',
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

function buildTalentAiInterviewRequestEmailHtml({ name, interviewUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 12px;">A client has requested an <strong>AI voice interview</strong> with you on BYG Hires. Please complete it at your earliest convenience — before your intro call is scheduled.</p>
  <p style="margin: 0 0 12px;">Log in to your talent portal, complete your skills test if you have not already, then take the AI interview (~15 minutes, microphone required).</p>
  <p style="margin: 24px 0;">
    <a href="${interviewUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Take AI interview</a>
  </p>
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Or copy this link:</p>
  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #444;">${interviewUrl}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">This interview is only available because a client requested it. If you have questions, reply to your BYG Hires contact.</p>
</body>
</html>`.trim();
}

async function sendTalentAiInterviewRequestEmail({ to, name }) {
  const interviewUrl = `${getAppPublicUrl()}/interview`;
  const subject = 'A client requested your AI voice interview — BYG Hires';
  const html = buildTalentAiInterviewRequestEmailHtml({
    name,
    interviewUrl,
  });
  const result = await sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: 'Talent AI interview request',
  });
  return { ...result, interviewUrl };
}

function buildTalentPortfolioRequestEmailHtml({ name, portalUrl, clientLabel }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 12px;"><strong>${clientLabel}</strong> wants to see your portfolio on BYG Hires. Please review the request in your talent portal and approve it when you are ready to share your work.</p>
  <p style="margin: 0 0 12px;">If your portfolio could use another project or a quick polish, now is a great time — clients notice the details.</p>
  <p style="margin: 24px 0;">
    ${buildEmailLinkButton(portalUrl, 'Review portfolio request')}
  </p>
  ${buildEmailBrowserHintHtml()}
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Or copy this link:</p>
  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #444;">${portalUrl}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">Each client request is approved individually — you stay in control of who sees your portfolio.</p>
</body>
</html>`.trim();
}

async function sendTalentPortfolioRequestEmail({ to, name, clientName, company }) {
  const portalUrl = `${getAppPublicUrl()}/portal#portfolio-requests`;
  const clientLabel = portfolioChatNudgeLabel(clientName, company);
  const subject = 'A client wants to see your portfolio — BYG Hires';
  const html = buildTalentPortfolioRequestEmailHtml({ name, portalUrl, clientLabel });
  return sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: 'Talent portfolio request',
  });
}

function buildClientPortfolioApprovedEmailHtml({ name, talentName, portfolioUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const talentLabel = talentName ? `<strong>${talentName}</strong>` : 'the talent';
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 12px;">Good news — ${talentLabel} approved your portfolio request on BYG Hires. You can view their full project storybook now.</p>
  <p style="margin: 24px 0;">
    ${buildEmailLinkButton(portfolioUrl, 'View portfolio')}
  </p>
  ${buildEmailBrowserHintHtml()}
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Or copy this link:</p>
  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #444;">${portfolioUrl}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">Sign in with your hiring client account if prompted.</p>
</body>
</html>`.trim();
}

async function sendClientPortfolioApprovedEmail({ to, name, talentName, talentId }) {
  const portfolioUrl = `${getAppPublicUrl()}/talent/${encodeURIComponent(talentId)}/portfolio`;
  const subject = talentName
    ? `${talentName} approved your portfolio request — BYG Hires`
    : 'Your portfolio request was approved — BYG Hires';
  const html = buildClientPortfolioApprovedEmailHtml({ name, talentName, portfolioUrl });
  return sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: 'Client portfolio approved',
  });
}

function portfolioChatNudgeLabel(clientName, company) {
  const name = String(clientName || '').trim();
  const co = String(company || '').trim();
  if (name && co) return `${name} from ${co}`;
  if (name) return name;
  if (co) return co;
  return 'A client';
}

const PROFILE_ISSUE_COPY = {
  photo: 'Upload a clear, professional headshot (face visible, good lighting, neutral background).',
  cv: 'Re-upload your CV as a clear PDF so we can verify your experience and role.',
  bio: 'Update your about section so it reflects your experience and what you offer clients.',
  skills: 'Review and update your skills list — include your strongest areas.',
  job_title: 'Set a clear, accurate job title that matches your experience.',
  pricing: 'Review your monthly fee and availability settings.',
  other: 'See the notes below for what to fix.',
};

function buildProfileIssueListHtml(issues, notes) {
  const codes = Array.isArray(issues) ? issues : [];
  const items = codes
    .map((code) => PROFILE_ISSUE_COPY[code])
    .filter(Boolean);
  if (notes?.trim()) items.push(notes.trim());
  if (!items.length) {
    return '<p style="margin: 0 0 12px;">Please log in and update your profile as discussed with BYG Hires.</p>';
  }
  return `<ul style="margin: 0 0 16px; padding-left: 20px;">${items
    .map((text) => `<li style="margin-bottom: 8px;">${text}</li>`)
    .join('')}</ul>`;
}

function buildProfileChangesRequestedEmailHtml({ name, portalUrl, issues, notes }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 12px;">Thank you for submitting your BYG Hires talent profile. Before we can list you in the <strong>talent directory</strong>, we need a few updates:</p>
  ${buildProfileIssueListHtml(issues, notes)}
  <p style="margin: 0 0 12px;">You are on our waitlist until your profile is approved. Once approved, clients will be able to find you on the directory.</p>
  <p style="margin: 24px 0;">
    <a href="${portalUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Update profile &amp; resubmit</a>
  </p>
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Or copy this link:</p>
  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #444;">${portalUrl}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">After making changes, open your portal and submit your profile for review again.</p>
</body>
</html>`.trim();
}

async function sendProfileChangesRequestedEmail({ to, name, issues, notes }) {
  const portalUrl = `${getAppPublicUrl()}/portal`;
  const subject = 'Action needed: update your BYG Hires profile';
  const html = buildProfileChangesRequestedEmailHtml({ name, portalUrl, issues, notes });
  return sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: 'Profile changes requested',
  });
}

function buildProfileApprovedEmailHtml({ name, portalUrl, directoryUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 12px;">Great news — your BYG Hires talent profile has been <strong>approved</strong> and is now visible in our talent directory.</p>
  <p style="margin: 24px 0;">
    <a href="${directoryUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">View talent directory</a>
  </p>
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Manage your profile:</p>
  <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #444;">${portalUrl}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">Clients can now discover your profile and request introductions.</p>
</body>
</html>`.trim();
}

async function sendProfileApprovedEmail({ to, name, profileId }) {
  const portalUrl = `${getAppPublicUrl()}/portal`;
  const directoryUrl = profileId
    ? `${getAppPublicUrl()}/talent/${encodeURIComponent(profileId)}`
    : `${getAppPublicUrl()}/talent`;
  const subject = 'Your BYG Hires profile is live';
  const html = buildProfileApprovedEmailHtml({ name, portalUrl, directoryUrl });
  return sendTransactionalEmail({
    to,
    subject,
    html,
    logLabel: 'Profile approved',
  });
}

function buildProfileSubmittedAdminEmailHtml({ talentName, talentEmail, reviewUrl }) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 12px;">A talent profile is ready for review.</p>
  <p style="margin: 0 0 8px;"><strong>${talentName || 'Candidate'}</strong></p>
  <p style="margin: 0 0 16px; font-size: 13px; color: #555;">${talentEmail || ''}</p>
  <p style="margin: 24px 0;">
    <a href="${reviewUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Open review queue</a>
  </p>
</body>
</html>`.trim();
}

async function sendProfileSubmittedAdminEmail({ talentName, talentEmail, profileId }) {
  const adminNotify = String(process.env.ADMIN_NOTIFY_EMAIL || process.env.RESEND_FROM_EMAIL || '').trim();
  if (!adminNotify) return null;

  const reviewUrl = `${getAppPublicUrl()}/admin/profile-reviews`;
  const subject = `Profile review: ${talentName || talentEmail || 'New submission'}`;
  const html = buildProfileSubmittedAdminEmailHtml({ talentName, talentEmail, reviewUrl });
  return sendTransactionalEmail({
    to: adminNotify,
    subject,
    html,
    logLabel: 'Profile submitted (admin)',
  });
}

module.exports = {
  sendClientActivationEmail,
  sendTalentActivationEmail,
  sendTalentActivationReminderEmail,
  sendTalentProfileReminderEmail,
  sendTalentAssessmentReminderEmail,
  sendPasswordResetEmail,
  sendTalentAiInterviewRequestEmail,
  sendTalentPortfolioRequestEmail,
  sendClientPortfolioApprovedEmail,
  sendProfileChangesRequestedEmail,
  sendProfileApprovedEmail,
  sendProfileSubmittedAdminEmail,
  getAppPublicUrl,
  useConsoleProvider,
};

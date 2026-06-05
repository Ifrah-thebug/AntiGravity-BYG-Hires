/**
 * Transactional email via Resend (client activation, etc.).
 * Falls back to console logging when RESEND_API_KEY is missing or EMAIL_PROVIDER=console.
 */

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

function buildActivationEmailHtml({ name, talentName, activationUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const talentLine = talentName
    ? `Your intro with <strong>${talentName}</strong> is booked.`
    : 'Your intro call is booked.';

  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #ff3d3d; margin: 0 0 16px;">BYG Hires</p>
  <p style="margin: 0 0 12px;">${greeting}</p>
  <p style="margin: 0 0 12px;">${talentLine} Activate your client account to manage intros and access your talent portal.</p>
  <p style="margin: 24px 0;">
    <a href="${activationUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Activate account</a>
  </p>
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
async function sendClientActivationEmail({ to, name, talentName, token }) {
  const intended = String(to || '').trim().toLowerCase();
  if (!intended) throw new Error('Recipient email is required');

  const recipient = resolveRecipient(intended);
  const activationUrl = `${getAppPublicUrl()}/client/activate?token=${encodeURIComponent(token)}`;
  const subject = 'Activate your BYG Hires client account';
  const html = buildActivationEmailHtml({ name, talentName, activationUrl });

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

module.exports = {
  sendClientActivationEmail,
  getAppPublicUrl,
  useConsoleProvider,
};

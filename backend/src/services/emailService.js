// src/services/emailService.js
const sgMail = require('@sendgrid/mail');

dotenvConfig(); // ensure env loaded

function dotenvConfig() {
  try {
    require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
  } catch (e) {
    // ignore if already loaded
  }
}

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (!SENDGRID_API_KEY) {
  console.warn('SendGrid API key not set. Email functions will be no‑ops.');
} else {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

async function sendEmail(to, subject, html, type, extra = {}) {
  if (!SENDGRID_API_KEY) return;
  const msg = {
    to,
    from: 'no-reply@byg-hires.com', // replace with verified sender
    subject,
    html,
    // custom args can be used for analytics
    ...extra
  };
  try {
    await sgMail.send(msg);
    console.log(`[Email] Sent ${type} to ${to}`);
  } catch (err) {
    console.error('SendGrid error:', err);
  }
}

// Welcome email after CV upload
async function sendTalentWelcome(email, name) {
  const subject = "Welcome to BYG Hires Talent Pool";
  const html = `<p>Hi ${name},</p><p>Thank you for submitting your CV. Your profile has been created and you will soon receive an assessment invitation.</p><p>Best regards,<br>BYG Hires Team</p>`;
  await sendEmail(email, subject, html, 'welcome');
}

// Assessment invitation email (used in talent route)
async function sendAssessmentInvite(email, name, token, estimatedTime) {
  const subject = "Your BYG Hires Assessment is Ready";
  const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assessment?token=${token}`;
  const html = `<p>Dear ${name},</p><p>Your assessment (estimated ${estimatedTime} minutes) is ready. Please complete it using the link below. The link will expire in 7 days.</p><p><a href="${link}">Start Assessment</a></p><p>Good luck!</p><p>BYG Hires Team</p>`;
  await sendEmail(email, subject, html, 'assessment_invite');
}

// Decision email (admit/reject/revision)
async function sendDecisionEmail(email, name, decision, score, notes, token) {
  let subject, html;
  if (decision === 'admitted') {
    subject = "Congratulations – You're admitted to BYG Hires";
    html = `<p>Hi ${name},</p><p>We are pleased to inform you that you have been admitted to the BYG Hires Talent Pool with a score of ${score}/100.</p><p>Your profile is now visible to our regional clients.</p><p>Welcome aboard!</p><p>BYG Hires Team</p>`;
  } else if (decision === 'rejected') {
    subject = "Assessment Result – Thank you for applying";
    html = `<p>Hi ${name},</p><p>Thank you for your effort. Unfortunately, we will not be moving forward at this time. Score: ${score}/100.</p><p>Feedback: ${notes || 'N/A'}</p><p>You may reapply after 7 days.</p><p>Best wishes,<br>BYG Hires Team</p>`;
  } else if (decision === 'revision_requested') {
    const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assessment?token=${token}`;
    subject = "Assessment Revision Requested";
    html = `<p>Hi ${name},</p><p>We appreciate your submission. To move forward, please revise your assessment based on the feedback below.</p><p>Feedback: ${notes || 'Please provide more detail.'}</p><p><a href="${link}">Revise Assessment</a> (link valid for 7 days)</p><p>Thank you,<br>BYG Hires Team</p>`;
  }
  await sendEmail(email, subject, html, 'decision');
}

module.exports = { sendTalentWelcome, sendAssessmentInvite, sendDecisionEmail };

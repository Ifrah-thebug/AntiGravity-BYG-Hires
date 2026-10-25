/**
 * Workforce transactional emails. Every send is best-effort: failures are logged,
 * never thrown, so a mail outage cannot break signing or payments.
 */

function mail() {
  return require('../resendEmailService');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

function adminEmails() {
  return String(process.env.WORKFORCE_ADMIN_EMAILS || process.env.WORKFORCE_ADMIN_EMAIL || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function appUrl(path) {
  return `${mail().getAppPublicUrl()}${path}`;
}

function layout({ heading, paragraphs, ctaLabel, ctaHref, footnote }) {
  const { buildEmailLogoHtml } = mail();
  const body = paragraphs.map((p) => `<p style="margin: 0 0 12px;">${p}</p>`).join('\n  ');
  const cta = ctaHref
    ? `<p style="margin: 24px 0;"><a href="${ctaHref}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">${escapeHtml(ctaLabel)}</a></p>`
    : '';
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Montserrat, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${buildEmailLogoHtml()}
  <p style="margin: 0 0 16px; font-size: 18px; font-weight: 800;">${escapeHtml(heading)}</p>
  ${body}
  ${cta}
  ${footnote ? `<p style="margin: 0; font-size: 12px; color: #888;">${footnote}</p>` : ''}
</body>
</html>`.trim();
}

async function send(to, subject, html, logLabel) {
  const recipients = (Array.isArray(to) ? to : [to]).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
  for (const recipient of new Set(recipients)) {
    try {
      await mail().sendTransactionalEmail({ to: recipient, subject, html, logLabel: `workforce:${logLabel}` });
    } catch (err) {
      console.warn(`[workforce] email ${logLabel} → ${recipient} failed:`, err?.message || err);
    }
  }
}

const who = (eng) => escapeHtml(eng.talentName || eng.talentEmail);
const role = (eng) => escapeHtml(eng.roleTitle || 'Remote contractor');

/** New engagement: both parties get the contract to sign. */
async function contractReady(eng) {
  await send(
    eng.talentEmail,
    `Your BYG Hires contract with ${eng.clientName} is ready to sign`,
    layout({
      heading: 'Congratulations — you have an offer',
      paragraphs: [
        `<strong>${escapeHtml(eng.clientName)}</strong> would like to hire you as <strong>${role(eng)}</strong> through BYG Hires.`,
        'Review and sign your Independent Contractor Agreement. Your engagement starts once the client, you and BYG Hires have all signed.',
      ],
      ctaLabel: 'Review & sign',
      ctaHref: appUrl('/talent/workforce'),
      footnote: 'Sign in with the email this message was sent to.',
    }),
    'contract_ready_talent'
  );
  if (eng.clientEmail) {
    await send(
      eng.clientEmail,
      `Sign your BYG Hires contract for ${eng.talentName || 'your new hire'}`,
      layout({
        heading: 'Your hire is in motion',
        paragraphs: [
          `We created the contract for <strong>${who(eng)}</strong> as <strong>${role(eng)}</strong>.`,
          'Sign it from your workspace. Your first invoice is issued as soon as all three parties have signed.',
        ],
        ctaLabel: 'Open workspace',
        ctaHref: appUrl('/client/workforce'),
      }),
      'contract_ready_client'
    );
  }
  await send(
    adminEmails(),
    `[Workforce] New hire: ${eng.talentName || eng.talentEmail} → ${eng.clientName}`,
    layout({
      heading: 'New engagement created',
      paragraphs: [`${who(eng)} → <strong>${escapeHtml(eng.clientName)}</strong> as ${role(eng)}.`, 'BYG signs once the client and talent have signed.'],
      ctaLabel: 'Open Workforce',
      ctaHref: appUrl('/admin/workforce'),
    }),
    'contract_ready_admin'
  );
}

/** Client + talent signed → BYG countersignature needed. */
async function awaitingBygSignature(eng) {
  await send(
    adminEmails(),
    `[Workforce] Countersign: ${eng.talentName || eng.talentEmail} → ${eng.clientName}`,
    layout({
      heading: 'Client and talent have signed',
      paragraphs: [`${who(eng)} → <strong>${escapeHtml(eng.clientName)}</strong>. Countersign as BYG Hires to activate the engagement.`],
      ctaLabel: 'Countersign',
      ctaHref: appUrl('/admin/workforce'),
    }),
    'awaiting_byg'
  );
}

/** Start date changed before full signature; anyone who had signed must sign again. */
async function contractUpdated(eng, { clearedRoles = [], actorEmail = null } = {}) {
  const resign = clearedRoles.length > 0;
  const paragraphs = [
    `The start date for <strong>${role(eng)}</strong> (${who(eng)} → <strong>${escapeHtml(eng.clientName)}</strong>) is now <strong>${escapeHtml(eng.startDate)}</strong>.`,
    resign ? 'Because the contract changed, earlier signatures were cleared — please review and sign the updated version.' : 'Please review the updated contract before signing.',
  ];
  const recipients = [
    [eng.talentEmail, '/talent/workforce?tab=contracts'],
    [eng.clientEmail, '/client/workforce?tab=contracts'],
  ].filter(([email]) => email && email.toLowerCase() !== String(actorEmail || '').toLowerCase());
  for (const [email, path] of recipients) {
    await send(
      email,
      `Updated BYG Hires contract: new start date ${eng.startDate}`,
      layout({ heading: 'Your contract was updated', paragraphs, ctaLabel: 'Review contract', ctaHref: appUrl(path) }),
      'contract_updated'
    );
  }
  if (resign && clearedRoles.includes('byg')) await awaitingBygSignature(eng);
}

async function engagementActive(eng) {
  await send(
    eng.talentEmail,
    `You're hired — ${eng.clientName} engagement is active`,
    layout({
      heading: 'Contract fully signed',
      paragraphs: [
        `Your engagement with <strong>${escapeHtml(eng.clientName)}</strong> as <strong>${role(eng)}</strong> is now active (start ${escapeHtml(eng.startDate)}).`,
        'Add your payout details in your workspace so BYG Hires can pay you as soon as each invoice is funded.',
      ],
      ctaLabel: 'Add payout details',
      ctaHref: appUrl('/talent/workforce?tab=payouts'),
    }),
    'engagement_active'
  );
}

async function invoiceIssued(invoice, eng, { autoPaid = false } = {}) {
  if (!invoice?.clientEmail) return;
  const period = invoice.periodStart ? ` for ${invoice.periodStart} → ${invoice.periodEnd}` : '';
  await send(
    invoice.clientEmail,
    autoPaid
      ? `Invoice ${invoice.invoiceNumber} paid from your BYG wallet`
      : `Invoice ${invoice.invoiceNumber} — ${money(invoice.total, invoice.currency)} due ${invoice.dueDate}`,
    layout({
      heading: autoPaid ? 'Invoice paid from wallet' : 'New invoice',
      paragraphs: [
        `${autoPaid ? 'We paid' : 'Your invoice'} <strong>${escapeHtml(invoice.invoiceNumber)}</strong> (${money(invoice.total, invoice.currency)})${escapeHtml(period)} for <strong>${eng ? who(eng) : 'your contractor'}</strong>${autoPaid ? ' from your wallet balance.' : '.'}`,
        autoPaid ? 'No action needed.' : 'Pay by card or from your wallet balance in your workspace.',
      ],
      ctaLabel: autoPaid ? 'View invoices' : 'Pay invoice',
      ctaHref: appUrl('/client/workforce?tab=invoices'),
    }),
    autoPaid ? 'invoice_autopaid' : 'invoice_issued'
  );
}

async function payoutSent(payout, eng) {
  if (!eng?.talentEmail) return;
  await send(
    eng.talentEmail,
    `Payment sent: ${money(payout.amount, payout.currency)}`,
    layout({
      heading: 'Your payout is on its way',
      paragraphs: [
        `BYG Hires sent <strong>${money(payout.amount, payout.currency)}</strong> for your work with <strong>${escapeHtml(eng.clientName)}</strong>.`,
        `Reference: <strong>${escapeHtml(payout.providerRef || '—')}</strong>. Bank transfers can take 1–3 business days to arrive.`,
      ],
      ctaLabel: 'View payments',
      ctaHref: appUrl('/talent/workforce?tab=payouts'),
    }),
    'payout_sent'
  );
}

async function signatureOtp(email, otp) {
  await send(
    email,
    `Your BYG Hires signing code: ${otp}`,
    layout({
      heading: 'Contract signing code',
      paragraphs: [`Your one-time code is <strong style="font-size: 22px; letter-spacing: 0.2em;">${escapeHtml(otp)}</strong>`, 'It expires in 15 minutes.'],
      footnote: 'If you did not request this, you can ignore this email.',
    }),
    'otp'
  );
}

async function jobPosted(job) {
  await send(
    adminEmails(),
    `[Jobs] ${job.clientName || job.clientEmail} posted: ${job.title}`,
    layout({
      heading: 'New job requisition',
      paragraphs: [
        `<strong>${escapeHtml(job.clientName || job.clientEmail)}</strong> is hiring <strong>${escapeHtml(job.title)}</strong> (×${job.headcount}).`,
        'Shortlist candidates from the directory.',
      ],
      ctaLabel: 'Open jobs',
      ctaHref: appUrl('/admin/workforce?tab=jobs'),
    }),
    'job_posted'
  );
}

async function candidatesShortlisted(job, names) {
  if (!job?.clientEmail || !names.length) return;
  await send(
    job.clientEmail,
    `BYG shortlisted ${names.length} candidate${names.length > 1 ? 's' : ''} for ${job.title}`,
    layout({
      heading: 'New candidates for your role',
      paragraphs: [
        `We added ${names.map((n) => `<strong>${escapeHtml(n)}</strong>`).join(', ')} to your <strong>${escapeHtml(job.title)}</strong> pipeline.`,
        'Book intros, move candidates through interviews, and hire when you are ready.',
      ],
      ctaLabel: 'Review pipeline',
      ctaHref: appUrl('/client/workforce?tab=jobs'),
    }),
    'job_shortlist'
  );
}

module.exports = {
  contractReady,
  awaitingBygSignature,
  contractUpdated,
  engagementActive,
  invoiceIssued,
  payoutSent,
  signatureOtp,
  jobPosted,
  candidatesShortlisted,
};

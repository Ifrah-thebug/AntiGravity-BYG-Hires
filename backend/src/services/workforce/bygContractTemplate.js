/**
 * BYG Hires — Independent Contractor Agreement (HTML template).
 * Placeholders: {{role_title}}, {{salary_amount}}, {{currency}}, {{cadence}},
 * {{start_date}}, {{talent_name}}, {{talent_email}}, {{client_name}}, {{client_email}},
 * {{byg_fee_percent}}, {{company_name}}
 */

const BYG_CONTRACT_NAME = 'BYG Hires Independent Contractor Agreement';
const BYG_CONTRACT_VERSION = 2;

const BYG_CONTRACT_REQUIRED_FIELDS = [
  'company_name',
  'role_title',
  'salary_amount',
  'currency',
  'cadence',
  'start_date',
  'talent_name',
  'talent_email',
  'client_name',
  'client_email',
  'byg_fee_percent',
];

const BYG_CONTRACT_HTML = `
<article class="byg-contract" style="font-family:Georgia,serif;color:#111;line-height:1.55;max-width:42rem;margin:0 auto;">
  <header style="border-bottom:2px solid #111;padding-bottom:1rem;margin-bottom:1.25rem;">
    <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;color:#e11;">BYG HIRES</p>
    <h1 style="margin:0.35rem 0 0;font-size:1.45rem;font-weight:800;">Independent Contractor Agreement</h1>
    <p style="margin:0.4rem 0 0;font-size:13px;color:#555;">Platform-managed remote engagement</p>
  </header>

  <p style="font-size:14px;">This Independent Contractor Agreement (the “Agreement”) is entered into as of <strong>{{start_date}}</strong> by and among:</p>
  <ol style="font-size:14px;padding-left:1.2rem;">
    <li><strong>{{company_name}}</strong> (“BYG Hires” / “Platform”), facilitating remote talent placement;</li>
    <li><strong>{{client_name}}</strong> (“Client”), email <strong>{{client_email}}</strong>; and</li>
    <li><strong>{{talent_name}}</strong> (“Contractor”), email <strong>{{talent_email}}</strong>.</li>
  </ol>

  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">1. Engagement &amp; Services</h2>
  <p style="font-size:14px;">Client engages Contractor through BYG Hires to perform services as <strong>{{role_title}}</strong> (the “Services”). Contractor will perform the Services professionally, in good faith, and consistent with Client’s reasonable instructions communicated via BYG Hires.</p>

  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">2. Compensation</h2>
  <p style="font-size:14px;">Contractor’s agreed rate is <strong>{{salary_amount}} {{currency}}</strong> per <strong>{{cadence}}</strong> period, subject to BYG Hires payroll cycles. BYG Hires may charge Client a platform fee of <strong>{{byg_fee_percent}}%</strong> on top of Contractor compensation. Payment to Contractor is due after Client funds the corresponding invoice, less any lawful withholdings or agreed deductions.</p>

  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">3. Term</h2>
  <p style="font-size:14px;">This Agreement begins on <strong>{{start_date}}</strong> and continues until ended by either Client or Contractor with written notice through BYG Hires, or immediately for material breach, misconduct, or non-payment.</p>

  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">4. Independent Contractor Status</h2>
  <p style="font-size:14px;">Contractor is an independent contractor, not an employee of Client or BYG Hires. Contractor is responsible for taxes, benefits, equipment (unless otherwise agreed), and compliance with applicable laws in their jurisdiction. Nothing in this Agreement creates a partnership, joint venture, or employment relationship.</p>

  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">5. Confidentiality</h2>
  <p style="font-size:14px;">Contractor will keep confidential all non-public Client and BYG Hires information learned during the engagement, and will not disclose it except as required to perform the Services or by law. This duty survives termination.</p>

  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">6. Intellectual Property</h2>
  <p style="font-size:14px;">Work product created specifically for Client under this Agreement is assigned to Client upon full payment for the related period, unless otherwise agreed in writing. Contractor retains pre-existing tools, libraries, and generic know-how.</p>

  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">7. Platform Role</h2>
  <p style="font-size:14px;">BYG Hires provides matching, contracting, invoicing, and payout facilitation. BYG Hires is not liable for day-to-day work quality disputes between Client and Contractor beyond facilitating good-faith resolution. Client funds each billing period in advance by card (Tap Payments), bank transfer, or a prepaid BYG Hires wallet balance; BYG Hires disburses Contractor compensation after the corresponding invoice is funded.</p>

  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">8. Representations</h2>
  <p style="font-size:14px;">Each party represents they have authority to enter this Agreement and that the information provided (role, rate, identity, contact details) is accurate.</p>

  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">9. Governing Law</h2>
  <p style="font-size:14px;">This Agreement is governed by the laws applicable to BYG Hires’ principal place of business, without regard to conflict-of-law rules, unless the parties agree otherwise in writing.</p>

  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">10. Entire Agreement &amp; Signatures</h2>
  <p style="font-size:14px;">This Agreement (including the engagement terms stored in BYG Hires) is the entire understanding for this engagement. Electronic signatures (drawn or typed name + consent) are valid and binding.</p>

  <div style="margin-top:1.75rem;padding-top:1rem;border-top:1px solid #ddd;font-size:13px;color:#333;">
    <p style="margin:0 0 0.5rem;"><strong>Company:</strong> {{company_name}}</p>
    <p style="margin:0 0 0.5rem;"><strong>Client:</strong> {{client_name}} ({{client_email}})</p>
    <p style="margin:0;"><strong>Contractor:</strong> {{talent_name}} ({{talent_email}})</p>
  </div>
</article>
`.trim();

/** Field values come from client/admin input — always escaped before they reach HTML. */
function renderContractHtml(templateHtml, fields = {}) {
  return String(templateHtml || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = fields[key];
    return val == null ? '' : escapeHtml(val);
  });
}

const SIGNATURE_IMAGE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_SIGNATURE_IMAGE_CHARS = 400_000;

/**
 * Accept a typed name (≤ 120 chars) or a PNG data-URL from the signature pad.
 * Returns the cleaned value or null when invalid.
 */
function normalizeSignatureData(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) {
    if (raw.length > MAX_SIGNATURE_IMAGE_CHARS || !SIGNATURE_IMAGE.test(raw)) return null;
    return raw;
  }
  const typed = raw.replace(/\s+/g, ' ');
  return typed.length >= 2 && typed.length <= 120 ? typed : null;
}

function buildFilledFields(eng, salary) {
  return {
    company_name: 'BYG Hires',
    role_title: eng.roleTitle || 'Remote contractor',
    salary_amount: String(salary.amount),
    currency: salary.currency || 'USD',
    cadence: salary.cadence || 'monthly',
    start_date: eng.startDate,
    talent_name: eng.talentName || eng.talentEmail,
    talent_email: eng.talentEmail,
    client_name: eng.clientName,
    client_email: eng.clientEmail || '',
    byg_fee_percent: String(salary.bygFeePercent ?? 0),
  };
}

function roleLabel(role) {
  if (role === 'byg') return 'BYG Hires (Platform)';
  if (role === 'client') return 'Client';
  if (role === 'talent') return 'Contractor';
  return role;
}

/**
 * Append / refresh signature block on rendered contract HTML.
 * signatureData may be a PNG data-URL or a typed name.
 */
function stampSignaturesOnHtml(html, signatures = []) {
  const cleaned = String(html || '').replace(/<section\s+class="byg-signatures"[\s\S]*?<\/section>/gi, '');
  const cells = ['client', 'talent', 'byg']
    .map((role) => {
      const sig = signatures.find((s) => s.role === role && s.signedAt);
      let body = '<p style="margin:0;color:#999;font-size:12px;">Awaiting signature</p>';
      if (sig) {
        const data = String(sig.signatureData || '');
        if (SIGNATURE_IMAGE.test(data)) {
          body = `<img src="${data}" alt="${role} signature" style="max-width:100%;height:56px;object-fit:contain;" />`;
        } else {
          body = `<p style="margin:0;font-family:Georgia,serif;font-size:22px;font-style:italic;">${escapeHtml(data)}</p>`;
        }
        body += `<p style="margin:0.35rem 0 0;font-size:11px;color:#555;">${escapeHtml(sig.signerEmail || '')}<br/>${escapeHtml(
          String(sig.signedAt || '').slice(0, 19).replace('T', ' ')
        )} UTC</p>`;
      }
      return `<div style="border:1px solid #ddd;border-radius:8px;padding:0.75rem;min-height:7rem;">
        <p style="margin:0 0 0.5rem;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#666;">${roleLabel(role)}</p>
        ${body}
      </div>`;
    })
    .join('');

  const block = `
<section class="byg-signatures" style="margin-top:2rem;padding-top:1.25rem;border-top:2px solid #111;">
  <h2 style="font-size:1rem;margin:0 0 1rem;">Signatures</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;">
    ${cells}
  </div>
</section>`.trim();

  return `${cleaned}\n${block}`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isFullySigned(roles) {
  const set = new Set(roles || []);
  return set.has('client') && set.has('talent') && set.has('byg');
}

module.exports = {
  BYG_CONTRACT_NAME,
  BYG_CONTRACT_VERSION,
  BYG_CONTRACT_REQUIRED_FIELDS,
  BYG_CONTRACT_HTML,
  renderContractHtml,
  normalizeSignatureData,
  buildFilledFields,
  stampSignaturesOnHtml,
  isFullySigned,
};

-- BYG Hires Independent Contractor Agreement v2
-- Run after workforce_hris.sql. Safe to re-run.

ALTER TABLE public.wf_contracts
  ADD COLUMN IF NOT EXISTS rendered_html text;

UPDATE public.wf_contract_templates
SET active = false
WHERE active = true;

INSERT INTO public.wf_contract_templates (name, version, body_html, required_fields, active)
SELECT
  'BYG Hires Independent Contractor Agreement',
  2,
  $html$
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
  <p style="font-size:14px;">BYG Hires provides matching, contracting, invoicing, and payout facilitation. BYG Hires is not liable for day-to-day work quality disputes between Client and Contractor beyond facilitating good-faith resolution. Live payment rails may be added later; until then, ledgered / manual settlement applies.</p>
  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">8. Representations</h2>
  <p style="font-size:14px;">Each party represents they have authority to enter this Agreement and that the information provided (role, rate, identity, contact details) is accurate.</p>
  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">9. Governing Law</h2>
  <p style="font-size:14px;">This Agreement is governed by the laws applicable to BYG Hires’ principal place of business, without regard to conflict-of-law rules, unless the parties agree otherwise in writing.</p>
  <h2 style="font-size:1rem;margin:1.4rem 0 0.5rem;">10. Entire Agreement &amp; Signatures</h2>
  <p style="font-size:14px;">This Agreement (including the engagement terms stored in BYG Hires) is the entire understanding for this engagement. Electronic signatures (typed name + consent) are valid and binding.</p>
  <div style="margin-top:1.75rem;padding-top:1rem;border-top:1px solid #ddd;font-size:13px;color:#333;">
    <p style="margin:0 0 0.5rem;"><strong>Company:</strong> {{company_name}}</p>
    <p style="margin:0 0 0.5rem;"><strong>Client:</strong> {{client_name}} ({{client_email}})</p>
    <p style="margin:0;"><strong>Contractor:</strong> {{talent_name}} ({{talent_email}})</p>
  </div>
</article>
$html$,
  '["company_name","role_title","salary_amount","currency","cadence","start_date","talent_name","talent_email","client_name","client_email","byg_fee_percent"]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.wf_contract_templates
  WHERE name = 'BYG Hires Independent Contractor Agreement' AND version = 2
);

UPDATE public.wf_contract_templates
SET
  active = true,
  body_html = (
    SELECT body_html FROM public.wf_contract_templates t2
    WHERE t2.name = 'BYG Hires Independent Contractor Agreement' AND t2.version = 2
    LIMIT 1
  ),
  required_fields = '["company_name","role_title","salary_amount","currency","cadence","start_date","talent_name","talent_email","client_name","client_email","byg_fee_percent"]'::jsonb
WHERE name = 'BYG Hires Independent Contractor Agreement' AND version = 2;

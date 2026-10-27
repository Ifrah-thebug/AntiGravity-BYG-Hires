/**
 * BYG Hires — client-facing invoice document (print / Save as PDF).
 */

function money(amount, currency = 'USD') {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} invoice mapped invoice
 * @param {object} [eng] engagement (optional)
 * @param {Array<{description, amount}>} [lines]
 */
function renderInvoiceHtml(invoice, eng = null, lines = []) {
  const lineRows =
    lines.length > 0
      ? lines
      : [
          { description: 'Contractor compensation', amount: invoice.subtotal },
          { description: 'BYG Hires platform fee', amount: invoice.feeAmount },
        ];

  const rows = lineRows
    .map(
      (l) => `
    <tr>
      <td style="padding:0.65rem 0;border-bottom:1px solid #eee;font-size:13px;">${escapeHtml(l.description)}</td>
      <td style="padding:0.65rem 0;border-bottom:1px solid #eee;font-size:13px;text-align:right;white-space:nowrap;">${money(
        l.amount,
        invoice.currency
      )}</td>
    </tr>`
    )
    .join('');

  return `
<article class="byg-invoice" style="font-family:Georgia,serif;color:#111;line-height:1.45;max-width:40rem;margin:0 auto;padding:1.5rem;">
  <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;border-bottom:2px solid #111;padding-bottom:1rem;margin-bottom:1.25rem;">
    <div>
      <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;color:#e11;">BYG HIRES</p>
      <h1 style="margin:0.35rem 0 0;font-size:1.5rem;font-weight:800;">Invoice</h1>
      <p style="margin:0.35rem 0 0;font-size:12px;color:#666;">Confidential — for client billing only</p>
    </div>
    <div style="text-align:right;font-size:13px;">
      <p style="margin:0;font-weight:700;">${escapeHtml(invoice.invoiceNumber)}</p>
      <p style="margin:0.25rem 0 0;color:#555;">Status: <strong>${escapeHtml(String(invoice.status || '').toUpperCase())}</strong></p>
      ${invoice.dueDate ? `<p style="margin:0.25rem 0 0;color:#555;">Due: ${escapeHtml(invoice.dueDate)}</p>` : ''}
    </div>
  </header>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;font-size:13px;">
    <div>
      <p style="margin:0 0 0.35rem;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#888;font-weight:700;">Bill to</p>
      <p style="margin:0;font-weight:700;">${escapeHtml(invoice.clientName || 'Client')}</p>
      <p style="margin:0.2rem 0 0;color:#555;">${escapeHtml(invoice.clientEmail || '')}</p>
    </div>
    <div>
      <p style="margin:0 0 0.35rem;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#888;font-weight:700;">From</p>
      <p style="margin:0;font-weight:700;">BYG Hires</p>
      <p style="margin:0.2rem 0 0;color:#555;">Platform contractor billing</p>
      ${
        eng
          ? `<p style="margin:0.5rem 0 0;color:#555;">Engagement: ${escapeHtml(eng.roleTitle || '')}<br/>Talent: ${escapeHtml(
              eng.talentName || eng.talentEmail || ''
            )}</p>`
          : ''
      }
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:1rem;">
    <thead>
      <tr>
        <th style="text-align:left;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#888;padding-bottom:0.5rem;border-bottom:1px solid #ccc;">Description</th>
        <th style="text-align:right;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#888;padding-bottom:0.5rem;border-bottom:1px solid #ccc;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="margin-left:auto;max-width:14rem;font-size:13px;">
    <div style="display:flex;justify-content:space-between;padding:0.25rem 0;color:#555;">
      <span>Subtotal</span><span>${money(invoice.subtotal, invoice.currency)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:0.25rem 0;color:#555;">
      <span>Platform fee</span><span>${money(invoice.feeAmount, invoice.currency)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:0.6rem 0 0;margin-top:0.4rem;border-top:2px solid #111;font-weight:800;font-size:1.05rem;">
      <span>Total due</span><span>${money(invoice.total, invoice.currency)}</span>
    </div>
  </div>

  <footer style="margin-top:2rem;padding-top:1rem;border-top:1px solid #ddd;font-size:11px;color:#777;">
    <p style="margin:0;">Pay BYG Hires per your agreed funding process. This invoice is visible only to the client and BYG Hires admin — not to talent.</p>
    ${invoice.paidAt ? `<p style="margin:0.5rem 0 0;">Paid at ${escapeHtml(String(invoice.paidAt).slice(0, 19).replace('T', ' '))} UTC</p>` : ''}
  </footer>
</article>`.trim();
}

function wrapInvoicePrintDocument(innerHtml, title = 'BYG Hires Invoice') {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 16mm; size: A4; }
    body { margin: 0; background: #fff; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${innerHtml}
<script>window.onload=function(){try{window.focus();window.print();}catch(e){}}</script>
</body>
</html>`;
}

module.exports = {
  renderInvoiceHtml,
  wrapInvoicePrintDocument,
};

/** Open invoice HTML in a new window and trigger browser Print → Save as PDF. */
export function openInvoicePdf(printHtml) {
  const w = window.open('', '_blank');
  if (!w) {
    throw new Error('Pop-up blocked — allow pop-ups to view / save the invoice PDF.');
  }
  w.document.open();
  w.document.write(printHtml);
  w.document.close();
}

function escapeTitle(s) {
  return String(s || '').replace(/[<>&"]/g, '');
}

/**
 * Print / Save as PDF for a contract. `contractHtml` is the server-rendered
 * (field-escaped) agreement including the signature block.
 */
export function openContractPdf(contractHtml, title = 'BYG Hires contract') {
  openInvoicePdf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeTitle(title)}</title>
<style>
  body { margin: 0; padding: 2rem 1.25rem; background: #fff; }
  @media print { body { padding: 0; } @page { margin: 18mm 16mm; } }
</style>
</head>
<body>
${contractHtml}
<script>window.onload=function(){try{window.focus();window.print();}catch(e){}}</script>
</body>
</html>`);
}

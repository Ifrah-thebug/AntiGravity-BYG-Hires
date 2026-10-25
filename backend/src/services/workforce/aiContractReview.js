/**
 * Contract policy review via Groq (falls back to deterministic checks).
 */
const groq = require('../groqClient');
const { BYG_CONTRACT_REQUIRED_FIELDS, renderContractHtml } = require('./bygContractTemplate');

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function deterministicReview({ filledFields, salary, requiredFields }) {
  const required = requiredFields?.length ? requiredFields : BYG_CONTRACT_REQUIRED_FIELDS;
  const findings = [];

  for (const key of required) {
    const val = filledFields?.[key];
    if (val == null || String(val).trim() === '') {
      findings.push({ severity: 'error', code: 'MISSING_FIELD', field: key, message: `Missing ${key}` });
    }
  }

  if (salary) {
    const amt = Number(filledFields?.salary_amount);
    if (!Number.isFinite(amt) || roundMoney(amt) !== roundMoney(salary.amount)) {
      findings.push({
        severity: 'error',
        code: 'SALARY_MISMATCH',
        message: `Contract salary ${amt} does not match schedule ${salary.amount}`,
      });
    }
    if (String(filledFields?.currency || '').toUpperCase() !== String(salary.currency || '').toUpperCase()) {
      findings.push({ severity: 'error', code: 'CURRENCY_MISMATCH', message: 'Currency mismatch vs salary schedule' });
    }
    if (filledFields?.cadence && filledFields.cadence !== salary.cadence) {
      findings.push({ severity: 'error', code: 'CADENCE_MISMATCH', message: 'Cadence mismatch vs salary schedule' });
    }
  }

  if (String(filledFields?.company_name || '').toLowerCase().replace(/\s+/g, '') !== 'byghires') {
    findings.push({
      severity: 'error',
      code: 'COMPANY_NAME',
      message: 'Company must be BYG Hires',
    });
  }

  const status = findings.length ? 'needs_fixes' : 'pass';
  return { status, findings, source: 'rules' };
}

function extractJson(text) {
  const raw = String(text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(body.slice(start, end + 1));
  }
  return JSON.parse(body);
}

async function groqReview({ renderedHtml, filledFields, salary }) {
  if (!groq.isGroqEnabled()) return null;

  const prompt = `You are a contract compliance checker for BYG Hires (company name must be "BYG Hires").
Review this independent contractor agreement for remote talent placement.

Return ONLY valid JSON:
{
  "status": "pass" | "needs_fixes" | "escalate",
  "findings": [{ "severity": "error"|"warn", "code": "STRING", "message": "..." }],
  "summary": "one sentence"
}

Rules:
- Company/platform must be BYG Hires (not another brand).
- Role, rate, currency, cadence, start date, talent and client identities must be present and consistent with the engagement data.
- Flag missing parties, zero/negative pay, contradictory terms, or clauses that waive all contractor rights unfairly.
- Do NOT invent legal advice beyond a checklist. Prefer "pass" when the draft is coherent and complete.

Engagement data:
${JSON.stringify({ filledFields, salary }, null, 2)}

Contract HTML:
${renderedHtml.slice(0, 12000)}
`;

  const text = await groq.callGroqText(prompt, {
    model: groq.getDefaultModel(),
    temperature: 0.1,
    maxOutputTokens: 1200,
    timeoutMs: 45000,
  });
  const parsed = extractJson(text);
  const status = ['pass', 'needs_fixes', 'escalate'].includes(parsed.status) ? parsed.status : 'needs_fixes';
  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
  return {
    status,
    findings,
    summary: parsed.summary || '',
    source: `groq:${groq.getDefaultModel()}`,
    raw: text,
  };
}

/**
 * Run rules first; if rules pass and Groq is enabled, also ask Groq.
 * Any error findings block signing.
 */
async function reviewContractContent({ filledFields, salary, requiredFields, templateHtml }) {
  const renderedHtml = renderContractHtml(templateHtml, filledFields);
  const rules = deterministicReview({ filledFields, salary, requiredFields });

  if (rules.status !== 'pass') {
    return { ...rules, renderedHtml };
  }

  try {
    const ai = await groqReview({ renderedHtml, filledFields, salary });
    if (!ai) return { ...rules, renderedHtml };
    const mergedFindings = [...rules.findings, ...(ai.findings || [])];
    const blocked = mergedFindings.some((f) => f.severity === 'error') || ai.status !== 'pass';
    return {
      status: blocked ? (ai.status === 'escalate' ? 'escalate' : 'needs_fixes') : 'pass',
      findings: mergedFindings,
      summary: ai.summary,
      source: ai.source,
      raw: ai.raw,
      renderedHtml,
    };
  } catch (err) {
    console.warn('[workforce] Groq contract review failed, using rules only:', err?.message || err);
    return {
      ...rules,
      renderedHtml,
      summary: 'Groq unavailable — passed local policy checks only.',
      source: 'rules+groq_fallback',
    };
  }
}

module.exports = {
  deterministicReview,
  reviewContractContent,
  groqReview,
};

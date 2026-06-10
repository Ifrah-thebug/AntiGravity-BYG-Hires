/**
 * Lightweight email extraction from CV files (no Gemini).
 */

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const IGNORE_EMAIL_PATTERNS = [
  /noreply@/i,
  /no-reply@/i,
  /donotreply@/i,
  /example\.com$/i,
  /linkedin\.com$/i,
  /github\.com$/i,
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isUsableEmail(email) {
  const e = normalizeEmail(email);
  if (!e || e.length > 254) return false;
  return !IGNORE_EMAIL_PATTERNS.some((re) => re.test(e));
}

function scoreEmail(email) {
  const e = normalizeEmail(email);
  let score = 0;
  if (/^(info|contact|hello|admin|support|hr)@/i.test(e)) score -= 2;
  if (/gmail\.com|outlook\.com|yahoo\.com|hotmail\.com|icloud\.com/i.test(e)) score += 3;
  if (e.length < 30) score += 1;
  return score;
}

function pickBestEmail(text) {
  const matches = String(text || '').match(EMAIL_REGEX) || [];
  const unique = [...new Set(matches.map(normalizeEmail).filter(isUsableEmail))];
  if (!unique.length) return null;
  unique.sort((a, b) => scoreEmail(b) - scoreEmail(a));
  return unique[0];
}

async function extractTextFromPdf(buffer) {
  let parser;
  try {
    const { PDFParse } = require('pdf-parse');
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result?.text || '';
  } catch (err) {
    console.warn('[cvEmailExtract] PDF parse failed:', err?.message || err);
    return '';
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

function nameFromFilename(filename) {
  const base = String(filename || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(cv|resume)\b/gi, '')
    .trim();
  if (!base || /^\d+$/.test(base)) return '';
  return base
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} filename
 */
async function extractEmailFromCv(buffer, mimeType, filename) {
  const mime = String(mimeType || '').toLowerCase();
  let text = '';

  if (mime.includes('pdf') || String(filename || '').toLowerCase().endsWith('.pdf')) {
    text = await extractTextFromPdf(buffer);
  } else {
    // Plain text fallback for .txt; DOCX not supported in v1
    text = buffer.toString('utf8');
  }

  const email = pickBestEmail(text);
  const name = nameFromFilename(filename);

  return {
    email,
    name,
    emailExtractStatus: email ? 'found' : 'missing',
  };
}

module.exports = {
  extractEmailFromCv,
  pickBestEmail,
  nameFromFilename,
};

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

function formatNameWords(words) {
  return words
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function normalizeNameKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function nameFromFilename(filename) {
  let base = String(filename || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b(cv|resume)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base || /^\d+$/.test(base)) return '';
  return formatNameWords(base.split(/\s+/));
}

function looksLikePersonName(line) {
  const s = String(line || '').trim().replace(/\s{2,}/g, ' ');
  if (!s || s.length > 70) return false;
  if (/@|https?:|www\.|linkedin|github|phone|tel:|\+?\d[\d\s().-]{7,}/i.test(s)) return false;
  if (/^(curriculum|resume|cv|profile|contact|objective|summary|experience|education)\b/i.test(s)) {
    return false;
  }
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  return words.every((w) => /^[A-Za-z][A-Za-z.'-]{0,24}$/.test(w));
}

function nameFromPdfText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (looksLikePersonName(lines[i])) {
      return formatNameWords(lines[i].split(/\s+/));
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (EMAIL_REGEX.test(lines[i])) {
      for (let j = Math.max(0, i - 4); j < i; j++) {
        if (looksLikePersonName(lines[j])) {
          return formatNameWords(lines[j].split(/\s+/));
        }
      }
    }
  }

  return '';
}

function isLikelyBadExtractedName(name, filename) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return true;

  const key = normalizeNameKey(trimmed);
  if (/resume|curriculumvitae/.test(key)) return true;
  if (!trimmed.includes(' ') && key.length > 18) return true;

  const fileStem = normalizeNameKey(
    String(filename || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, '')
  );
  if (fileStem && key === fileStem) return true;
  if (fileStem && fileStem.includes(key) && key.length >= 10) return true;

  return false;
}

function pickBestName({ textName, fileName }) {
  const fromText = String(textName || '').trim();
  const fromFile = String(fileName || '').trim();

  if (fromText && !isLikelyBadExtractedName(fromText)) return fromText;
  if (fromFile && !isLikelyBadExtractedName(fromFile)) return fromFile;
  return fromText || fromFile || '';
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
  const name = pickBestName({
    textName: nameFromPdfText(text),
    fileName: nameFromFilename(filename),
  });

  return {
    email,
    name: name || null,
    emailExtractStatus: email ? 'found' : 'missing',
  };
}

module.exports = {
  extractEmailFromCv,
  pickBestEmail,
  nameFromFilename,
  nameFromPdfText,
  isLikelyBadExtractedName,
  pickBestName,
};

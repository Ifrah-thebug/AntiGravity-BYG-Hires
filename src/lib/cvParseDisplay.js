const FRIENDLY_DEFAULT =
  'Our AI reader tried several times but could not extract your profile. Please re-upload a clear PDF for the best results.';

const FRIENDLY_TRANSIENT =
  'CV parsing is temporarily unavailable. Please wait a moment and re-upload your CV.';

const TECHNICAL_PATTERN =
  /buffer is not defined|syntaxerror|typeerror|referenceerror|json\.parse|gemini api|undefined|networkerror|failed to fetch|econnreset|enotfound|at position \d+/i;

/** Map raw parser/API errors to candidate-friendly copy. */
export function friendlyCvParseMessage(raw) {
  const text = String(raw || '').trim();
  if (!text) return FRIENDLY_DEFAULT;

  if (/temporarily unavailable/i.test(text)) return FRIENDLY_TRANSIENT;
  if (/please re-upload/i.test(text) || /^we could not/i.test(text)) return text;
  if (TECHNICAL_PATTERN.test(text)) return FRIENDLY_DEFAULT;

  return text.length > 160 ? FRIENDLY_DEFAULT : text;
}

export function cvParseHeadline(context = 'signup') {
  return context === 'invite'
    ? "We couldn't read your CV on file"
    : "We couldn't read your CV";
}

/**
 * Title-case one name token (letters only; keeps hyphens/apostrophes).
 * "ifrah" → "Ifrah", "o'brien" → "O'Brien", "mary-jane" → "Mary-Jane"
 */
function capitalizeToken(token) {
  if (!token) return '';
  return token.replace(/[a-zA-Z]+/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

/**
 * Canonical full name for DB + talent portal (title case, collapsed spaces).
 * @example "i frah i rshad" → "Ifrah Irshad"
 */
export function normalizeProfileName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.map(capitalizeToken).join(' ');
}

/** First name only, title-cased — for "Ready to bring Aaqib on board?" */
export function formatFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return capitalizeToken(parts[0]);
}

/**
 * Public talent display — normalizes messy uploads and formats as "First L."
 * @example "IfRaH irshad" → "Ifrah I."
 */
export function formatDisplayName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';

  const firstName = capitalizeToken(parts[0]);
  if (parts.length === 1) return firstName;

  const lastPart = parts[parts.length - 1];

  // Already stored as "First L" or "First L."
  if (parts.length === 2 && /^[A-Za-z]\.?$/.test(lastPart)) {
    const initial = lastPart.replace(/\.$/, '').toUpperCase();
    return `${firstName} ${initial}.`;
  }

  const lastInitial = lastPart.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase();
  if (!lastInitial) return firstName;

  return `${firstName} ${lastInitial}.`;
}

/** Initials + stable hue for avatar fallbacks (same formula as web). */
export function avatarFromName(name) {
  const value = String(name || '');
  const initials = value
    ? value.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const hue = value ? (value.charCodeAt(0) * 37 + (value.charCodeAt(1) || 0) * 17) % 360 : 200;
  return { initials, hue };
}

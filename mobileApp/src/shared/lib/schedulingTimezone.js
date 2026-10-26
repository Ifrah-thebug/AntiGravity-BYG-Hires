/** Talent intro slots — device timezone + formatting (port of web clientSchedulingTimezone). */

const FALLBACK_TZ = 'UTC';

function isValidIanaTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Device/OS timezone. */
export function getDeviceTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidIanaTimeZone(tz)) return tz;
  } catch {
    /* ignore */
  }
  return FALLBACK_TZ;
}

export function getTimeZoneLabel(timeZone) {
  if (!timeZone) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (name) return name;
  } catch {
    /* ignore */
  }
  return timeZone.replace(/_/g, ' ');
}

export function formatIntroWeekday(iso, timeZone) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', timeZone });
}

export function formatIntroDate(iso, timeZone) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  });
}

export function formatIntroTime(iso, timeZone) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

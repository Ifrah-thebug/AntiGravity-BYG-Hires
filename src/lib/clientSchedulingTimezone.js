/** Client (booker) timezone for intro slots — network (IP) first, then device clock. */

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

/** Device/OS timezone (VPN does not change this). */
export function getBrowserTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidIanaTimeZone(tz)) return tz;
  } catch {
    /* ignore */
  }
  return FALLBACK_TZ;
}

/** @deprecated Use getBrowserTimeZone */
export function getClientTimeZone() {
  return getBrowserTimeZone();
}

/** Timezone from public IP (follows VPN egress). */
export async function fetchTimezoneFromIp() {
  const endpoints = [
    async () => {
      const resp = await fetch('https://ipapi.co/json/', {
        signal: AbortSignal.timeout(6000),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.timezone;
    },
    async () => {
      const resp = await fetch('https://worldtimeapi.org/api/ip', {
        signal: AbortSignal.timeout(6000),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.timezone;
    },
  ];

  for (const load of endpoints) {
    try {
      const tz = await load();
      if (isValidIanaTimeZone(tz)) return tz;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function getClientTimeZoneLabel(timeZone) {
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
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone,
  });
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

export function formatIntroSlotSummary(iso, timeZone) {
  const label = getClientTimeZoneLabel(timeZone);
  return {
    dayLine: `${formatIntroWeekday(iso, timeZone)} · ${formatIntroDate(iso, timeZone)}`,
    timeLine: `${formatIntroTime(iso, timeZone)} (${label})`,
    timeZone,
    label,
  };
}

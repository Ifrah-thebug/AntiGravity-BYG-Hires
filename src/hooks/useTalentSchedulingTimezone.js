import { useMemo } from 'react';
import { getBrowserTimeZone, getClientTimeZoneLabel } from '../lib/clientSchedulingTimezone';

/** Talent portal: device/browser timezone for publishing intro slots. */
export function useTalentSchedulingTimezone() {
  const timeZone = useMemo(() => getBrowserTimeZone(), []);
  const timeZoneLabel = useMemo(() => getClientTimeZoneLabel(timeZone), [timeZone]);
  return { timeZone, timeZoneLabel };
}

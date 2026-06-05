import { useEffect, useMemo, useState } from 'react';
import {
  getBrowserTimeZone,
  fetchTimezoneFromIp,
  getClientTimeZoneLabel,
} from '../lib/clientSchedulingTimezone';

/** Network (IP/VPN) timezone when available; otherwise device clock. */
export function useClientSchedulingTimezone() {
  const browserTz = useMemo(() => getBrowserTimeZone(), []);
  const [timeZone, setTimeZone] = useState(browserTz);

  useEffect(() => {
    let cancelled = false;

    fetchTimezoneFromIp().then((fromIp) => {
      if (!cancelled && fromIp) {
        setTimeZone(fromIp);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [browserTz]);

  const timeZoneLabel = useMemo(() => getClientTimeZoneLabel(timeZone), [timeZone]);

  return { timeZone, timeZoneLabel };
}

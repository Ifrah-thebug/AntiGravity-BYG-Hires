/**
 * Billing periods for Workforce engagements.
 * Periods are anchored to the engagement start date so monthly cycles never drift
 * (Jan 31 → Feb 29 → Mar 31). Must stay in sync with wf_period_start() in
 * supabase/workforce_v3_production.sql.
 */

const CADENCES = ['weekly', 'biweekly', 'monthly'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value) {
  if (!ISO_DATE.test(String(value || ''))) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toIso(dt) {
  return dt.toISOString().slice(0, 10);
}

function todayIso() {
  return toIso(new Date());
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return toIso(new Date(Date.UTC(y, m - 1, d + days)));
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Same clamping rule as Postgres `date + interval 'n months'`. */
function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const monthIndex = ((total % 12) + 12) % 12;
  const day = Math.min(d, daysInMonth(year, monthIndex));
  return toIso(new Date(Date.UTC(year, monthIndex, day)));
}

function periodStart(anchor, cadence, index) {
  if (cadence === 'weekly') return addDays(anchor, 7 * index);
  if (cadence === 'biweekly') return addDays(anchor, 14 * index);
  return addMonths(anchor, index);
}

function periodBounds(anchor, cadence, index) {
  return {
    index,
    start: periodStart(anchor, cadence, index),
    end: addDays(periodStart(anchor, cadence, index + 1), -1),
  };
}

/**
 * Period indexes that should be invoiced as of `asOf` (billing in advance by `leadDays`).
 * Stops at the engagement end date and after `maxPeriods` to avoid runaway backfills.
 */
function duePeriodIndexes({ anchor, cadence, nextIndex, asOf, leadDays = 7, endDate = null, maxPeriods = 12 }) {
  const horizon = addDays(asOf, leadDays);
  const out = [];
  for (let i = nextIndex; out.length < maxPeriods; i += 1) {
    const start = periodStart(anchor, cadence, i);
    if (start > horizon) break;
    if (endDate && start > endDate) break;
    out.push(i);
  }
  return out;
}

module.exports = {
  CADENCES,
  isIsoDate,
  todayIso,
  addDays,
  addMonths,
  periodStart,
  periodBounds,
  duePeriodIndexes,
};

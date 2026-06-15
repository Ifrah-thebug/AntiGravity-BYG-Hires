import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Loader2, Save, Video, Clock } from 'lucide-react';
import {
  formatIntroDate,
  formatIntroTime,
  formatIntroWeekday,
} from '../lib/clientSchedulingTimezone';
import { useTalentSchedulingTimezone } from '../hooks/useTalentSchedulingTimezone';

const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

function normalizeInstant(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? '' : new Date(t).toISOString();
}

function formatDayLabel(dayKey, sampleIso, timeZone) {
  if (sampleIso) {
    return `${formatIntroWeekday(sampleIso, timeZone).slice(0, 3)}, ${formatIntroDate(sampleIso, timeZone)}`;
  }
  return dayKey;
}

async function parseJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Invalid response from server');
  }
}

function buildDayRows(daysFromCal, publishedList) {
  const dayMap = new Map();

  for (const day of daysFromCal || []) {
    dayMap.set(day.dayKey, {
      dayKey: day.dayKey,
      slots: (day.slots || []).map((s) => ({
        start: normalizeInstant(s.start),
        end: s.end,
        source: 'cal',
      })),
    });
  }

  for (const p of publishedList || []) {
    if (p.status !== 'open' && p.status !== 'held') continue;
    const start = normalizeInstant(p.start);
    const dayKey = p.dayKey || p.day_key;
    if (!start || !dayKey) continue;

    const row = dayMap.get(dayKey);
    if (!row) continue;

    // Only show saved publishes that still match live HR ∩ talent availability from Cal.
    const calStarts = new Set(row.slots.map((s) => normalizeInstant(s.start)));
    if (!calStarts.has(start)) continue;

    const exists = row.slots.some((s) => normalizeInstant(s.start) === start);
    if (!exists) {
      row.slots.push({ start, end: p.end, source: 'saved', id: p.id, status: p.status });
    }
  }

  return Array.from(dayMap.values())
    .map((d) => ({
      ...d,
      slots: d.slots.sort((a, b) => new Date(a.start) - new Date(b.start)),
    }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

function selectionFromPublished(publishedList) {
  const sel = {};
  for (const p of publishedList || []) {
    if (p.status === 'open' || p.status === 'held') {
      const dayKey = p.dayKey || p.day_key;
      const start = normalizeInstant(p.start);
      if (dayKey && start) sel[dayKey] = start;
    }
  }
  return sel;
}

/**
 * Talent intro scheduling — booked calls + available slot publishing.
 * Rendered in the main portal column (not inside the red strengthen panel).
 */
export default function TalentIntroAvailability({
  talentId,
  calConnected,
  connectCalendarUrl,
  onPublishedChange,
}) {
  const { timeZone: talentTimeZone, timeZoneLabel } = useTalentSchedulingTimezone();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [daysFromCal, setDaysFromCal] = useState([]);
  const [selected, setSelected] = useState({});
  const [published, setPublished] = useState([]);

  const dayRows = useMemo(() => buildDayRows(daysFromCal, published), [daysFromCal, published]);

  const publishedOpen = useMemo(
    () => (published || []).filter((p) => p.status === 'open' || p.status === 'held'),
    [published]
  );

  const publishedBooked = useMemo(
    () =>
      (published || [])
        .filter((p) => p.status === 'booked')
        .sort((a, b) => new Date(a.start) - new Date(b.start)),
    [published]
  );

  const bookedDayKeys = useMemo(
    () => new Set(publishedBooked.map((p) => p.dayKey).filter(Boolean)),
    [publishedBooked]
  );

  const selectableDayRows = useMemo(
    () => dayRows.filter((d) => !bookedDayKeys.has(d.dayKey)),
    [dayRows, bookedDayKeys]
  );

  const loadGrid = useCallback(async () => {
    if (!talentId || !calConnected) return;
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ timeZone: talentTimeZone });
      const resp = await fetch(
        `${API_BASE}/api/intro/publish-grid/${encodeURIComponent(talentId)}?${params}`
      );
      const data = await parseJson(resp);
      if (!resp.ok) throw new Error(data.error || 'Could not load availability');

      setDaysFromCal(data.days || []);
      const pub = (data.published || []).map((p) => ({
        ...p,
        start: normalizeInstant(p.start),
        dayKey: p.dayKey || p.day_key,
      }));
      setPublished(pub);

      const sel = selectionFromPublished(pub);
      const booked = new Set(
        pub.filter((p) => p.status === 'booked').map((p) => p.dayKey).filter(Boolean)
      );
      for (const dk of booked) delete sel[dk];
      setSelected(sel);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [talentId, calConnected, talentTimeZone]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  useEffect(() => {
    if (!onPublishedChange || loading) return;
    if (!calConnected) return;
    onPublishedChange(publishedOpen.length > 0);
  }, [publishedOpen, onPublishedChange, loading, calConnected]);

  function pickSlot(dayKey, start) {
    if (bookedDayKeys.has(dayKey)) return;
    const norm = normalizeInstant(start);
    setSelected((prev) => {
      const next = { ...prev };
      if (normalizeInstant(next[dayKey]) === norm) delete next[dayKey];
      else next[dayKey] = norm;
      return next;
    });
  }

  async function handleSave() {
    const slots = Object.values(selected);
    if (!slots.length) {
      setError('Select at least one time slot.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const resp = await fetch(`${API_BASE}/api/intro/my-slots/${encodeURIComponent(talentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots, timeZone: talentTimeZone }),
      });
      const data = await parseJson(resp);
      if (!resp.ok) throw new Error(data.error || 'Could not save');
      setSuccess(`Saved ${data.count} intro slot(s). Clients can now request intros.`);
      onPublishedChange?.(true);
      await loadGrid();
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!calConnected) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 sm:p-6 text-center">
        <Calendar size={28} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-gray-800">Connect Cal.com to manage intro slots</p>
        <p className="text-xs text-gray-500 font-medium mt-2 max-w-sm mx-auto leading-relaxed">
          Once your calendar is linked, you can publish availability and see upcoming client intro calls
          here.
        </p>
        {connectCalendarUrl && (
          <a
            href={connectCalendarUrl}
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-black text-white text-xs font-black uppercase tracking-widest hover:bg-red transition-colors"
          >
            Connect calendar
          </a>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
        <Loader2 size={18} className="animate-spin text-red" />
        <span className="text-xs font-bold uppercase tracking-widest">Loading calendar…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upcoming booked intros — separate from publish UI */}
      {publishedBooked.length > 0 && (
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Video size={18} />
            </div>
            <div>
              <h4 className="font-black text-sm text-gray-900">Upcoming intro calls</h4>
              <p className="text-xs text-gray-600 font-medium mt-1 leading-relaxed">
                Confirmed with clients. These days are locked — you cannot publish another slot on the
                same day.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {publishedBooked.map((p) => (
              <li
                key={p.id || p.start}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 rounded-xl bg-white border border-emerald-100 px-3 sm:px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Clock size={14} className="text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold text-gray-900 break-words">
                    {formatDayLabel(p.dayKey, p.start, talentTimeZone)} ·{' '}
                    {formatIntroTime(p.start, talentTimeZone)}
                  </span>
                </div>
                <span className="self-start sm:ml-auto text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                  Booked
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Available slots — publish for clients */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red/10 text-red flex items-center justify-center shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <h4 className="font-black text-sm text-gray-900">Available slots</h4>
            <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">
              Pick up to 15 days, one time per day when you and HR are both free ({timeZoneLabel} — your
              local time). Clients book intros from these times only.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-700 font-medium bg-red/5 border border-red/20 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}
        {success && (
          <p className="text-xs text-green-700 font-medium flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-4">
            <CheckCircle2 size={14} /> {success}
          </p>
        )}

        {publishedOpen.length > 0 && (
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-4">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">
              Live for clients ({publishedOpen.length})
            </p>
            <ul className="flex flex-wrap gap-2">
              {publishedOpen.map((p) => (
                <li
                  key={p.id || p.start}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-800 bg-white border border-gray-200 rounded-lg px-2.5 py-1"
                >
                  <CheckCircle2 size={11} className="text-green-600 shrink-0" />
                  {formatDayLabel(p.dayKey, p.start, talentTimeZone)} ·{' '}
                  {formatIntroTime(p.start, talentTimeZone)}
                  {p.status === 'held' && (
                    <span className="text-[9px] uppercase text-amber-600">held</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!selectableDayRows.length && !publishedOpen.length ? (
          <p className="text-sm text-gray-500 font-medium py-6 text-center">
            No mutual slots in the next 15 days. Check your Cal.com and HR calendars.
          </p>
        ) : (
          <div className="space-y-3 max-h-[min(50vh,300px)] sm:max-h-[300px] overflow-y-auto overscroll-contain pr-1 mb-5 -mx-0.5 px-0.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Tap a time to select · highlighted = will be published
            </p>
            {selectableDayRows.map((day) => (
              <div key={day.dayKey} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-wider mb-2">
                  {formatDayLabel(day.dayKey, day.slots[0]?.start, talentTimeZone)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {day.slots.map((slot) => {
                    const active =
                      normalizeInstant(selected[day.dayKey]) === normalizeInstant(slot.start);
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => pickSlot(day.dayKey, slot.start)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          active
                            ? 'bg-red text-white shadow-md'
                            : 'bg-white border border-gray-200 text-gray-800 hover:border-red/40'
                        }`}
                      >
                        {formatIntroTime(slot.start, talentTimeZone)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !Object.keys(selected).length}
          className="w-full min-h-[44px] py-3.5 rounded-xl bg-black hover:bg-red disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Publish availability'}
        </button>
      </section>
    </div>
  );
}

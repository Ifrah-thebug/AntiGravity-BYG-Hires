import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, CheckCircle2, Clock, Save, Video } from 'lucide-react-native';
import { Banner, Button, InlineLoader } from '@/shared/components/ui';
import { colors, fonts, radius, type } from '@/shared/theme';
import {
  formatIntroDate,
  formatIntroTime,
  formatIntroWeekday,
  getDeviceTimeZone,
  getTimeZoneLabel,
} from '@/shared/lib/schedulingTimezone';
import { fetchPublishGrid, saveIntroSlots } from '@/features/intro/api/introApi';

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

function buildDayRows(daysFromCal, publishedList) {
  const dayMap = new Map();

  for (const day of daysFromCal || []) {
    dayMap.set(day.dayKey, {
      dayKey: day.dayKey,
      slots: (day.slots || []).map((s) => ({ start: normalizeInstant(s.start), end: s.end, source: 'cal' })),
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
    if (!exists) row.slots.push({ start, end: p.end, source: 'saved', id: p.id, status: p.status });
  }

  return Array.from(dayMap.values())
    .map((d) => ({ ...d, slots: d.slots.sort((a, b) => new Date(a.start) - new Date(b.start)) }))
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

/** Talent intro scheduling — booked calls + available slot publishing (web TalentIntroAvailability). */
export default function TalentIntroAvailability({ talentId, calConnected, connectCalendarUrl, onPublishedChange }) {
  const timeZone = useMemo(() => getDeviceTimeZone(), []);
  const timeZoneLabel = useMemo(() => getTimeZoneLabel(timeZone), [timeZone]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [daysFromCal, setDaysFromCal] = useState([]);
  const [selected, setSelected] = useState({});
  const [published, setPublished] = useState([]);

  const dayRows = useMemo(() => buildDayRows(daysFromCal, published), [daysFromCal, published]);
  const publishedOpen = useMemo(() => published.filter((p) => p.status === 'open' || p.status === 'held'), [published]);
  const publishedBooked = useMemo(
    () => published.filter((p) => p.status === 'booked').sort((a, b) => new Date(a.start) - new Date(b.start)),
    [published]
  );
  const bookedDayKeys = useMemo(() => new Set(publishedBooked.map((p) => p.dayKey).filter(Boolean)), [publishedBooked]);
  const selectableDayRows = useMemo(() => dayRows.filter((d) => !bookedDayKeys.has(d.dayKey)), [dayRows, bookedDayKeys]);

  const loadGrid = useCallback(async () => {
    if (!talentId || !calConnected) return;
    try {
      setLoading(true);
      setError('');
      const data = await fetchPublishGrid(talentId, timeZone);
      setDaysFromCal(data.days || []);
      const pub = (data.published || []).map((p) => ({
        ...p,
        start: normalizeInstant(p.start),
        dayKey: p.dayKey || p.day_key,
      }));
      setPublished(pub);

      const sel = selectionFromPublished(pub);
      const booked = new Set(pub.filter((p) => p.status === 'booked').map((p) => p.dayKey).filter(Boolean));
      for (const dk of booked) delete sel[dk];
      setSelected(sel);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [talentId, calConnected, timeZone]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  useEffect(() => {
    if (!onPublishedChange || loading || !calConnected) return;
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
      const data = await saveIntroSlots(talentId, { slots, timeZone });
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
      <View style={styles.connect}>
        <Calendar size={28} color={colors.gray300} />
        <Text style={styles.connectTitle}>Connect Cal.com to manage intro slots</Text>
        <Text style={styles.connectText}>
          Once your calendar is linked, you can publish availability and see upcoming client intro calls here.
        </Text>
        {connectCalendarUrl ? (
          <Button
            title="Connect calendar"
            size="sm"
            fullWidth={false}
            onPress={() => Linking.openURL(connectCalendarUrl).catch(() => {})}
            style={{ marginTop: 8 }}
          />
        ) : null}
      </View>
    );
  }

  if (loading) return <InlineLoader label="Loading calendar…" />;

  return (
    <View style={styles.wrap}>
      {publishedBooked.length > 0 ? (
        <View style={styles.booked}>
          <View style={styles.headRow}>
            <View style={[styles.headIcon, { backgroundColor: colors.emerald600 }]}>
              <Video size={18} color={colors.white} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.headTitle}>Upcoming intro calls</Text>
              <Text style={styles.headText}>
                Confirmed with clients. These days are locked — you cannot publish another slot on the same day.
              </Text>
            </View>
          </View>
          {publishedBooked.map((p) => (
            <View key={p.id || p.start} style={styles.bookedRow}>
              <Clock size={14} color={colors.emerald600} />
              <Text style={styles.bookedText}>
                {formatDayLabel(p.dayKey, p.start, timeZone)} · {formatIntroTime(p.start, timeZone)}
              </Text>
              <Text style={styles.bookedTag}>Booked</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.available}>
        <View style={styles.headRow}>
          <View style={[styles.headIcon, { backgroundColor: colors.red10 }]}>
            <Calendar size={18} color={colors.red} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.headTitle}>Available slots</Text>
            <Text style={styles.headText}>
              Pick up to 15 days, one time per day when you and HR are both free ({timeZoneLabel} — your local time).
              Clients book intros from these times only.
            </Text>
          </View>
        </View>

        {error ? <Banner tone="error" message={error} /> : null}
        {success ? <Banner tone="success" message={success} /> : null}

        {publishedOpen.length > 0 ? (
          <View style={styles.liveBox}>
            <Text style={[type.eyebrow, { color: colors.gray500 }]}>Live for clients ({publishedOpen.length})</Text>
            <View style={styles.liveList}>
              {publishedOpen.map((p) => (
                <View key={p.id || p.start} style={styles.liveChip}>
                  <CheckCircle2 size={11} color={colors.green600} />
                  <Text style={styles.liveText}>
                    {formatDayLabel(p.dayKey, p.start, timeZone)} · {formatIntroTime(p.start, timeZone)}
                  </Text>
                  {p.status === 'held' ? <Text style={styles.held}>held</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!selectableDayRows.length && !publishedOpen.length ? (
          <Text style={styles.none}>No mutual slots in the next 15 days. Check your Cal.com and HR calendars.</Text>
        ) : (
          <View style={styles.gridWrap}>
            <Text style={[type.label, { color: colors.gray400 }]}>Tap a time to select · highlighted = will be published</Text>
            <ScrollView style={styles.grid} nestedScrollEnabled>
              {selectableDayRows.map((day) => (
                <View key={day.dayKey} style={styles.day}>
                  <Text style={[type.eyebrow, { color: colors.gray600 }]}>
                    {formatDayLabel(day.dayKey, day.slots[0]?.start, timeZone)}
                  </Text>
                  <View style={styles.slots}>
                    {day.slots.map((slot) => {
                      const active = normalizeInstant(selected[day.dayKey]) === normalizeInstant(slot.start);
                      return (
                        <Pressable
                          key={slot.start}
                          onPress={() => pickSlot(day.dayKey, slot.start)}
                          style={[styles.slot, active && styles.slotActive]}
                        >
                          <Text style={[styles.slotText, active && { color: colors.white }]}>
                            {formatIntroTime(slot.start, timeZone)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <Button
          title={saving ? 'Saving…' : 'Publish availability'}
          icon={Save}
          size="sm"
          onPress={handleSave}
          loading={saving}
          disabled={!Object.keys(selected).length}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 18 },
  connect: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: 20,
    gap: 6,
  },
  connectTitle: { ...fonts.bold, fontSize: 14, color: colors.gray800, textAlign: 'center', marginTop: 6 },
  connectText: { ...fonts.medium, fontSize: 12, lineHeight: 18, color: colors.gray500, textAlign: 'center' },
  booked: {
    borderWidth: 1,
    borderColor: colors.emerald100,
    backgroundColor: 'rgba(236,253,245,0.6)',
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
  },
  headRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headTitle: { ...fonts.black, fontSize: 14, color: colors.gray900 },
  headText: { ...fonts.medium, fontSize: 12, lineHeight: 17, color: colors.gray600, marginTop: 4 },
  bookedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.emerald100,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bookedText: { ...fonts.bold, fontSize: 13, color: colors.gray900, flex: 1 },
  bookedTag: {
    ...fonts.black,
    fontSize: 9,
    color: colors.emerald700,
    backgroundColor: colors.emerald100,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  available: {
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    gap: 14,
  },
  liveBox: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray100, borderRadius: radius.md, padding: 12, gap: 8 },
  liveList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveText: { ...fonts.bold, fontSize: 11, color: colors.gray800 },
  held: { ...fonts.bold, fontSize: 9, color: colors.amber600, textTransform: 'uppercase' },
  none: { ...fonts.medium, fontSize: 13, color: colors.gray500, textAlign: 'center', paddingVertical: 16 },
  gridWrap: { gap: 8 },
  grid: { maxHeight: 300 },
  day: { borderWidth: 1, borderColor: colors.gray100, backgroundColor: 'rgba(249,250,251,0.8)', borderRadius: radius.md, padding: 12, gap: 8, marginBottom: 10 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  slotActive: { backgroundColor: colors.red, borderColor: colors.red },
  slotText: { ...fonts.bold, fontSize: 11, color: colors.gray800 },
});

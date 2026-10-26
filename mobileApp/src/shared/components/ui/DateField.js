import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { colors, fonts, radius } from '@/shared/theme';
import FieldLabel from './FieldLabel';
import Button from './Button';

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Replacement for <input type="date"> — value is "YYYY-MM-DD". */
export default function DateField({ label, value, onChange, disabled = false, style }) {
  const [open, setOpen] = useState(false);
  const current = value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : new Date();
  const display = value
    ? current.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Pick a date';

  return (
    <View style={[styles.wrap, style]}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[styles.field, disabled && styles.disabled]}
      >
        <Text style={styles.value}>{display}</Text>
        <Calendar size={16} color={colors.gray500} />
      </Pressable>
      {open ? (
        <View>
          <DateTimePicker
            value={Number.isNaN(current.getTime()) ? new Date() : current}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={(event, date) => {
              if (Platform.OS === 'android') setOpen(false);
              if (event.type === 'set' && date) onChange?.(toIsoDate(date));
            }}
          />
          {Platform.OS === 'ios' ? (
            <Button title="Done" size="sm" variant="outline" onPress={() => setOpen(false)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: 240,
  },
  disabled: { opacity: 0.6 },
  value: { ...fonts.bold, fontSize: 14, color: colors.gray800 },
});

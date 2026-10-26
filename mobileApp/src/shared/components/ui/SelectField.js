import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { colors, fonts, radius, type } from '@/shared/theme';
import FieldLabel from './FieldLabel';
import BottomSheet from './BottomSheet';

function Separator() {
  return <View style={styles.sep} />;
}

/** Native replacement for the web <select> — opens a bottom sheet list. */
export default function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  hint,
  style,
  highlight = false,
  renderOptionLabel,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={[styles.wrap, style]}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[styles.field, highlight && styles.highlight, disabled && styles.disabled]}
      >
        <Text style={styles.value} numberOfLines={1}>
          {selected ? (renderOptionLabel ? renderOptionLabel(selected) : selected.label) : 'Select…'}
        </Text>
        <ChevronDown size={16} color={colors.gray500} />
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.value)}
          renderItem={({ item }) => {
            const active = item.value === value;
            return (
              <Pressable
                onPress={() => {
                  onChange?.(item.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, (pressed || active) && styles.optionActive]}
              >
                <Text style={[styles.optionText, active && { color: colors.red }]}>
                  {renderOptionLabel ? renderOptionLabel(item) : item.label}
                </Text>
                {active ? <Check size={16} color={colors.red} /> : null}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={Separator}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  highlight: { borderColor: colors.red30 },
  disabled: { opacity: 0.6 },
  value: { ...fonts.bold, fontSize: 14, color: colors.gray800, flex: 1 },
  hint: { ...type.tiny, color: colors.gray400 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 6,
  },
  optionActive: { backgroundColor: colors.red5 },
  optionText: { ...fonts.bold, fontSize: 14, color: colors.gray800, flex: 1 },
  sep: { height: 1, backgroundColor: colors.gray100 },
});

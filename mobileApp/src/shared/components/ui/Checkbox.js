import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '@/shared/theme';

export default function Checkbox({ checked, onChange, disabled = false, children, style }) {
  return (
    <Pressable
      onPress={() => !disabled && onChange?.(!checked)}
      style={[styles.row, disabled && { opacity: 0.6 }, style]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Check size={12} color={colors.white} strokeWidth={3} /> : null}
      </View>
      <View style={styles.flex}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: colors.red, borderColor: colors.red },
  flex: { flex: 1 },
});

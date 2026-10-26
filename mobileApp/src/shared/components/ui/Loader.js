import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '@/shared/theme';

/** Full-page spinner (web: w-12 h-12 border-4 border-red/20 border-t-red animate-spin). */
export function FullScreenLoader({ label, dark = false }) {
  return (
    <View style={[styles.full, { backgroundColor: dark ? colors.black : colors.white }]}>
      <ActivityIndicator size="large" color={colors.red} />
      {label ? (
        <Text style={[type.eyebrow, { color: dark ? colors.white : colors.gray900 }]}>{label}</Text>
      ) : null}
    </View>
  );
}

export function InlineLoader({ label, style }) {
  return (
    <View style={[styles.inline, style]}>
      <ActivityIndicator size="small" color={colors.red} />
      {label ? <Text style={[type.eyebrow, { color: colors.gray500 }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 36 },
});

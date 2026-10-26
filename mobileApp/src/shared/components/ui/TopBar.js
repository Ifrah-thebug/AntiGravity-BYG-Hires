import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, type } from '@/shared/theme';

/** "← Portal" back link row with an optional right-side element (timer, status…). */
export default function TopBar({ label = 'Portal', onBack, right, color = colors.gray400 }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.back}>
        <ArrowLeft size={14} color={color} />
        <Text style={[type.eyebrow, { color }]}>{label}</Text>
      </Pressable>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, minHeight: 32 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

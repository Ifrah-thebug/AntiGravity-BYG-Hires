import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '@/shared/theme';

export default function FieldLabel({ children, icon: Icon, required, dark = false, style }) {
  const color = dark ? 'rgba(255,255,255,0.6)' : colors.gray500;
  return (
    <View style={[styles.row, style]}>
      {Icon ? <Icon size={10} color={color} /> : null}
      <Text style={[type.label, { color }]}>
        {children}
        {required ? <Text style={{ color: colors.red }}> *</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

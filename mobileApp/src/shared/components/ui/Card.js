import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, shadow } from '@/shared/theme';

/** White bordered card (web: bg-white border border-gray-200 rounded-[2rem]). */
export function Card({ children, style, elevated = false }) {
  return <View style={[styles.card, elevated && shadow.card, style]}>{children}</View>;
}

/** Black hero card with the soft red glow in the corner. */
export function DarkCard({ children, style, glow = true }) {
  return (
    <View style={[styles.dark, style]}>
      {glow ? <View pointerEvents="none" style={styles.glow} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.xl,
    padding: 20,
    gap: 16,
  },
  dark: {
    backgroundColor: colors.black,
    borderRadius: radius.xl,
    padding: 20,
    overflow: 'hidden',
    gap: 14,
  },
  glow: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.red,
    opacity: 0.22,
  },
});

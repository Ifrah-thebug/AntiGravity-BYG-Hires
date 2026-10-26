import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { avatarFromName } from '@/shared/lib/formatDisplayName';
import { colors, fonts } from '@/shared/theme';

/** Photo, or initials on a name-derived color (same hue formula as web gradients). */
export default function Avatar({ name, photo, size = 64, rounded = 16, borderColor, style }) {
  const { initials, hue } = avatarFromName(name);
  const box = {
    width: size,
    height: size,
    borderRadius: rounded,
    borderWidth: borderColor ? 2 : 0,
    borderColor,
  };

  if (photo) {
    return <Image source={{ uri: photo }} style={[styles.img, box, style]} resizeMode="cover" />;
  }

  return (
    <View style={[styles.fallback, box, { backgroundColor: `hsl(${hue}, 55%, 38%)` }, style]}>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.32) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.gray100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { ...fonts.black, color: colors.white },
});

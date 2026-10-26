import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '@/shared/theme';

const logo = require('@/assets/images/logo.png');

/** Logo + eyebrow + big title + subtitle used on every auth page. */
export default function AuthHeader({ eyebrow, title, subtitle, children, showLogo = true }) {
  return (
    <View style={styles.wrap}>
      {showLogo ? <Image source={logo} style={styles.logo} resizeMode="contain" /> : null}
      {eyebrow ? <Text style={[type.eyebrow, styles.eyebrow]}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 12, marginBottom: 28, paddingHorizontal: 8 },
  logo: { height: 40, width: 160, marginBottom: 22 },
  eyebrow: { color: colors.red, marginBottom: 10 },
  title: { ...type.h1, color: colors.black, textAlign: 'center', marginBottom: 10 },
  subtitle: { ...type.body, color: colors.gray500, textAlign: 'center' },
});

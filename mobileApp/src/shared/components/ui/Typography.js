import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, type } from '@/shared/theme';

/** Small red uppercase label above section titles (web: text-red font-black text-[10px] tracking-[0.2em]). */
export function Eyebrow({ children, icon: Icon, color = colors.red, style }) {
  return (
    <View style={[styles.eyebrowRow, style]}>
      {Icon ? <Icon size={11} color={color} /> : null}
      <Text style={[type.eyebrow, { color }]}>{children}</Text>
    </View>
  );
}

export function Title({ children, style, size = 'h2', color = colors.gray900 }) {
  return <Text style={[type[size], { color }, style]}>{children}</Text>;
}

export function Body({ children, style, color = colors.gray500, size = 'small' }) {
  return <Text style={[type[size], { color }, style]}>{children}</Text>;
}

/** "Section card" header: eyebrow + title + description. */
export function SectionHeader({ eyebrow, eyebrowIcon, title, description, right }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.flex}>
        {eyebrow ? <Eyebrow icon={eyebrowIcon}>{eyebrow}</Eyebrow> : null}
        {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
        {description ? <Text style={styles.sectionDesc}>{description}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  sectionTitle: { ...fonts.black, fontSize: 18, color: colors.gray900, letterSpacing: -0.2 },
  sectionDesc: { ...fonts.medium, fontSize: 12, lineHeight: 18, color: colors.gray500, marginTop: 6 },
});

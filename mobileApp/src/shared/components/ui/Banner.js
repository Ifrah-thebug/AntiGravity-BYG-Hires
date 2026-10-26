import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react-native';
import { colors, fonts, radius } from '@/shared/theme';

const TONES = {
  error: { bg: colors.red5, border: colors.red20, fg: colors.red, Icon: AlertTriangle },
  success: { bg: colors.green50, border: colors.green200, fg: colors.green700, Icon: CheckCircle2 },
  warning: { bg: colors.amber50, border: colors.amber200, fg: colors.amber900, Icon: AlertTriangle },
  orange: { bg: colors.orange50, border: colors.orange200, fg: colors.orange900, Icon: AlertTriangle },
  info: { bg: colors.gray50, border: colors.gray200, fg: colors.gray800, Icon: Info },
};

/** Alert box used everywhere on web (`p-4 bg-red/5 border ... rounded-2xl`). */
export default function Banner({ tone = 'error', title, message, children, icon, style }) {
  const t = TONES[tone] || TONES.error;
  const Icon = icon === null ? null : icon || t.Icon;
  return (
    <View style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <View style={styles.row}>
        {Icon ? <Icon size={16} color={t.fg} style={styles.icon} /> : null}
        <View style={styles.flex}>
          {title ? <Text style={[styles.title, { color: t.fg }]}>{title}</Text> : null}
          {message ? <Text style={[styles.message, { color: t.fg }]}>{message}</Text> : null}
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  icon: { marginTop: 2 },
  flex: { flex: 1, gap: 4 },
  title: { ...fonts.black, fontSize: 13 },
  message: { ...fonts.semibold, fontSize: 13, lineHeight: 19 },
});

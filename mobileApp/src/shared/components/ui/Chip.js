import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/shared/theme';
import { scoreBadgeColors } from '@/shared/lib/skillAssessmentDisplay';

const TONES = {
  dark: { backgroundColor: colors.black, color: colors.white, borderColor: colors.black },
  red: { backgroundColor: colors.red, color: colors.white, borderColor: colors.red },
  redSoft: { backgroundColor: colors.red5, color: colors.red, borderColor: 'rgba(255,61,61,0.1)' },
  gray: { backgroundColor: colors.gray50, color: colors.gray600, borderColor: colors.gray100 },
  green: { backgroundColor: colors.green50, color: colors.green700, borderColor: colors.green100 },
  amber: { backgroundColor: colors.amber50, color: colors.amber700, borderColor: colors.amber100 },
  emerald: { backgroundColor: colors.emerald100, color: colors.emerald700, borderColor: colors.emerald100 },
  white: { backgroundColor: colors.white, color: colors.gray600, borderColor: colors.gray200 },
};

/** Uppercase tiny pill used for tags / statuses. */
export function Chip({ label, tone = 'gray', icon: Icon, style, textStyle, children }) {
  const t = TONES[tone] || TONES.gray;
  return (
    <View style={[styles.chip, { backgroundColor: t.backgroundColor, borderColor: t.borderColor }, style]}>
      {Icon ? <Icon size={10} color={t.color} /> : null}
      {label != null ? <Text style={[styles.text, { color: t.color }, textStyle]}>{label}</Text> : null}
      {children}
    </View>
  );
}

/** Score badge with the same color bands as web (`scoreBadgeClass`). */
export function ScoreBadge({ score, suffix = '', style, large = false }) {
  const c = scoreBadgeColors(score);
  return (
    <View style={[styles.score, large && styles.scoreLarge, { backgroundColor: c.backgroundColor, borderColor: c.borderColor }, style]}>
      <Text style={[large ? styles.scoreTextLarge : styles.scoreText, { color: c.color }]}>
        {score}
        {suffix}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: { ...fonts.black, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase' },
  score: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  scoreLarge: { borderWidth: 2, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 18, alignItems: 'center' },
  scoreText: { ...fonts.black, fontSize: 10 },
  scoreTextLarge: { ...fonts.black, fontSize: 44 },
});

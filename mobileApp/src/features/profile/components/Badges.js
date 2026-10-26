import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Mic, ShieldAlert } from 'lucide-react-native';
import { colors, fonts } from '@/shared/theme';
import { isTalentAiInterviewVerified, isTalentVerified } from '@/shared/lib/talentVerification';

const circleBadge = require('@/assets/images/circle-badge.png');

/** Header badge: Verified (phase 2+) or Unverified (phase 1 default). */
export function ProfileVerificationBadge({ talent, variant = 'dark' }) {
  const verified = isTalentVerified(talent);
  if (verified) {
    return (
      <View style={styles.row}>
        <CheckCircle2 size={14} color="#4ade80" />
        <Text style={[styles.text, { color: '#4ade80' }]}>Verified</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <ShieldAlert size={14} color={colors.gray400} />
      <Text style={[styles.text, { color: variant === 'dark' ? colors.gray400 : colors.gray500 }]}>Unverified</Text>
    </View>
  );
}

/** Profile badge when talent completed AI interview with score above threshold. */
export function AiInterviewVerifiedBadge({ talent, variant = 'dark' }) {
  if (!isTalentAiInterviewVerified(talent)) return null;
  const color = variant === 'dark' ? colors.violet300 : colors.violet700;
  return (
    <View style={styles.row}>
      <Mic size={14} color={variant === 'dark' ? colors.violet300 : colors.violet600} />
      <Text style={[styles.text, { color }]}>AI Interview verified</Text>
    </View>
  );
}

/** Shown for talent attributed to a BYG ambassador (invite or signup code). */
export function AmbassadorReferredBadge({ variant = 'light' }) {
  const onDark = variant === 'dark';
  return (
    <View
      style={[
        styles.pill,
        onDark
          ? { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)' }
          : { backgroundColor: 'rgba(11,27,58,0.04)', borderColor: 'rgba(201,162,39,0.35)' },
      ]}
    >
      <Image source={circleBadge} style={styles.badgeImg} resizeMode="contain" />
      <Text style={[styles.text, { color: onDark ? colors.circleGold : colors.circleNavy }]}>Ambassador verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  text: { ...fonts.black, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgeImg: { width: 20, height: 20 },
});

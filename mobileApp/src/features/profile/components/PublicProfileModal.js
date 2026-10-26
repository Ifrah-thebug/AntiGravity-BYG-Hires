import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Briefcase, X } from 'lucide-react-native';
import { Avatar, BottomSheet, Button } from '@/shared/components/ui';
import { colors, fonts, type } from '@/shared/theme';
import { formatDisplayName } from '@/shared/lib/formatDisplayName';
import { getSkillScore } from '@/shared/lib/talentSkillsDisplay';
import { SHOW_ASSESSMENT_SCORE } from '@/shared/lib/talentVerification';
import { scoreBadgeColors } from '@/shared/lib/skillAssessmentDisplay';
import { formatAvailabilityLabel } from '@/features/profile/utils/profileContentPolicy';
import { AiInterviewVerifiedBadge, AmbassadorReferredBadge, ProfileVerificationBadge } from './Badges';

const ROLE_TYPE_LABELS = {
  night: 'Night Role',
  flexible: 'Flexible Hours',
  fulltime: 'Full-Time Remote',
  parttime: 'Part-Time',
};

/** "View Public Profile" — the same card visitors see on the web directory. */
export default function PublicProfileModal({ talent, visible, onClose, onViewPortfolio }) {
  if (!talent) return null;

  const header = (
    <View style={styles.header}>
      <View pointerEvents="none" style={styles.glow} />
      <Pressable onPress={onClose} style={styles.close} hitSlop={10} accessibilityLabel="Close profile">
        <X size={16} color={colors.white} />
      </Pressable>
      <View style={styles.headerRow}>
        <Avatar name={talent.name} photo={talent.photo} size={110} rounded={20} />
        <View style={styles.flex}>
          <ProfileVerificationBadge talent={talent} variant="dark" />
          <AiInterviewVerifiedBadge talent={talent} variant="dark" />
          {talent.ambassadorReferred ? <AmbassadorReferredBadge variant="dark" /> : null}
          <Text style={styles.name}>{formatDisplayName(talent.name)}</Text>
          <Text style={styles.role}>{talent.role}</Text>
          <View style={styles.expRow}>
            <Briefcase size={10} color={colors.gray400} />
            <Text style={styles.exp}>{talent.experience} experience</Text>
          </View>
        </View>
      </View>
      {SHOW_ASSESSMENT_SCORE && talent.score > 0 ? (
        <View style={styles.scoreBlock}>
          <View style={styles.scoreLabels}>
            <Text style={[type.label, { color: colors.gray400 }]}>Assessment Score</Text>
            <Text style={[type.label, { color: colors.white }]}>{talent.score}/100</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${talent.score}%` }]} />
          </View>
        </View>
      ) : null}
    </View>
  );

  const details = [
    { label: 'Monthly Fee', value: `$${(talent.fee || 0).toLocaleString()}${talent.period || '/mo'}` },
    { label: 'Availability', value: formatAvailabilityLabel(talent.availability) },
    { label: 'Role Type', value: ROLE_TYPE_LABELS[talent.roleType] || 'Flexible Hours' },
    { label: 'Experience', value: talent.experience },
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      header={header}
      scroll
      maxHeight="92%"
      footer={
        <View style={styles.footerRow}>
          {onViewPortfolio ? (
            <Button title="View Portfolio" variant="outline" onPress={onViewPortfolio} style={styles.flex} />
          ) : null}
          <Button title="Close" variant="light" onPress={onClose} style={styles.flex} />
        </View>
      }
    >
      <View style={styles.body}>
        <View>
          <Text style={[type.eyebrow, styles.sectionLabel]}>About</Text>
          <Text style={styles.bio}>{talent.bio}</Text>
        </View>

        <View>
          <Text style={[type.eyebrow, styles.sectionLabel]}>Skills & Expertise</Text>
          <View style={styles.tags}>
            {(talent.tags || []).map((tag) => {
              const score = getSkillScore(talent.skillScores, tag);
              return (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                  {SHOW_ASSESSMENT_SCORE && score != null ? (
                    <Text style={[styles.tagScore, scoreBadgeColors(score)]}>{score}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.grid}>
          {details.map(({ label, value }) => (
            <View key={label} style={styles.cell}>
              <Text style={[type.eyebrow, { color: colors.gray400, fontSize: 9 }]}>{label}</Text>
              <Text style={styles.cellValue}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { backgroundColor: colors.black, padding: 22, paddingTop: 26, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.red,
    opacity: 0.2,
  },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', paddingRight: 30 },
  name: { ...fonts.black, fontSize: 21, color: colors.white, marginTop: 2 },
  role: { ...fonts.bold, fontSize: 12, color: colors.red, textTransform: 'uppercase', letterSpacing: 0.5 },
  expRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  exp: { ...fonts.semibold, fontSize: 11, color: colors.gray400 },
  scoreBlock: { marginTop: 18, gap: 6 },
  scoreLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#34d399', borderRadius: 4 },
  body: { gap: 20, paddingBottom: 8 },
  sectionLabel: { color: colors.gray400, marginBottom: 8 },
  bio: { ...fonts.medium, fontSize: 14, lineHeight: 21, color: colors.gray700 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.red5,
    borderWidth: 1,
    borderColor: 'rgba(255,61,61,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { ...fonts.bold, fontSize: 10, color: colors.red, textTransform: 'uppercase' },
  tagScore: { ...fonts.black, fontSize: 9, borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  cellValue: { ...fonts.black, fontSize: 14, color: colors.gray900 },
  footerRow: { flexDirection: 'row', gap: 10 },
});

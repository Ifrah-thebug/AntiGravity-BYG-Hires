import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Award, BookOpen, Calendar, Check, ClipboardCheck, Mic, Sparkles, TrendingUp, Video } from 'lucide-react-native';
import { colors, fonts, radius, type } from '@/shared/theme';

function buildTiles({
  calendarConnected,
  introSlotsPublished,
  assessmentDone,
  interviewUnlocked,
  interviewCompleted,
  hasCalendarUrl,
  actions,
}) {
  const tiles = [
    {
      id: 'portfolio',
      label: 'Build your portfolio',
      description: 'Add project chapters with cover images and live work links.',
      icon: BookOpen,
      done: false,
      onPress: actions.onBuildPortfolio,
    },
    {
      id: 'assessment',
      label: 'Take skills test',
      description: 'Prove your skills with a focused test per skill (~25 min).',
      icon: ClipboardCheck,
      done: assessmentDone,
      onPress: actions.onOpenAssessment,
    },
  ];

  if (interviewUnlocked) {
    tiles.push({
      id: 'voice-interview',
      label: 'AI voice interview',
      description: assessmentDone
        ? 'A client requested this — speak with our AI interviewer (~15 min).'
        : 'Complete at least one skills test first, then take the AI interview.',
      icon: Mic,
      done: interviewCompleted,
      disabled: !assessmentDone,
      onPress: actions.onOpenInterview,
    });
  }

  if (hasCalendarUrl) {
    tiles.push({
      id: 'calendar',
      label: 'Connect your calendar',
      description: 'Sync Cal.com so HR can book intro interviews when clients request you.',
      icon: Calendar,
      done: calendarConnected,
      onPress: actions.onConnectCalendar,
    });
  }

  tiles.push({
    id: 'intro',
    label: 'Client intro scheduling',
    description: 'Jump to available slots and upcoming intro calls on this page.',
    icon: Video,
    done: introSlotsPublished,
    onPress: actions.onJumpToIntro,
  });

  return tiles;
}

/** Red "Strengthen your profile" panel (web PortalPage sidebar). */
export default function StrengthenProfilePanel(props) {
  const tiles = buildTiles(props);

  return (
    <View style={styles.panel}>
      <View>
        <View style={styles.eyebrow}>
          <Sparkles size={11} color={colors.white} />
          <Text style={[type.eyebrow, { color: colors.white }]}>Grow your presence</Text>
        </View>
        <Text style={styles.title}>Strengthen your profile</Text>
        <Text style={styles.text}>
          Complete your skills test so clients can see verified expertise. When a client requests an AI interview, it will
          appear here. Connect your calendar and publish intro availability.
        </Text>
        {props.actions.onOpenGuide ? (
          <Text style={styles.guideLink} onPress={props.actions.onOpenGuide}>How it works — quick guide</Text>
        ) : null}
      </View>

      <View style={styles.tiles}>
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Pressable
              key={tile.id}
              onPress={tile.disabled ? undefined : tile.onPress}
              disabled={tile.disabled}
              style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.gray50 }, tile.disabled && styles.tileDisabled]}
            >
              <View style={styles.tileIcon}>
                <Icon size={18} color={colors.red} strokeWidth={2.25} />
                {tile.done ? (
                  <View style={styles.doneBadge}>
                    <Check size={11} color={colors.white} strokeWidth={3} />
                  </View>
                ) : null}
              </View>
              <View style={styles.flex}>
                <Text style={styles.tileTitle}>{tile.label}</Text>
                <Text style={styles.tileText}>{tile.description}</Text>
              </View>
              <ArrowRight size={16} color={colors.red} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.why}>
        <View style={styles.whyRow}>
          <View style={styles.whyIcon}>
            <Award size={18} color={colors.white} />
          </View>
          <View style={styles.flex}>
            <Text style={[type.eyebrow, { color: 'rgba(255,255,255,0.8)' }]}>Why it matters</Text>
            <Text style={styles.whyText}>Assessed talent is featured more prominently and stands out in client searches.</Text>
          </View>
        </View>
        <View style={styles.whyRow}>
          <TrendingUp size={12} color={colors.white} />
          <Text style={styles.whyTip}>Complete skills tests → stronger visibility in client searches</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { backgroundColor: colors.red, borderRadius: radius.xl, padding: 20, gap: 18 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { ...fonts.black, fontSize: 22, color: colors.white, letterSpacing: -0.3 },
  text: { ...fonts.semibold, fontSize: 13, lineHeight: 20, color: colors.white, marginTop: 8 },
  guideLink: {
    ...fonts.black,
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textDecorationLine: 'underline',
    marginTop: 14,
  },
  tiles: { gap: 12 },
  tile: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
  },
  tileDisabled: { opacity: 0.75, backgroundColor: 'rgba(255,255,255,0.7)' },
  tileIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.red10, alignItems: 'center', justifyContent: 'center' },
  doneBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.black,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { ...fonts.black, fontSize: 14, color: colors.gray900 },
  tileText: { ...fonts.medium, fontSize: 11, lineHeight: 16, color: colors.gray600, marginTop: 3 },
  why: { backgroundColor: colors.black, borderRadius: radius.lg, padding: 16, gap: 12 },
  whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  whyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  whyText: { ...fonts.semibold, fontSize: 12, lineHeight: 18, color: colors.white, marginTop: 4 },
  whyTip: { ...fonts.bold, fontSize: 10, color: colors.white, textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
});

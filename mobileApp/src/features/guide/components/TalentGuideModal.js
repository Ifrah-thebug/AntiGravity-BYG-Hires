import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, BookOpen, Calendar, Check, ClipboardCheck, Clock, Mic, X } from 'lucide-react-native';
import { BottomSheet, Button } from '@/shared/components/ui';
import { colors, fonts, radius, type } from '@/shared/theme';

export const TALENT_GUIDE_STORAGE_KEY = 'byg_talent_guide_seen';

const GUIDE_STEPS = [
  { id: 'calendar', title: 'Connect your calendar', short: 'Sync Cal.com first — intro calls need your live availability.', icon: Calendar },
  { id: 'assessment', title: 'Take a skills test', short: 'Pick one skill and complete the test (~25 min) so clients see verified expertise.', icon: ClipboardCheck },
  { id: 'voice-interview', title: 'AI voice interview', short: 'Only when a client requests it — speak with our AI interviewer about your role.', icon: Mic },
  { id: 'timings', title: 'Publish intro timings', short: 'Choose slots on this page so clients can see when you are free.', icon: Clock },
];

/** Talent onboarding guide — calendar → skills test → publish intro slots. */
export default function TalentGuideModal({
  open,
  onClose,
  connectCalendarUrl = '',
  calendarConnected = false,
  assessmentDone = false,
  interviewUnlocked = false,
  interviewCompleted = false,
  introSlotsPublished = false,
  onScrollToTimings,
  onOpenAssessment,
  onOpenInterview,
}) {
  const visibleSteps = GUIDE_STEPS.filter((step) => step.id !== 'voice-interview' || interviewUnlocked);
  const doneById = {
    calendar: calendarConnected,
    assessment: assessmentDone,
    'voice-interview': interviewCompleted,
    timings: introSlotsPublished,
  };
  const completedCount = visibleSteps.filter((s) => doneById[s.id]).length;
  const allDone = completedCount === visibleSteps.length && visibleSteps.length > 0;

  const header = (
    <View style={styles.header}>
      <View pointerEvents="none" style={styles.glow} />
      <Pressable onPress={onClose} style={styles.close} hitSlop={10} accessibilityLabel="Close guide">
        <X size={16} color={colors.white} />
      </Pressable>
      <View style={styles.eyebrowRow}>
        <View style={styles.bookIcon}>
          <BookOpen size={14} color={colors.red} />
        </View>
        <Text style={[type.eyebrow, { color: colors.red, fontSize: 9 }]}>Talent guide</Text>
      </View>
      <Text style={styles.title}>Three quick wins</Text>
      <Text style={styles.subtitle}>Do these in order so clients can find you, trust your skills, and book intros.</Text>
      <View style={styles.progress}>
        {visibleSteps.map((s) => (
          <View key={s.id} style={styles.track}>
            <View style={[styles.fill, { width: doneById[s.id] ? '100%' : '35%', backgroundColor: doneById[s.id] ? colors.green500 : 'rgba(255,61,61,0.7)' }]} />
          </View>
        ))}
      </View>
      <Text style={[styles.progressText, allDone && { color: '#4ade80' }]}>
        {allDone ? "All set — you're ready for clients" : `${completedCount} of ${visibleSteps.length} complete`}
      </Text>
    </View>
  );

  return (
    <BottomSheet
      visible={open}
      onClose={onClose}
      header={header}
      scroll
      footer={
        <>
          <Text style={styles.footerNote}>
            Reopen from <Text style={styles.bold}>Talent guide</Text> on My Portal.
          </Text>
          <Button title="Got it" variant="outline" size="sm" iconRight={ArrowRight} onPress={onClose} />
        </>
      }
    >
      <View style={styles.steps}>
        {visibleSteps.map((step, index) => {
          const done = doneById[step.id];
          const Icon = step.icon;
          return (
            <View key={step.id} style={[styles.step, done && styles.stepDone]}>
              <View>
                <View style={[styles.stepIcon, { backgroundColor: done ? colors.green100 : colors.red10 }]}>
                  <Icon size={20} color={done ? colors.green700 : colors.red} />
                </View>
                <View style={[styles.stepBadge, { backgroundColor: done ? colors.green600 : colors.black }]}>
                  {done ? <Check size={10} color={colors.white} strokeWidth={3} /> : <Text style={styles.stepNum}>{index + 1}</Text>}
                </View>
              </View>
              <View style={styles.flex}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.short}</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.actions}>
          {!calendarConnected && connectCalendarUrl ? (
            <Button
              title="Connect calendar"
              size="sm"
              icon={Calendar}
              onPress={() => {
                Linking.openURL(connectCalendarUrl).catch(() => {});
                onClose();
              }}
            />
          ) : null}
          {!assessmentDone ? (
            <Button
              title="Skills test"
              size="sm"
              variant="outline"
              icon={ClipboardCheck}
              onPress={() => {
                onClose();
                onOpenAssessment?.();
              }}
            />
          ) : null}
          {interviewUnlocked && assessmentDone && !interviewCompleted ? (
            <Button
              title="AI voice interview"
              size="sm"
              variant="outline"
              icon={Mic}
              onPress={() => {
                onClose();
                onOpenInterview?.();
              }}
            />
          ) : null}
          {!introSlotsPublished ? (
            <Button
              title="Set timings"
              size="sm"
              variant="redSoft"
              icon={Clock}
              onPress={() => {
                onClose();
                onScrollToTimings?.();
              }}
            />
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { ...fonts.black, color: colors.gray700 },
  header: { backgroundColor: colors.black, padding: 20, paddingTop: 24, overflow: 'hidden', gap: 6 },
  glow: { position: 'absolute', top: -60, right: -60, width: 176, height: 176, borderRadius: 88, backgroundColor: colors.red, opacity: 0.3 },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,61,61,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,61,61,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...fonts.black, fontSize: 20, color: colors.white, marginTop: 4 },
  subtitle: { ...fonts.semibold, fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.7)', paddingRight: 30 },
  progress: { flexDirection: 'row', gap: 6, marginTop: 10 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  progressText: { ...fonts.bold, fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1 },
  steps: { gap: 10 },
  step: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.gray100,
    backgroundColor: 'rgba(249,250,251,0.8)',
    borderRadius: radius.lg,
    padding: 14,
  },
  stepDone: { borderColor: colors.green200, backgroundColor: 'rgba(240,253,244,0.6)' },
  stepIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { ...fonts.black, fontSize: 9, color: colors.white },
  stepTitle: { ...fonts.black, fontSize: 14, color: colors.gray900 },
  stepText: { ...fonts.medium, fontSize: 12, lineHeight: 17, color: colors.gray600, marginTop: 4 },
  actions: { gap: 8, marginTop: 6 },
  footerNote: { ...fonts.semibold, fontSize: 10, color: colors.gray500, textAlign: 'center' },
});

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, CheckCircle2, Headphones, Mic, PhoneOff, Radio, RefreshCw, Sparkles, Wifi } from 'lucide-react-native';
import { Button, ScoreBadge } from '@/shared/components/ui';
import { colors, fonts, radius, type } from '@/shared/theme';

const DIMENSION_LABELS = {
  experience: 'Experience & background',
  motivation: 'Motivation & role fit',
  communication: 'Communication & clarity',
  problem_solving: 'Problem solving & resilience',
  work_style_and_collaboration: 'Work style & collaboration',
};

const TIPS = [
  { icon: Mic, text: 'Find a quiet place and allow microphone access' },
  { icon: Headphones, text: 'Use headphones to reduce echo' },
  { icon: Wifi, text: 'Stable internet connection recommended' },
  { icon: Sparkles, text: 'Speak clearly — one question at a time' },
];

export function VoiceInterviewLanding({ context, onStart, isLoading, hasPreviousAttempt = false }) {
  const jobRole = context?.roleTitle || 'your role';
  return (
    <View style={styles.landing}>
      <View pointerEvents="none" style={styles.glowA} />
      <View pointerEvents="none" style={styles.glowB} />
      <View style={styles.eyebrow}>
        <Sparkles size={12} color={colors.red} />
        <Text style={[type.eyebrow, { color: colors.red }]}>AI voice interview</Text>
      </View>
      <Text style={styles.landingTitle}>{hasPreviousAttempt ? 'Ready for another interview?' : 'Ready for your interview?'}</Text>
      <Text style={styles.landingText}>
        You'll speak with our AI interviewer about the <Text style={styles.white}>{jobRole}</Text> position. It works like a
        phone call in the app — no video required.
      </Text>
      <View style={styles.tips}>
        {TIPS.map(({ icon: Icon, text }) => (
          <View key={text} style={styles.tip}>
            <Icon size={16} color={colors.red} />
            <Text style={styles.tipText}>{text}</Text>
          </View>
        ))}
      </View>
      {context?.assessed_skills?.length > 0 ? (
        <Text style={styles.muted}>Skills verified: {context.assessed_skills.join(', ')}</Text>
      ) : null}
      {hasPreviousAttempt ? (
        <Text style={styles.muted}>Your most recent score is saved — this attempt will create a new evaluation.</Text>
      ) : null}
      <Button
        title={isLoading ? 'Connecting…' : hasPreviousAttempt ? 'Retake voice interview' : 'Begin voice interview'}
        variant="danger"
        onPress={onStart}
        disabled={isLoading}
      />
    </View>
  );
}

function PulseCircle({ active, speaking, connecting }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return (
    <Animated.View style={[styles.mic, speaking ? styles.micSpeaking : styles.micIdle, { transform: [{ scale }] }]}>
      {connecting ? <Radio size={36} color={colors.white} /> : <Mic size={36} color={colors.white} />}
    </Animated.View>
  );
}

export function VoiceInterviewRoom({ isSpeaking, isConnecting, liveCaption, jobRole, onEnd }) {
  const statusLabel = isConnecting ? 'Connecting…' : isSpeaking ? 'Interviewer speaking' : 'Listening…';
  const chip = isConnecting
    ? { bg: colors.amber50, fg: colors.amber800, border: colors.amber200 }
    : isSpeaking
      ? { bg: colors.red10, fg: colors.red, border: colors.red20 }
      : { bg: colors.green50, fg: colors.green700, border: colors.green200 };

  return (
    <View style={styles.room}>
      <View style={styles.roomHead}>
        <View style={styles.flex}>
          <Text style={[type.eyebrow, { color: colors.red }]}>{jobRole}</Text>
          <Text style={styles.roomSub}>AI voice interview in progress</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: chip.bg, borderColor: chip.border }]}>
          <View style={[styles.dot, { backgroundColor: chip.fg }]} />
          <Text style={[styles.statusText, { color: chip.fg }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.stage}>
        <View pointerEvents="none" style={styles.glowA} />
        <PulseCircle active={isConnecting || isSpeaking} speaking={isSpeaking} connecting={isConnecting} />
        <Text style={styles.stageText}>
          {isConnecting
            ? 'Setting up your secure voice session…'
            : isSpeaking
              ? 'The interviewer is asking a question'
              : 'Your turn — answer when ready'}
        </Text>
      </View>

      <View style={styles.caption}>
        {liveCaption ? (
          <>
            <Text style={[type.eyebrow, { color: liveCaption.role === 'assistant' ? colors.red : colors.gray400, textAlign: 'center' }]}>
              {liveCaption.role === 'assistant' ? 'Interviewer' : 'You'}
            </Text>
            <Text style={[styles.captionText, { color: liveCaption.role === 'assistant' ? colors.black : colors.gray600 }]}>
              {liveCaption.text}
            </Text>
          </>
        ) : (
          <Text style={styles.captionEmpty}>Live captions will appear here as you speak…</Text>
        )}
      </View>

      <Button title="End interview" icon={PhoneOff} onPress={onEnd} />
    </View>
  );
}

export function VoiceInterviewComplete({ jobRole, onDone, onBackToPortal }) {
  return (
    <View style={styles.complete}>
      <View style={styles.doneCircle}>
        <CheckCircle2 size={36} color={colors.green600} />
      </View>
      <Text style={styles.completeTitle}>Interview complete</Text>
      <Text style={styles.completeText}>
        Thank you for completing your AI voice interview{jobRole ? ` for ${jobRole}` : ''}.
      </Text>
      <View style={styles.box}>
        <Text style={[type.eyebrow, { color: colors.gray400 }]}>What happens next</Text>
        <Text style={styles.boxText}>
          Your responses have been recorded. Your interview score is being evaluated and will appear here shortly — usually
          within a couple of minutes.
        </Text>
      </View>
      {onDone ? <Button title="View my score" variant="outline" onPress={onDone} /> : null}
      <Button title="Back to portal" iconRight={ArrowRight} onPress={onBackToPortal} />
    </View>
  );
}

function formatCompletedAt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function VoiceInterviewResults({ result, attemptCount = 0, onRetake, onRefresh, refreshing = false, scorePending = false }) {
  const score = result?.interview_score;
  const dimensionEntries = Object.entries(result?.dimensions || {}).filter(([, value]) => value != null);

  return (
    <View style={styles.results}>
      <View style={styles.center}>
        <View style={styles.resultIcon}>
          <Mic size={26} color={colors.white} />
        </View>
        <Text style={[type.eyebrow, { color: colors.red }]}>AI voice interview</Text>
        <Text style={styles.completeTitle}>Your latest interview score</Text>
        {result?.role_title ? <Text style={styles.completeText}>{result.role_title}</Text> : null}
        {result?.completed_at ? (
          <Text style={styles.muted2}>
            Completed {formatCompletedAt(result.completed_at)}
            {attemptCount > 1 ? ` · ${attemptCount} interviews on record` : ''}
          </Text>
        ) : null}
      </View>

      {scorePending ? (
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>
            {score == null ? 'Your interview was recorded — score is being processed' : 'Your latest interview is being evaluated'}
          </Text>
          <Text style={styles.pendingText}>
            {score == null
              ? 'Evaluation usually takes a minute or two. Refresh to load your latest score.'
              : 'The score below is your previous result until the new evaluation is ready. Refresh in a minute or two.'}
          </Text>
          {onRefresh ? (
            <Button
              title={refreshing ? 'Checking…' : 'Refresh score'}
              size="sm"
              icon={RefreshCw}
              fullWidth={false}
              loading={refreshing}
              onPress={onRefresh}
            />
          ) : null}
        </View>
      ) : null}

      {score != null ? (
        <View style={styles.center}>
          <ScoreBadge score={score} suffix="/100" large />
          <Text style={[type.eyebrow, { color: colors.gray500, marginTop: 4 }]}>Interview score</Text>
        </View>
      ) : null}

      {result?.interview_summary ? (
        <View style={styles.box}>
          <Text style={[type.eyebrow, { color: colors.gray400 }]}>Overall feedback</Text>
          <Text style={styles.boxText}>{result.interview_summary}</Text>
        </View>
      ) : null}

      {dimensionEntries.length > 0 ? (
        <View style={styles.dims}>
          <Text style={[type.eyebrow, { color: colors.gray400 }]}>How you were scored</Text>
          {dimensionEntries.map(([key, value]) => (
            <View key={key} style={styles.dim}>
              <Text style={styles.dimName}>{DIMENSION_LABELS[key] || key.replace(/_/g, ' ')}</Text>
              <Text style={styles.dimValue}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {onRefresh ? (
          <Button
            title={refreshing ? 'Refreshing…' : 'Refresh score'}
            variant="outline"
            icon={RefreshCw}
            loading={refreshing}
            onPress={onRefresh}
          />
        ) : null}
        {onRetake ? <Button title="Retake AI interview" iconRight={ArrowRight} onPress={onRetake} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  white: { ...fonts.bold, color: colors.white },
  center: { alignItems: 'center', gap: 6 },
  landing: { backgroundColor: colors.black, borderRadius: radius.xxl, padding: 24, gap: 18, overflow: 'hidden' },
  glowA: { position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.red, opacity: 0.25 },
  glowB: { position: 'absolute', bottom: -50, left: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.red, opacity: 0.15 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  landingTitle: { ...fonts.extrabold, fontSize: 28, lineHeight: 33, color: colors.white },
  landingText: { ...fonts.medium, fontSize: 14, lineHeight: 21, color: colors.gray300 },
  tips: { gap: 10 },
  tip: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    padding: 14,
  },
  tipText: { ...fonts.medium, fontSize: 13, lineHeight: 18, color: colors.gray200, flex: 1 },
  muted: { ...fonts.semibold, fontSize: 11, color: colors.gray400 },
  room: { gap: 18 },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomSub: { ...fonts.bold, fontSize: 12, color: colors.gray400, marginTop: 2 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...fonts.black, fontSize: 11 },
  stage: { backgroundColor: colors.black, borderRadius: radius.xxl, paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center', overflow: 'hidden', gap: 22 },
  mic: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  micSpeaking: { backgroundColor: colors.red },
  micIdle: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  stageText: { ...fonts.semibold, fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  caption: {
    minHeight: 120,
    justifyContent: 'center',
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderRadius: radius.lg,
    padding: 20,
    gap: 8,
  },
  captionText: { ...fonts.semibold, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  captionEmpty: { ...fonts.medium, fontSize: 13, color: colors.gray400, textAlign: 'center' },
  complete: { gap: 16, alignItems: 'stretch' },
  doneCircle: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: { ...fonts.extrabold, fontSize: 26, color: colors.black, textAlign: 'center' },
  completeText: { ...fonts.medium, fontSize: 14, color: colors.gray500, textAlign: 'center' },
  box: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray100, borderRadius: radius.lg, padding: 18, gap: 8 },
  boxText: { ...fonts.medium, fontSize: 14, lineHeight: 21, color: colors.gray700 },
  results: { gap: 22 },
  resultIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  muted2: { ...fonts.semibold, fontSize: 11, color: colors.gray400, textAlign: 'center' },
  pending: { backgroundColor: colors.amber50, borderWidth: 1, borderColor: colors.amber200, borderRadius: radius.lg, padding: 18, gap: 10, alignItems: 'center' },
  pendingTitle: { ...fonts.bold, fontSize: 14, color: colors.amber900, textAlign: 'center' },
  pendingText: { ...fonts.medium, fontSize: 12, lineHeight: 18, color: colors.amber800, textAlign: 'center' },
  dims: { gap: 10 },
  dim: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderRadius: radius.lg,
    padding: 14,
  },
  dimName: { ...fonts.black, fontSize: 12, color: colors.black, flex: 1 },
  dimValue: { ...fonts.black, fontSize: 14, color: colors.red },
  actions: { gap: 10 },
});

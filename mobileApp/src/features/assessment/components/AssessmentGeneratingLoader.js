import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { colors, fonts } from '@/shared/theme';

function TypingDots() {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0.25))).current;
  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(a, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.25, duration: 450, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <View style={styles.dots}>
      {anims.map((a, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: a }]} />
      ))}
    </View>
  );
}

/** Loader while Gemini generates skills-test questions. */
export default function AssessmentGeneratingLoader({ skill = '', elapsedSeconds = 0, statusLine = '' }) {
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sway]);

  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });
  const patienceHint =
    elapsedSeconds >= 45
      ? 'Thanks for waiting — this can take up to a minute when demand is high.'
      : elapsedSeconds >= 20
        ? 'Still crafting your questions… almost there.'
        : 'Usually 15–30 seconds. Please keep the app open.';

  return (
    <View style={styles.wrap} accessibilityLabel="Generating your skills test questions">
      <View style={styles.art}>
        <View style={styles.bubble}>
          <Text style={styles.bubbleLabel}>AI thinking</Text>
          <View style={styles.bubbleRow}>
            <Text style={styles.bubbleText}>Generating</Text>
            <TypingDots />
          </View>
        </View>
        <Animated.View style={[styles.figure, { transform: [{ rotate }] }]}>
          <UserRound size={52} color={colors.white} />
        </Animated.View>
        <View style={styles.clock}>
          <Text style={styles.clockText}>{elapsedSeconds > 0 ? `${elapsedSeconds}s` : '…'}</Text>
        </View>
      </View>

      {skill ? <Text style={styles.skill}>{skill}</Text> : null}
      <View style={styles.demand}>
        <Text style={styles.demandText}>Our AI model is experiencing high demand right now — sorry for the delay!</Text>
      </View>
      {statusLine ? <Text style={styles.status}>{statusLine}</Text> : null}
      <Text style={styles.hint}>{patienceHint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14, paddingVertical: 24 },
  art: { width: 280, height: 190, alignItems: 'center', justifyContent: 'flex-end' },
  bubble: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.black,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 148,
  },
  bubbleLabel: { ...fonts.black, fontSize: 9, color: colors.red, textTransform: 'uppercase', letterSpacing: 1.5 },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  bubbleText: { ...fonts.bold, fontSize: 11, color: colors.gray200 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },
  figure: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  clock: {
    position: 'absolute',
    right: 30,
    bottom: 24,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.gray100,
    borderWidth: 2,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockText: { ...fonts.black, fontSize: 10, color: colors.gray500 },
  skill: { ...fonts.bold, fontSize: 12, color: colors.red, textTransform: 'uppercase', letterSpacing: 2 },
  demand: { backgroundColor: colors.amber50, borderWidth: 1, borderColor: colors.amber200, borderRadius: 16, padding: 14 },
  demandText: { ...fonts.bold, fontSize: 13, lineHeight: 19, color: colors.amber900 },
  status: { ...fonts.extrabold, fontSize: 16, lineHeight: 22, color: colors.black, textAlign: 'center' },
  hint: { ...fonts.medium, fontSize: 13, color: colors.gray500, textAlign: 'center' },
});

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Image, Modal, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { fonts } from '@/shared/theme';

const logo = require('@/assets/images/logo.png');
const LOGO_SOURCE = Image.resolveAssetSource(logo);

const BACKGROUND = '#FBFBFB';
const DOT_COLOR = '#E94F47';
const TEXT_COLOR = '#333333';

const FADE_MS = 200;
const LOGO_WIDTH = 200;
const LOGO_HEIGHT = Math.round(LOGO_WIDTH * (LOGO_SOURCE.height / LOGO_SOURCE.width));

// Shimmer: band ~40% of the logo, skewed -20deg; 1.5s sweep + 3.5s pause = 5s cycle.
const SHINE_WIDTH = Math.round(LOGO_WIDTH * 0.4);
const SHINE_SWEEP_MS = 1500;
const SHINE_PAUSE_MS = 3500;

// Dots: 10px base, scale 1 → 3.2 → 1, 2.4s cycle, staggered 0 / 0.8 / 1.6s.
const DOT_SIZE = 10;
const DOT_SPACING = 20;
const DOT_MAX_SCALE = 3.2;
const DOT_CYCLE_MS = 2400;
const DOT_STAGGER_MS = 800;
const DOT_PULSE_MS = DOT_STAGGER_MS; // grow + shrink, so only one dot is big at a time

function useReduceMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduced(Boolean(v)));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduced(Boolean(v)));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/** Diagonal light sweep over the logo (left → right, then pause). */
function LogoShimmer() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: SHINE_SWEEP_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(SHINE_PAUSE_MS),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHINE_WIDTH * 1.5, LOGO_WIDTH + SHINE_WIDTH * 0.5],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.shine, { transform: [{ translateX }, { skewX: '-20deg' }] }]}
    >
      <Svg width={SHINE_WIDTH} height={LOGO_HEIGHT * 2}>
        <Defs>
          <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width={SHINE_WIDTH} height={LOGO_HEIGHT * 2} fill="url(#shine)" />
      </Svg>
    </Animated.View>
  );
}

/** One pulsing dot. Scale (not width/height) so layout never jumps. */
function PulseDot({ delay, reduced }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    value.setValue(0);
    const half = DOT_PULSE_MS / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: half, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: half, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(DOT_CYCLE_MS - DOT_PULSE_MS),
      ])
    );
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [delay, value]);

  const scale = reduced ? 1 : value.interpolate({ inputRange: [0, 1], outputRange: [1, DOT_MAX_SCALE] });
  const opacity = value.interpolate({ inputRange: [0, 1], outputRange: reduced ? [0.35, 1] : [0.75, 1] });

  return <Animated.View style={[styles.dot, { opacity, transform: [{ scale }] }]} />;
}

/** Branded loader content: logo shimmer, pulsing dots and a status line on #FBFBFB. */
export function BrandLoader({ message = 'Loading...' }) {
  const reduced = useReduceMotion();

  return (
    <View style={styles.fill}>
      <View
        style={styles.stack}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={message}
        accessibilityLiveRegion="polite"
        accessibilityState={{ busy: true }}
      >
        <View style={styles.logoBox}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          {reduced ? null : <LogoShimmer />}
        </View>

        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <PulseDot key={i} delay={i * DOT_STAGGER_MS} reduced={reduced} />
          ))}
        </View>

        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

/**
 * Full-screen branded loader for auth requests (login / register).
 * Fades in/out over 200ms and stays above everything (rendered in a Modal).
 */
export default function LoadingOverlay({ visible, message = 'Starting Up' }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      AccessibilityInfo.announceForAccessibility(message);
      return undefined;
    }
    const anim = Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true });
    anim.start(({ finished }) => finished && setMounted(false));
    return () => anim.stop();
  }, [visible, message, opacity]);

  if (!mounted) return null;

  // Explicit size: on Android the Modal's first frames can be laid out before it knows
  // the screen size, which would collapse an absoluteFill root to its content height.
  const { width, height } = Dimensions.get('screen');

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <Animated.View style={[styles.root, { width, height, opacity }]}>
        <BrandLoader message={message} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  fill: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: { alignItems: 'center' },
  logoBox: { width: LOGO_WIDTH, height: LOGO_HEIGHT, overflow: 'hidden' },
  logo: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
  shine: {
    position: 'absolute',
    top: -LOGO_HEIGHT / 2,
    left: 0,
    width: SHINE_WIDTH,
    height: LOGO_HEIGHT * 2,
  },
  dots: {
    marginTop: 24,
    height: 40,
    width: DOT_SPACING * 2 + DOT_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: DOT_COLOR,
  },
  text: {
    ...fonts.medium,
    marginTop: 10,
    fontSize: 14,
    color: TEXT_COLOR,
    letterSpacing: 0.3,
  },
});

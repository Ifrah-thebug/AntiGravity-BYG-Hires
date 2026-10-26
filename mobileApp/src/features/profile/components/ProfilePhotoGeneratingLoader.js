import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Sparkles, UserRound } from 'lucide-react-native';
import { colors, fonts } from '@/shared/theme';

/** Loader while the professional profile photo is being created. */
export default function ProfilePhotoGeneratingLoader({
  message = 'Creating professional studio photo…',
  hint = 'Usually takes 15–40 seconds',
  style,
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const lift = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  return (
    <View style={[styles.box, style]} accessibilityRole="progressbar" accessibilityLabel={message}>
      <View style={styles.art}>
        <Animated.View style={[styles.halo, { transform: [{ scale }] }]} />
        <Animated.View style={{ transform: [{ translateY: lift }], alignItems: 'center' }}>
          <Sparkles size={18} color={colors.red} />
          <View style={styles.figure}>
            <UserRound size={44} color={colors.white} />
          </View>
        </Animated.View>
      </View>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  art: { width: 120, height: 100, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.red5,
    borderWidth: 1,
    borderColor: colors.red10,
  },
  figure: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  message: { ...fonts.black, fontSize: 12, color: colors.gray700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  hint: { ...fonts.medium, fontSize: 10, color: colors.gray500 },
});

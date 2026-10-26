import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, type } from '@/shared/theme';

const VARIANTS = {
  // black → red on press (web: bg-black hover:bg-red)
  primary: { bg: colors.black, pressedBg: colors.red, fg: colors.white, border: colors.black },
  // red → black on press (web: bg-red hover:bg-black)
  danger: { bg: colors.red, pressedBg: colors.black, fg: colors.white, border: colors.red },
  // red outline (signup submit)
  outlineRed: { bg: colors.white, pressedBg: colors.red, fg: colors.red, pressedFg: colors.white, border: colors.red },
  outline: { bg: colors.white, pressedBg: colors.gray50, fg: colors.gray700, border: colors.gray200 },
  light: { bg: colors.gray100, pressedBg: colors.gray200, fg: colors.gray700, border: colors.gray200 },
  ghost: { bg: 'transparent', pressedBg: 'transparent', fg: colors.gray500, pressedFg: colors.black, border: 'transparent' },
  whiteOnDark: { bg: 'rgba(255,255,255,0.1)', pressedBg: 'rgba(255,255,255,0.2)', fg: colors.white, border: 'rgba(255,255,255,0.15)' },
  redSoft: { bg: colors.red5, pressedBg: colors.red, fg: colors.red, pressedFg: colors.white, border: colors.red20 },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  style,
  textStyle,
  fullWidth = true,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;
  const small = size === 'sm';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        small ? styles.sm : styles.lg,
        fullWidth && styles.full,
        {
          backgroundColor: pressed ? v.pressedBg : v.bg,
          borderColor: v.border,
          opacity: isDisabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {({ pressed }) => {
        const fg = pressed && v.pressedFg ? v.pressedFg : v.fg;
        const iconSize = small ? 13 : 15;
        return (
          <View style={styles.row}>
            {loading ? (
              <ActivityIndicator size="small" color={fg} />
            ) : Icon ? (
              <Icon size={iconSize} color={fg} />
            ) : null}
            {title ? (
              <Text
                style={[small ? type.buttonSmall : type.button, { color: fg }, textStyle]}
                numberOfLines={2}
              >
                {title}
              </Text>
            ) : null}
            {!loading && IconRight ? <IconRight size={iconSize} color={fg} /> : null}
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  lg: { minHeight: 54, paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.lg },
  sm: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});

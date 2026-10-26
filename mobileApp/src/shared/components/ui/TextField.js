import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, fonts, radius, type } from '@/shared/theme';
import FieldLabel from './FieldLabel';
import { useScrollToFocusedInput } from './Screen';

/** Web-style input: gray-50 fill, gray-200 border, red border on focus. */
export default function TextField({
  label,
  icon,
  required,
  hint,
  value,
  onChangeText,
  onBlur,
  onFocus,
  placeholder,
  secureTextEntry,
  revealToggle = false,
  multiline = false,
  numberOfLines = 4,
  keyboardType,
  autoCapitalize = 'sentences',
  autoComplete,
  editable = true,
  style,
  inputStyle,
  maxLength,
  contextMenuHidden,
  dark = false,
  labelRight,
  onRevealChange,
}) {
  const [focused, setFocused] = useState(false);
  const scrollToFocused = useScrollToFocusedInput();
  const [revealed, setRevealed] = useState(false);
  const toggleReveal = () => {
    const next = !revealed;
    setRevealed(next);
    onRevealChange?.(next);
  };
  const hidden = secureTextEntry && !revealed;

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <FieldLabel icon={icon} required={required} dark={dark}>
            {label}
          </FieldLabel>
          {labelRight}
        </View>
      ) : null}
      <View>
        <TextInput
          value={value == null ? '' : String(value)}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setFocused(true);
            scrollToFocused();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholder={placeholder}
          placeholderTextColor={dark ? 'rgba(255,255,255,0.3)' : colors.gray400}
          secureTextEntry={hidden}
          multiline={multiline}
          // Android caps visible lines to numberOfLines, so multiline fields grow via minHeight instead.
          numberOfLines={multiline ? undefined : 1}
          onContentSizeChange={multiline ? scrollToFocused : undefined}
          scrollEnabled={!multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          editable={editable}
          maxLength={maxLength}
          contextMenuHidden={contextMenuHidden}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.input,
            dark && styles.inputDark,
            multiline && { minHeight: 22 * numberOfLines + 28 },
            focused && { borderColor: colors.red, backgroundColor: dark ? 'rgba(255,255,255,0.05)' : colors.white },
            !editable && styles.disabled,
            revealToggle && secureTextEntry && { paddingRight: 48 },
            inputStyle,
          ]}
        />
        {revealToggle && secureTextEntry ? (
          <Pressable
            onPress={toggleReveal}
            style={styles.reveal}
            hitSlop={8}
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? <EyeOff size={18} color={colors.gray400} /> : <Eye size={18} color={colors.gray400} />}
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  input: {
    ...fonts.bold,
    fontSize: 14,
    color: colors.gray800,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  inputDark: {
    color: colors.white,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  disabled: { opacity: 0.6 },
  reveal: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  hint: { ...type.tiny, color: colors.gray400 },
});

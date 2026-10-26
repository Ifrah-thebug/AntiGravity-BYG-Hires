import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors, radius, type } from '@/shared/theme';

/**
 * Modal that slides up from the bottom — mobile version of the web's centered dialogs.
 * `header` replaces the default title row (e.g. black hero headers).
 */
export default function BottomSheet({
  visible,
  onClose,
  title,
  header,
  children,
  footer,
  maxHeight = '88%',
  scroll = false,
  background = colors.white,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { maxHeight, backgroundColor: background }]}>
          {header || (
            <View style={styles.titleRow}>
              <Text style={[type.eyebrow, styles.title]} numberOfLines={1}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
                <X size={16} color={colors.gray600} />
              </Pressable>
            </View>
          )}
          {scroll ? (
            <ScrollView
              style={styles.flexShrink}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.flexShrink]}>{children}</View>
          )}
          {footer ? (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View>
          ) : (
            <View style={{ height: Math.max(insets.bottom, 8) }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  title: { color: colors.gray500, flex: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 16 },
  flexShrink: { flexShrink: 1 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    backgroundColor: colors.gray50,
    gap: 8,
  },
});

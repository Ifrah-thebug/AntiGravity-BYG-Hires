import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, FileText, X } from 'lucide-react-native';
import { colors, fonts, radius } from '@/shared/theme';

/** Dashed "tap to upload" box (web: border-2 border-dashed rounded-2xl). */
export function UploadPrompt({ icon: Icon, title, subtitle, onPress, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.prompt, pressed && styles.promptPressed, disabled && { opacity: 0.6 }]}
    >
      <Icon size={32} color={colors.gray400} />
      <Text style={styles.promptTitle}>{title}</Text>
      {subtitle ? <Text style={styles.promptSub}>{subtitle}</Text> : null}
    </Pressable>
  );
}

/** "1.8 KB" / "2.40 MB" — a small CV should not read as "0.00 MB". */
function formatFileSize(bytes) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Selected CV card. */
export function SelectedFileCard({ file, onRemove, footer = 'CV ready for AI parsing' }) {
  const size = formatFileSize(file.size);
  return (
    <View style={styles.selected}>
      <View style={styles.fileRow}>
        <View style={styles.fileIcon}>
          <FileText size={18} color={colors.green600} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
          {size ? <Text style={styles.fileSize}>{size}</Text> : null}
        </View>
        {onRemove ? (
          <Pressable onPress={onRemove} style={styles.remove} hitSlop={8}>
            <X size={12} color={colors.gray400} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.readyRow}>
        <CheckCircle2 size={11} color={colors.green500} />
        <Text style={styles.ready}>{footer}</Text>
      </View>
    </View>
  );
}

/** Selected photo preview card. */
export function SelectedPhotoCard({ uri, onRemove, footer = 'Professional photo ready' }) {
  return (
    <View style={[styles.selected, styles.center]}>
      <View>
        <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
        {onRemove ? (
          <Pressable onPress={onRemove} style={styles.photoRemove} hitSlop={8}>
            <X size={11} color={colors.gray400} />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.readyRow, styles.readyCenter]}>
        <CheckCircle2 size={11} color={colors.green500} />
        <Text style={styles.ready}>{footer}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  prompt: {
    minHeight: 170,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.gray300,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  promptPressed: { borderColor: colors.red, backgroundColor: colors.gray50 },
  promptTitle: { ...fonts.black, fontSize: 12, color: colors.gray700 },
  promptSub: { ...fonts.medium, fontSize: 10, color: colors.gray400, textAlign: 'center', maxWidth: 260 },
  selected: {
    minHeight: 170,
    borderWidth: 1,
    borderColor: colors.green200,
    backgroundColor: 'rgba(240,253,244,0.6)',
    borderRadius: radius.lg,
    padding: 18,
    justifyContent: 'space-between',
  },
  center: { alignItems: 'center' },
  fileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.green200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { ...fonts.black, fontSize: 12, color: colors.green800 },
  fileSize: { ...fonts.medium, fontSize: 10, color: colors.green600 },
  remove: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.green200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.green200,
    paddingTop: 10,
    marginTop: 12,
  },
  readyCenter: { alignSelf: 'stretch', justifyContent: 'center' },
  ready: { ...fonts.black, fontSize: 9, color: colors.green700, textTransform: 'uppercase', letterSpacing: 1 },
  photo: { width: 96, height: 112, borderRadius: 16, borderWidth: 2, borderColor: colors.green500 },
  photoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.green200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

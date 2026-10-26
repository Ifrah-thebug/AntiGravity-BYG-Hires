import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, FileText, UploadCloud } from 'lucide-react-native';
import { Button } from '@/shared/components/ui';
import { colors, fonts } from '@/shared/theme';
import { pickCvFile } from '@/core/storage/files';
import { cvParseHeadline, friendlyCvParseMessage } from '@/features/onboarding/utils/cvParseDisplay';

function ShredderLoader() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-18, 10, -18] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.55, 1] });

  return (
    <View style={styles.shredder}>
      <Animated.View style={[styles.paper, { transform: [{ translateY }], opacity }]}>
        <FileText size={30} color={colors.black} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.line, { width: 44 - i * 8 }]} />
        ))}
      </Animated.View>
      <View style={styles.slot} />
    </View>
  );
}

/**
 * Unified CV parse / retry UI — black full screen while parsing,
 * friendly retry card when parsing fails (signup + invite).
 */
export default function CvParseOverlay({
  visible,
  parsing = false,
  message,
  fileName,
  context = 'signup',
  onReupload,
  onContinueManually,
}) {
  const [pickError, setPickError] = useState('');

  const handleReupload = async () => {
    setPickError('');
    try {
      const file = await pickCvFile();
      if (file) onReupload?.(file);
    } catch (err) {
      // Stay on the retry card, but say why (wrong type, over 5MB, unreadable file).
      setPickError(err?.message || 'Could not open the selected file.');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        {parsing ? (
          <View style={styles.center} accessibilityLiveRegion="polite">
            <ShredderLoader />
            <Text style={styles.title}>Parsing your CV…</Text>
            <Text style={styles.sub}>Extracting your skills, experience, and profile details…</Text>
            <Text style={styles.subMuted}>This usually takes 10–20 seconds. Please keep the app open.</Text>
            {fileName ? <Text style={styles.file} numberOfLines={1}>{fileName}</Text> : null}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.headRow}>
              <View style={styles.warnIcon}>
                <AlertTriangle size={20} color={colors.amber700} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{cvParseHeadline(context)}</Text>
                <Text style={styles.cardBody}>{friendlyCvParseMessage(message)}</Text>
                {fileName ? <Text style={styles.cardFile} numberOfLines={1}>File: {fileName}</Text> : null}
              </View>
            </View>

            <View style={styles.tips}>
              <View style={styles.tipRow}>
                <FileText size={12} color={colors.red} />
                <Text style={styles.tip}>Use a text-based PDF (not a scanned image if possible)</Text>
              </View>
              <View style={styles.tipRow}>
                <FileText size={12} color={colors.red} />
                <Text style={styles.tip}>Remove password protection · keep file under 5MB</Text>
              </View>
            </View>

            {pickError ? <Text style={styles.pickError}>{pickError}</Text> : null}
            {onReupload ? (
              <Button title="Re-upload CV & try again" variant="danger" icon={UploadCloud} onPress={handleReupload} />
            ) : null}
            {onContinueManually ? (
              <Button title="Continue and fill in manually" variant="outline" onPress={onContinueManually} />
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', gap: 8, maxWidth: 320 },
  title: { ...fonts.black, fontSize: 20, color: colors.white, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20 },
  sub: { ...fonts.medium, fontSize: 14, color: colors.gray400, textAlign: 'center' },
  subMuted: { ...fonts.medium, fontSize: 12, color: colors.gray500, textAlign: 'center' },
  file: { ...fonts.semibold, fontSize: 10, color: colors.gray600, marginTop: 6 },
  shredder: { width: 120, height: 110, alignItems: 'center', justifyContent: 'flex-end' },
  paper: {
    position: 'absolute',
    top: 0,
    width: 76,
    height: 86,
    backgroundColor: colors.white,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  line: { height: 3, borderRadius: 2, backgroundColor: colors.gray300 },
  slot: { width: 120, height: 18, borderRadius: 6, backgroundColor: colors.red },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 26,
    gap: 16,
  },
  headRow: { flexDirection: 'row', gap: 12 },
  warnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  cardTitle: { ...fonts.black, fontSize: 17, color: colors.gray900 },
  cardBody: { ...fonts.medium, fontSize: 13, lineHeight: 19, color: colors.gray600, marginTop: 4 },
  cardFile: { ...fonts.semibold, fontSize: 10, color: colors.gray400, marginTop: 8 },
  tips: { gap: 6 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tip: { ...fonts.medium, fontSize: 11, color: colors.gray500, flex: 1 },
  pickError: { ...fonts.semibold, fontSize: 12, color: colors.red, textAlign: 'center' },
});

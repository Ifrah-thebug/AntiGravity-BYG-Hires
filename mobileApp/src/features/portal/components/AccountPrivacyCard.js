import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Shield, Trash2 } from 'lucide-react-native';
import { BottomSheet, Button, Card, SectionHeader } from '@/shared/components/ui';
import { colors, fonts } from '@/shared/theme';
import { env } from '@/core/config/env';

// Same address and wording as the web /delete-account page (Play Store account-deletion link).
const SUPPORT_EMAIL = 'hr@bnyahyagroup.com';
const MAIL_SUBJECT = 'Delete my BYG Hires account';

function deletionMailto(name, email) {
  const body =
    'Hello BYG Hires team,\n\nPlease delete my BYG Hires account and all associated data.\n\n' +
    `Full name: ${name || ''}\nRegistered email: ${email || ''}\n\nThank you.`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(body)}`;
}

function LinkRow({ icon: Icon, label, onPress, danger = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.gray50 }]}
    >
      <Icon size={16} color={danger ? colors.red : colors.gray600} />
      <Text style={[styles.rowText, danger && { color: colors.red }]}>{label}</Text>
      <ChevronRight size={16} color={colors.gray400} />
    </Pressable>
  );
}

/** Privacy policy + account deletion request (Google Play: both must be reachable in-app). */
export default function AccountPrivacyCard({ name, email }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const openWeb = (path) => Linking.openURL(`${env.webAppUrl}${path}`).catch(() => {});

  const sendDeletionRequest = () => {
    setConfirmOpen(false);
    // No mail app on the device → the web page explains the same request process.
    Linking.openURL(deletionMailto(name, email)).catch(() => openWeb('/delete-account'));
  };

  return (
    <Card>
      <SectionHeader eyebrow="Account" eyebrowIcon={Shield} title="Account & privacy" />
      <View style={styles.list}>
        <LinkRow icon={Shield} label="Privacy policy" onPress={() => openWeb('/privacy')} />
        <LinkRow icon={Trash2} label="Delete my account" onPress={() => setConfirmOpen(true)} danger />
      </View>

      <BottomSheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete account">
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Delete your BYG Hires account?</Text>
          <Text style={styles.sheetText}>
            We will permanently delete your login, profile, CV, photos, portfolio, skills test results, voice interview
            recordings and chat messages. This cannot be undone.
          </Text>
          <Text style={styles.sheetText}>
            Your request is sent by email from <Text style={styles.bold}>{email}</Text>. We confirm by email once it is
            done, within 30 days.
          </Text>
          <Button title="Email deletion request" variant="danger" icon={Trash2} onPress={sendDeletionRequest} />
          <Button title="Cancel" variant="outline" onPress={() => setConfirmOpen(false)} />
          <Pressable onPress={() => openWeb('/delete-account')} hitSlop={8}>
            <Text style={styles.more}>More about account deletion</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 4, borderTopWidth: 1, borderTopColor: colors.gray100 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  rowText: { ...fonts.bold, flex: 1, fontSize: 14, color: colors.gray800 },
  sheet: { gap: 12 },
  sheetTitle: { ...fonts.black, fontSize: 18, color: colors.black },
  sheetText: { ...fonts.medium, fontSize: 13, lineHeight: 19, color: colors.gray600 },
  bold: { ...fonts.bold, color: colors.gray800 },
  more: { ...fonts.bold, fontSize: 12, color: colors.gray500, textAlign: 'center', textDecorationLine: 'underline' },
});

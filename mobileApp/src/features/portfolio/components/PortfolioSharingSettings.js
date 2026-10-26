import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Check, Copy, Globe, Link2, RefreshCw, Shield } from 'lucide-react-native';
import { Banner, Button, Card, Checkbox, InlineLoader, SectionHeader } from '@/shared/components/ui';
import { colors, fonts, radius, type } from '@/shared/theme';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { buildPortfolioPrivateShareUrl } from '@/shared/lib/portfolioShareUrl';
import {
  rotateTalentPortfolioShareToken,
  updateTalentPortfolioSharing,
} from '@/features/portfolio/api/portfolioAccessApi';
import { usePortfolioSharing } from '@/features/portfolio/hooks/usePortfolioSharing';

/** Public portfolio link on/off + private share token (web PortfolioSharingSettings). */
export default function PortfolioSharingSettings({ profileId, onChange }) {
  const { settings, setSettings, loading, shareUrl } = usePortfolioSharing(profileId);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState('');
  const { copy, copiedKey } = useCopyToClipboard();

  const privateShareUrl = buildPortfolioPrivateShareUrl({ profileId, shareToken: settings.shareToken });

  async function handleToggle() {
    setSaving(true);
    setError('');
    try {
      const data = await updateTalentPortfolioSharing({
        portfolioPublicEnabled: !settings.portfolioPublicEnabled,
      });
      setSettings((prev) => ({
        portfolioPublicEnabled: data.portfolioPublicEnabled !== false,
        shareToken: data.shareToken || prev.shareToken,
        directoryStatus: data.directoryStatus || prev.directoryStatus,
      }));
      onChange?.();
    } catch (err) {
      setError(err.message || 'Could not update setting.');
    } finally {
      setSaving(false);
    }
  }

  function handleRotate() {
    Alert.alert('New private link', 'Generate a new private link? Old private links will stop working.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Generate',
        onPress: async () => {
          setRotating(true);
          setError('');
          try {
            const data = await rotateTalentPortfolioShareToken();
            setSettings((prev) => ({
              ...prev,
              shareToken: data.shareToken || prev.shareToken,
              portfolioPublicEnabled: data.portfolioPublicEnabled !== false,
            }));
            onChange?.();
          } catch (err) {
            setError(err.message || 'Could not rotate link.');
          } finally {
            setRotating(false);
          }
        },
      },
    ]);
  }

  if (!profileId) return null;

  return (
    <Card>
      <SectionHeader
        eyebrow="Share your work"
        eyebrowIcon={Globe}
        title="Public portfolio link"
        description="Share your storybook on LinkedIn, GitHub, or your email signature — separate from BYG client requests."
      />

      {error ? <Banner tone="error" message={error} /> : null}

      {loading ? (
        <InlineLoader />
      ) : (
        <>
          <Checkbox checked={settings.portfolioPublicEnabled} onChange={handleToggle} disabled={saving}>
            <Text style={styles.toggleTitle}>Anyone with my link can view</Text>
            <Text style={styles.toggleText}>
              When on, your portfolio URL works like a public LinkedIn-style link. When off, only your private share link
              or approved BYG clients can view.
            </Text>
          </Checkbox>

          <View style={styles.linkBox}>
            <View style={styles.row}>
              <Link2 size={10} color={colors.gray400} />
              <Text style={[type.eyebrow, styles.linkLabel]}>
                {settings.portfolioPublicEnabled ? 'Public share link' : 'Private share link (use this when public is off)'}
              </Text>
            </View>
            <Text style={styles.url} selectable>{shareUrl}</Text>
            <Button
              title={copiedKey === 'main' ? 'Copied' : 'Copy link'}
              size="sm"
              icon={copiedKey === 'main' ? Check : Copy}
              fullWidth={false}
              onPress={() => copy(shareUrl, 'main')}
            />
          </View>

          {settings.portfolioPublicEnabled && privateShareUrl ? (
            <View style={[styles.linkBox, styles.linkBoxWhite]}>
              <View style={styles.row}>
                <Shield size={10} color={colors.gray400} />
                <Text style={[type.eyebrow, styles.linkLabel]}>Unlisted private link</Text>
              </View>
              <Text style={styles.small}>Optional — works even if you turn off public sharing later.</Text>
              <Text style={styles.url} selectable>{privateShareUrl}</Text>
              <View style={styles.actions}>
                <Button
                  title="Copy private link"
                  size="sm"
                  variant="outline"
                  icon={copiedKey === 'private' ? Check : Copy}
                  fullWidth={false}
                  onPress={() => copy(privateShareUrl, 'private')}
                />
                <Button
                  title="New private link"
                  size="sm"
                  variant="outline"
                  icon={RefreshCw}
                  loading={rotating}
                  fullWidth={false}
                  onPress={handleRotate}
                />
              </View>
            </View>
          ) : null}

          {!settings.portfolioPublicEnabled && privateShareUrl ? (
            <Button
              title="Generate new private link"
              size="sm"
              variant="ghost"
              icon={RefreshCw}
              loading={rotating}
              fullWidth={false}
              onPress={handleRotate}
            />
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleTitle: { ...fonts.black, fontSize: 14, color: colors.gray900 },
  toggleText: { ...fonts.medium, fontSize: 12, lineHeight: 18, color: colors.gray500, marginTop: 2 },
  linkBox: {
    borderWidth: 1,
    borderColor: colors.gray100,
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
  },
  linkBoxWhite: { backgroundColor: colors.white },
  linkLabel: { color: colors.gray400, fontSize: 9, flexShrink: 1 },
  url: { ...fonts.semibold, fontSize: 11, color: colors.gray600 },
  small: { ...fonts.medium, fontSize: 11, color: colors.gray500 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

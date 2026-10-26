import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Banner } from '@/shared/components/ui';
import { colors, fonts } from '@/shared/theme';
import { REVIEW_ISSUE_OPTIONS, isDirectoryLive } from '@/features/profile/utils/profileReview';

/** Upload warnings + directory review status banners shown at the top of the portal. */
export default function PortalStatusBanners({ profile, justSubmitted, uploadWarnings }) {
  const directoryStatus = profile?.directory_status || 'draft';
  const reviewIssueLabels = (profile?.review_issues || [])
    .map((code) => REVIEW_ISSUE_OPTIONS.find((o) => o.code === code)?.label || code)
    .filter(Boolean);

  return (
    <View style={styles.wrap}>
      {uploadWarnings?.length > 0 ? (
        <Banner tone="warning" title="Some files may need re-upload" icon={null}>
          {uploadWarnings.map((w, i) => (
            <Text key={i} style={styles.warnText}>{w}</Text>
          ))}
        </Banner>
      ) : null}

      {justSubmitted ? (
        <Banner
          tone="warning"
          title="Profile submitted for review"
          message="You are on our waitlist. We will email you when your profile is approved for the talent directory."
        />
      ) : null}

      {directoryStatus === 'pending_review' && !justSubmitted ? (
        <Banner
          tone="warning"
          title="On waitlist — pending admin review"
          message="Your profile is not visible on the talent directory yet. We typically review within a few business days."
        />
      ) : null}

      {directoryStatus === 'changes_requested' ? (
        <Banner tone="orange" title="Updates required before going live">
          <Text style={styles.orangeText}>
            Please fix the items below, then use <Text style={styles.bold}>Save & submit for review</Text> — your edits are
            saved and sent to admin in one step.
          </Text>
          {reviewIssueLabels.map((label) => (
            <Text key={label} style={styles.issue}>• {label}</Text>
          ))}
          {profile?.review_notes ? <Text style={styles.notes}>{profile.review_notes}</Text> : null}
        </Banner>
      ) : null}

      {isDirectoryLive(directoryStatus) ? (
        <Banner
          tone="success"
          title="Profile live on talent directory"
          message="Clients can now find you in the BYG Hires talent directory."
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  warnText: { ...fonts.semibold, fontSize: 12, color: colors.amber900 },
  orangeText: { ...fonts.medium, fontSize: 12, lineHeight: 18, color: colors.orange800 },
  bold: { ...fonts.black },
  issue: { ...fonts.semibold, fontSize: 12, color: colors.orange900, marginTop: 2 },
  notes: {
    ...fonts.medium,
    fontSize: 12,
    color: colors.orange900,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: '#ffedd5',
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
    overflow: 'hidden',
  },
});

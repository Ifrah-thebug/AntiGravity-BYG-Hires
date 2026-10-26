import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Camera, Check, Eye, Link2, LogOut, Plus, Sparkles } from 'lucide-react-native';
import { Avatar, DarkCard } from '@/shared/components/ui';
import { colors, fonts, radius, type } from '@/shared/theme';
import { AmbassadorReferredBadge } from '@/features/profile/components/Badges';

function HeaderAction({ icon: Icon, label, onPress, highlight = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        highlight && styles.actionRed,
        pressed && { backgroundColor: highlight ? colors.white : 'rgba(255,255,255,0.2)' },
      ]}
    >
      {({ pressed }) => (
        <>
          <Icon size={12} color={highlight && pressed ? colors.black : colors.white} />
          <Text style={[styles.actionText, highlight && pressed && { color: colors.black }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Black header card: photo (tap camera to replace), name, title and quick actions. */
export default function PortalHeaderCard({
  name,
  email,
  jobTitle,
  photo,
  photoProcessing,
  onPickPhoto,
  ambassadorReferred,
  profileId,
  directoryLive,
  shareCopied,
  onViewPublicProfile,
  onOpenPortfolio,
  onAddChapter,
  onSharePortfolio,
  onOpenGuide,
  onLogout,
}) {
  return (
    <DarkCard style={styles.card}>
      <View style={styles.row}>
        <View>
          <Avatar name={name} photo={photo} size={72} rounded={16} borderColor="rgba(255,255,255,0.2)" />
          <Pressable
            onPress={onPickPhoto}
            disabled={photoProcessing}
            style={[styles.camera, photoProcessing && { opacity: 0.5 }]}
            accessibilityLabel="Change profile photo"
            hitSlop={6}
          >
            <Camera size={12} color={colors.black} />
          </Pressable>
        </View>
        <View style={styles.flex}>
          <Text style={[type.eyebrow, { color: colors.gray400 }]}>Logged in as</Text>
          <Text style={styles.name} numberOfLines={1}>{name || email}</Text>
          <Text style={styles.title} numberOfLines={1}>{jobTitle || 'No title set yet'}</Text>
          {photoProcessing ? <Text style={styles.processing}>Processing photo…</Text> : null}
          {ambassadorReferred ? (
            <View style={{ marginTop: 8 }}>
              <AmbassadorReferredBadge variant="dark" />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        {profileId ? <HeaderAction icon={Eye} label="View Public Profile" onPress={onViewPublicProfile} /> : null}
        {profileId ? <HeaderAction icon={BookOpen} label="My portfolio" onPress={onOpenPortfolio} /> : null}
        {profileId ? <HeaderAction icon={Plus} label="Add chapter" onPress={onAddChapter} /> : null}
        {profileId && directoryLive ? (
          <HeaderAction
            icon={shareCopied ? Check : Link2}
            label={shareCopied ? 'Link copied' : 'Share my portfolio'}
            onPress={onSharePortfolio}
            highlight
          />
        ) : null}
        <HeaderAction icon={Sparkles} label="Talent guide" onPress={onOpenGuide} />
        <HeaderAction icon={LogOut} label="Logout" onPress={onLogout} />
      </View>
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  camera: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...fonts.black, fontSize: 19, color: colors.white, marginTop: 2 },
  title: { ...fonts.bold, fontSize: 13, color: colors.red, marginTop: 2 },
  processing: { ...fonts.bold, fontSize: 9, color: colors.gray400, textTransform: 'uppercase', marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionRed: { backgroundColor: colors.red, borderColor: colors.red },
  actionText: { ...fonts.black, fontSize: 10, color: colors.white, textTransform: 'uppercase', letterSpacing: 1.2 },
});

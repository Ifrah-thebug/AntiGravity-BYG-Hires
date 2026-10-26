import React, { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { ExternalLink, LogOut } from 'lucide-react-native';
import { Banner, Button, Card, Screen } from '@/shared/components/ui';
import { colors, fonts } from '@/shared/theme';
import { env } from '@/core/config/env';
import { useAuth } from '@/features/auth/context/AuthContext';
import { ROUTES } from '@/app/navigation/routes';
import AuthHeader from '@/features/auth/components/AuthHeader';

const COPY = {
  client: {
    title: 'Client account',
    body: 'This app is for BYG Hires talent. Your hiring dashboard is available on the BYG Hires website.',
    path: '/client',
  },
  admin: {
    title: 'Admin account',
    body: 'Admin tools are only available on the BYG Hires website.',
    path: '/admin/dashboard',
  },
  ambassador: {
    title: 'Ambassador account',
    body: 'The ambassador hub is available on the BYG Hires website.',
    path: '/ambassador/hub',
  },
};

/** Shown when a non-talent account signs in to the talent app. */
export default function NotTalentScreen({ navigation, route }) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const copy = COPY[route.params?.kind] || COPY.client;

  const handleLogout = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      navigation.reset({ index: 0, routes: [{ name: ROUTES.Login }] });
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AuthHeader eyebrow="Talent Portal" title={copy.title} />
      <Card elevated style={styles.card}>
        <Banner tone="info" message={copy.body} />
        {env.webAppUrl ? (
          <Button
            title="Open website"
            icon={ExternalLink}
            onPress={() => Linking.openURL(`${env.webAppUrl}${copy.path}`).catch(() => {})}
          />
        ) : null}
        <Button title="Logout" variant="outline" icon={LogOut} onPress={handleLogout} loading={busy} />
        <Text style={styles.note}>Talent accounts can log in here to manage their profile.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 32 },
  card: { padding: 24, gap: 16 },
  note: { ...fonts.medium, fontSize: 12, color: colors.gray500, textAlign: 'center' },
});

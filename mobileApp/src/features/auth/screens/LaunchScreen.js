import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RefreshCw, WifiOff } from 'lucide-react-native';
import { useAuth } from '@/features/auth/context/AuthContext';
import { isOfflineError, routeAfterAuth } from '@/app/navigation/routeAfterAuth';
import { ROUTES } from '@/app/navigation/routes';
import { BrandLoader, Button } from '@/shared/components/ui';
import { colors, fonts } from '@/shared/theme';

/** Splash: waits for the stored Supabase session, then routes like web `routeAfterAuth`. */
export default function LaunchScreen({ navigation }) {
  const { user, loading } = useAuth();
  const routed = useRef(false);
  const [offline, setOffline] = useState(false);

  const route = useCallback(() => {
    setOffline(false);
    routeAfterAuth(navigation).catch((err) => {
      // Offline: keep the stored session and offer a retry instead of signing the user out.
      if (isOfflineError(err)) {
        setOffline(true);
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: ROUTES.Login }] });
    });
  }, [navigation]);

  useEffect(() => {
    if (loading || routed.current) return;
    routed.current = true;

    if (!user) {
      navigation.reset({ index: 0, routes: [{ name: ROUTES.Login }] });
      return;
    }
    route();
  }, [loading, user, navigation, route]);

  if (offline) {
    return (
      <View style={styles.offline}>
        <WifiOff size={36} color={colors.red} />
        <Text style={styles.title}>You're offline</Text>
        <Text style={styles.body}>Check your internet connection, then try again.</Text>
        <Button title="Try again" icon={RefreshCw} onPress={route} style={styles.button} />
      </View>
    );
  }

  return <BrandLoader message="Loading..." />;
}

const styles = StyleSheet.create({
  offline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FBFBFB',
  },
  title: { ...fonts.bold, fontSize: 20, color: colors.gray900, marginTop: 16 },
  body: { ...fonts.medium, fontSize: 14, color: colors.gray500, textAlign: 'center', marginTop: 8 },
  button: { marginTop: 24, alignSelf: 'stretch' },
});

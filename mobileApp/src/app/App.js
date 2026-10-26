import React, { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import TalentChatLauncher from '@/features/chat/components/TalentChatLauncher';
import { colors } from '@/shared/theme';
import RootNavigator from './navigation/RootNavigator';
import { navigationRef } from './navigation/navigationRef';
import { linking } from './navigation/linking';

const styles = StyleSheet.create({ root: { flex: 1 } });

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.white, primary: colors.red },
};

export default function App() {
  const [routeName, setRouteName] = useState(null);

  const syncRoute = () => {
    setRouteName(navigationRef.getCurrentRoute()?.name ?? null);
  };

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <NavigationContainer
          ref={navigationRef}
          theme={navTheme}
          linking={linking}
          onReady={syncRoute}
          onStateChange={syncRoute}
        >
          <View style={styles.root}>
            <RootNavigator />
            <TalentChatLauncher routeName={routeName} />
          </View>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

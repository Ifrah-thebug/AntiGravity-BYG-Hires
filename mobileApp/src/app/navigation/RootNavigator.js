import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from './routes';
import LaunchScreen from '@/features/auth/screens/LaunchScreen';
import LoginScreen from '@/features/auth/screens/LoginScreen';
import ForgotPasswordScreen from '@/features/auth/screens/ForgotPasswordScreen';
import ResetPasswordScreen from '@/features/auth/screens/ResetPasswordScreen';
import NotTalentScreen from '@/features/auth/screens/NotTalentScreen';
import SignupScreen from '@/features/onboarding/screens/SignupScreen';
import ActivateScreen from '@/features/onboarding/screens/ActivateScreen';
import SetupScreen from '@/features/onboarding/screens/SetupScreen';
import PortalScreen from '@/features/portal/screens/PortalScreen';
import AssessmentScreen from '@/features/assessment/screens/AssessmentScreen';
import VoiceInterviewScreen from '@/features/interview/screens/VoiceInterviewScreen';
import PortfolioScreen from '@/features/portfolio/screens/PortfolioScreen';

const Stack = createNativeStackNavigator();

/**
 * Single stack, like the web router: screens guard themselves and
 * `routeAfterAuth` decides where a signed-in user lands.
 */
export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.Launch}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name={ROUTES.Launch} component={LaunchScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name={ROUTES.Login} component={LoginScreen} />
      <Stack.Screen name={ROUTES.Signup} component={SignupScreen} />
      <Stack.Screen name={ROUTES.ForgotPassword} component={ForgotPasswordScreen} />
      <Stack.Screen name={ROUTES.ResetPassword} component={ResetPasswordScreen} />
      <Stack.Screen name={ROUTES.Activate} component={ActivateScreen} />
      <Stack.Screen name={ROUTES.Setup} component={SetupScreen} />
      <Stack.Screen name={ROUTES.Portal} component={PortalScreen} />
      <Stack.Screen name={ROUTES.Assessment} component={AssessmentScreen} />
      <Stack.Screen name={ROUTES.VoiceInterview} component={VoiceInterviewScreen} />
      <Stack.Screen name={ROUTES.Portfolio} component={PortfolioScreen} />
      <Stack.Screen name={ROUTES.NotTalent} component={NotTalentScreen} />
    </Stack.Navigator>
  );
}

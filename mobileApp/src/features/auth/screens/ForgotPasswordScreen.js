import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowRight, CheckCircle2, Mail, Sparkles } from 'lucide-react-native';
import { Banner, Button, Card, Screen, TextField } from '@/shared/components/ui';
import { colors, fonts } from '@/shared/theme';
import { requestPasswordReset } from '@/features/auth/api/passwordResetApi';
import { ROUTES } from '@/app/navigation/routes';
import AuthHeader from '@/features/auth/components/AuthHeader';

/** Web: /forgot-password */
export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send reset link.');
    } finally {
      setLoading(false);
    }
  }

  const backToLogin = () => navigation.popTo(ROUTES.Login);

  return (
    <Screen contentStyle={styles.content}>
      <AuthHeader
        eyebrow="Account"
        title="Forgot password?"
        subtitle="Enter your email and we'll send a link to reset your password."
      />

      <Card elevated style={styles.card}>
        {sent ? (
          <View style={styles.success}>
            <CheckCircle2 size={40} color={colors.green500} />
            <Text style={styles.successText}>
              If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.
            </Text>
            <Text style={styles.muted}>
              The link opens the BYG Hires website — set your new password there, then log in here.
            </Text>
            <Button title="Back to login" variant="ghost" iconRight={ArrowRight} onPress={backToLogin} textStyle={{ color: colors.red }} />
          </View>
        ) : (
          <>
            {error ? <Banner tone="error" message={error} /> : null}

            <Banner tone="warning" icon={Sparkles} message="If you have not activated your account, activate it first :)" />

            <TextField
              label="Email"
              icon={Mail}
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Button
              title={loading ? 'Sending…' : 'Send reset link'}
              iconRight={ArrowRight}
              onPress={handleSubmit}
              loading={loading}
              disabled={!email.trim()}
            />

            <Text style={styles.backLink} onPress={backToLogin}>Back to login</Text>
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 32 },
  card: { padding: 24, gap: 20 },
  success: { alignItems: 'center', gap: 14 },
  successText: { ...fonts.semibold, fontSize: 14, lineHeight: 21, color: colors.gray700, textAlign: 'center' },
  muted: { ...fonts.medium, fontSize: 12, color: colors.gray500, textAlign: 'center' },
  backLink: { ...fonts.bold, fontSize: 12, color: colors.red, textAlign: 'center' },
});

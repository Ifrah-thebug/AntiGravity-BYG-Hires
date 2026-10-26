import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, ArrowRight, CheckCircle2, Lock, Mail } from 'lucide-react-native';
import { Banner, Button, Card, Screen, TextField } from '@/shared/components/ui';
import { colors, fonts, type } from '@/shared/theme';
import { completePasswordReset, verifyPasswordResetToken } from '@/features/auth/api/passwordResetApi';
import { ROUTES } from '@/app/navigation/routes';
import AuthHeader from '@/features/auth/components/AuthHeader';
import PasswordPeekBuddy from '@/features/auth/components/PasswordPeekBuddy';

/** Web: /reset-password?token= (opened via deep link). */
export default function ResetPasswordScreen({ navigation, route }) {
  const token = route.params?.token || '';

  const [verifyState, setVerifyState] = useState('loading');
  const [accountEmail, setAccountEmail] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const buddyState = useMemo(() => {
    const field = focusedField || 'password';
    return {
      value: field === 'confirm' ? confirmPassword : password,
      revealed: field === 'confirm' ? showConfirm : showPassword,
    };
  }, [focusedField, password, confirmPassword, showPassword, showConfirm]);

  useEffect(() => {
    if (!token) {
      setVerifyState('error');
      setVerifyError('Missing reset token. Check your email for the full link.');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const { ok, data } = await verifyPasswordResetToken(token);
        if (cancelled) return;
        if (!ok) {
          setVerifyState('error');
          setVerifyError(data.error || 'This reset link is not valid.');
          if (data.email) setAccountEmail(data.email);
          return;
        }
        setAccountEmail(data.email || '');
        setVerifyState('ready');
      } catch (err) {
        if (!cancelled) {
          setVerifyState('error');
          setVerifyError(err.message || 'Could not verify reset link.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit() {
    setSubmitError('');
    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await completePasswordReset({ token, password });
      setDone(true);
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: ROUTES.Login, params: { message: 'Password updated. Please log in.' } }],
        });
      }, 1500);
    } catch (err) {
      setSubmitError(err.message || 'Could not reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <AuthHeader eyebrow="Account" title="Reset password" subtitle="Choose a new password for your account." />

      <Card elevated style={styles.card}>
        {verifyState === 'loading' ? <Text style={styles.center}>Verifying your link…</Text> : null}

        {verifyState === 'error' ? (
          <View style={styles.stack}>
            <AlertTriangle size={32} color={colors.red} />
            <Text style={styles.message}>{verifyError}</Text>
            {accountEmail ? (
              <Text style={styles.muted}>
                Account: <Text style={styles.bold}>{accountEmail}</Text>
              </Text>
            ) : null}
            <Button
              title="Request a new link"
              variant="ghost"
              iconRight={ArrowRight}
              textStyle={{ color: colors.red }}
              onPress={() => navigation.navigate(ROUTES.ForgotPassword)}
            />
            <Text style={styles.muted} onPress={() => navigation.popTo(ROUTES.Login)}>Back to login</Text>
          </View>
        ) : null}

        {done ? (
          <View style={styles.stack}>
            <CheckCircle2 size={36} color={colors.green500} />
            <Text style={styles.doneTitle}>Password updated!</Text>
            <Text style={styles.muted}>Taking you to login…</Text>
          </View>
        ) : null}

        {verifyState === 'ready' && !done ? (
          <>
            <View style={styles.accountBox}>
              <Text style={[type.eyebrow, { color: colors.gray400 }]}>Account</Text>
              <View style={styles.row}>
                <Mail size={12} color={colors.gray500} />
                <Text style={styles.muted}>{accountEmail}</Text>
              </View>
            </View>

            <PasswordPeekBuddy value={buddyState.value} revealed={buddyState.revealed} />

            {submitError ? <Banner tone="error" message={submitError} /> : null}

            <TextField
              label="New password"
              icon={Lock}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              placeholder="At least 8 characters"
              secureTextEntry
              revealToggle
              onRevealChange={setShowPassword}
              autoCapitalize="none"
            />
            <TextField
              label="Confirm password"
              icon={Lock}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => setFocusedField('confirm')}
              placeholder="Repeat password"
              secureTextEntry
              revealToggle
              onRevealChange={setShowConfirm}
              autoCapitalize="none"
            />

            <Button
              title={submitting ? 'Updating…' : 'Update password'}
              iconRight={ArrowRight}
              onPress={handleSubmit}
              loading={submitting}
            />
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 32 },
  card: { padding: 24, gap: 18 },
  stack: { alignItems: 'center', gap: 12 },
  center: { ...fonts.bold, fontSize: 14, color: colors.gray500, textAlign: 'center' },
  message: { ...fonts.semibold, fontSize: 14, color: colors.gray700, textAlign: 'center' },
  muted: { ...fonts.semibold, fontSize: 12, color: colors.gray500 },
  bold: { ...fonts.bold },
  doneTitle: { ...fonts.black, fontSize: 16, color: colors.gray900 },
  accountBox: {
    padding: 14,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderRadius: 16,
    gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

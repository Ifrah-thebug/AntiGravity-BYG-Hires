import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, ArrowRight, CheckCircle2, Lock, Mail } from 'lucide-react-native';
import { Banner, Button, Card, Screen, TextField } from '@/shared/components/ui';
import { colors, fonts, type } from '@/shared/theme';
import { useAuth } from '@/features/auth/context/AuthContext';
import { completeTalentActivation, verifyTalentActivationToken } from '@/features/onboarding/api/talentInviteApi';
import { ROUTES } from '@/app/navigation/routes';
import AuthHeader from '@/features/auth/components/AuthHeader';

/** Web: /talent/activate?token= — invited talent sets a password. */
export default function ActivateScreen({ navigation, route }) {
  const token = route.params?.token || '';
  const { signIn } = useAuth();

  const [verifyState, setVerifyState] = useState('loading');
  const [talentEmail, setTalentEmail] = useState('');
  const [talentName, setTalentName] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifyState('error');
      setVerifyError('Missing activation token. Check your email for the full link.');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const { ok, data } = await verifyTalentActivationToken(token);
        if (cancelled) return;
        if (!ok) {
          setVerifyState('error');
          setVerifyError(data.error || 'This activation link is not valid.');
          if (data.email) setTalentEmail(data.email);
          if (data.name) setTalentName(data.name);
          return;
        }
        setTalentEmail(data.email || '');
        setTalentName(data.name || '');
        setVerifyState('ready');
      } catch (err) {
        if (!cancelled) {
          setVerifyState('error');
          setVerifyError(err.message || 'Could not verify activation link.');
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
      const data = await completeTalentActivation({ token, password });
      await signIn(data.email, password);
      setDone(true);
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: ROUTES.Setup,
              params: {
                inviteSetup: true,
                name: data.name,
                email: data.email,
                cvUrl: data.cvUrl || '',
                ambassadorId: data.ambassadorId || null,
                skipInviteCv: !data.hasCv && !data.cvUrl,
              },
            },
          ],
        });
      }, 1200);
    } catch (err) {
      setSubmitError(err.message || 'Could not activate account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <AuthHeader
        eyebrow="Talent Pool"
        title="Activate your account"
        subtitle="Set a password to complete your BYG Hires talent profile."
      />

      <Card elevated style={styles.card}>
        {verifyState === 'loading' ? <Text style={styles.center}>Verifying your link…</Text> : null}

        {verifyState === 'error' ? (
          <View style={styles.stack}>
            <AlertTriangle size={32} color={colors.red} />
            <Text style={styles.message}>{verifyError}</Text>
            {talentEmail ? (
              <Text style={styles.muted}>
                Account: <Text style={styles.bold}>{talentEmail}</Text>
              </Text>
            ) : null}
            <Button
              title="Go to login"
              variant="ghost"
              iconRight={ArrowRight}
              textStyle={{ color: colors.red }}
              onPress={() => navigation.popTo(ROUTES.Login)}
            />
          </View>
        ) : null}

        {done ? (
          <View style={styles.stack}>
            <CheckCircle2 size={36} color={colors.green500} />
            <Text style={styles.doneTitle}>Account activated!</Text>
            <Text style={styles.muted}>Taking you to profile setup…</Text>
          </View>
        ) : null}

        {verifyState === 'ready' && !done ? (
          <>
            <View style={styles.accountBox}>
              <Text style={[type.eyebrow, { color: colors.gray400 }]}>Account</Text>
              <Text style={styles.name}>{talentName || 'Talent'}</Text>
              <View style={styles.row}>
                <Mail size={12} color={colors.gray500} />
                <Text style={styles.muted}>{talentEmail}</Text>
              </View>
            </View>

            {submitError ? <Banner tone="error" message={submitError} /> : null}

            <TextField
              label="New password"
              icon={Lock}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              revealToggle
              autoCapitalize="none"
            />
            <TextField
              label="Confirm password"
              icon={Lock}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat password"
              secureTextEntry
              revealToggle
              autoCapitalize="none"
            />

            <Button
              title={submitting ? 'Activating…' : 'Activate & continue'}
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
  name: { ...fonts.black, fontSize: 14, color: colors.gray900 },
  doneTitle: { ...fonts.black, fontSize: 16, color: colors.gray900 },
  accountBox: { padding: 14, backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray100, borderRadius: 16, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

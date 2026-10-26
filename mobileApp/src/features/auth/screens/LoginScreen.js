import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Lock, Mail } from 'lucide-react-native';
import { Banner, Button, Card, LoadingOverlay, Screen, TextField } from '@/shared/components/ui';
import { colors, fonts, type } from '@/shared/theme';
import { useAuth } from '@/features/auth/context/AuthContext';
import { formatAuthError } from '@/features/auth/api/accountApi';
import { fetchLoginRoleHint, loginHintMessage } from '@/features/auth/api/roleHintApi';
import { routeAfterAuth } from '@/app/navigation/routeAfterAuth';
import { ROUTES } from '@/app/navigation/routes';
import AuthHeader from '@/features/auth/components/AuthHeader';

/** Web: /login (talent + client unified sign-in) — talent flavour. */
export default function LoginScreen({ navigation, route }) {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [successMessage] = useState(route.params?.message || '');
  const [loading, setLoading] = useState(false);
  const [roleHint, setRoleHint] = useState(null);
  const [hintLoading, setHintLoading] = useState(false);

  useEffect(() => {
    const em = form.email.trim().toLowerCase();
    if (!em || !em.includes('@')) {
      setRoleHint(null);
      setHintLoading(false);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setHintLoading(true);
      const role = await fetchLoginRoleHint(em);
      // A slower reply for an earlier email must not overwrite the current hint.
      if (cancelled) return;
      setRoleHint(role);
      setHintLoading(false);
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.email]);

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      await signIn(form.email.trim(), form.password);
      await routeAfterAuth(navigation);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  const hintText = loginHintMessage(roleHint);
  const canSubmit = Boolean(form.email && form.password) && !loading;

  return (
    <Screen contentStyle={styles.content}>
      <AuthHeader
        eyebrow="Talent Portal"
        title="Welcome back."
        subtitle="Log in to manage your profile, skills tests, portfolio and intro calls."
      />

      <Card elevated style={styles.card}>
        {error ? <Banner tone="error" message={error} /> : null}
        {successMessage && !error ? <Banner tone="success" message={successMessage} /> : null}

        <View style={styles.field}>
          <TextField
            label="Email Address"
            icon={Mail}
            value={form.email}
            onChangeText={(email) => setForm((f) => ({ ...f, email }))}
            placeholder="maria@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {hintLoading ? <Text style={styles.hintMuted}>Checking account type…</Text> : null}
          {!hintLoading && hintText ? (
            <Text style={[styles.hint, roleHint === 'client_pending' && styles.hintWarn]}>{hintText}</Text>
          ) : null}
        </View>

        <TextField
          label="Password"
          icon={Lock}
          value={form.password}
          onChangeText={(password) => setForm((f) => ({ ...f, password }))}
          placeholder="••••••••"
          secureTextEntry
          revealToggle
          autoCapitalize="none"
          autoComplete="password"
          labelRight={
            <Pressable onPress={() => navigation.navigate(ROUTES.ForgotPassword)} hitSlop={8}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          }
        />

        <Button
          title={loading ? 'Signing in…' : 'Log In'}
          iconRight={ArrowRight}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={loading}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Booked an intro? <Text style={styles.footerStrong}>Activate via the link in your email first.</Text>
          </Text>
          <Text style={styles.footerText}>
            Talent new here?{' '}
            <Text style={styles.footerLink} onPress={() => navigation.navigate(ROUTES.Signup)}>
              Join the Talent Pool
            </Text>
          </Text>
        </View>
      </Card>

      <LoadingOverlay visible={loading} message="Signing in..." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 32 },
  card: { padding: 24, gap: 20 },
  field: { gap: 8 },
  hintMuted: { ...type.tiny, color: colors.gray400 },
  hint: {
    ...type.tiny,
    color: colors.gray600,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray100,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hintWarn: { color: colors.amber800, backgroundColor: colors.amber50, borderColor: colors.amber200 },
  link: { ...type.label, color: colors.red },
  footer: { borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 16, gap: 8, alignItems: 'center' },
  footerText: { ...fonts.medium, fontSize: 12, color: colors.gray500, textAlign: 'center' },
  footerStrong: { color: colors.gray700 },
  footerLink: { ...fonts.bold, color: colors.red },
});

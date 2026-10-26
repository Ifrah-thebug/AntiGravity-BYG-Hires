import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Camera, ChevronRight, KeyRound, Lock, Mail, Sparkles, UploadCloud, User } from 'lucide-react-native';
import { Banner, Button, Card, Checkbox, LoadingOverlay, Screen, TextField } from '@/shared/components/ui';
import { colors, fonts, type } from '@/shared/theme';
import { useAuth } from '@/features/auth/context/AuthContext';
import { supabase } from '@/core/api/supabase';
import { env } from '@/core/config/env';
import { pickCvFile, readFileAsBase64, uploadSignupFiles } from '@/core/storage/files';
import { formatAuthError } from '@/features/auth/api/accountApi';
import { normalizeProfileName } from '@/shared/lib/formatDisplayName';
import { DEFAULT_TALENT_DEPARTMENT } from '@/shared/lib/talentDepartments';
import { formatProfileValidationErrors, validateProfileFields } from '@/features/profile/utils/profileContentPolicy';
import { useProfilePhotoUpload } from '@/features/profile/hooks/useProfilePhotoUpload';
import ProfilePhotoGeneratingLoader from '@/features/profile/components/ProfilePhotoGeneratingLoader';
import { parseCV } from '@/features/onboarding/api/geminiCv';
import { verifyAmbassadorCode } from '@/features/onboarding/api/ambassadorApi';
import { savePendingSetup } from '@/features/onboarding/storage/pendingSetup';
import CvParseOverlay from '@/features/onboarding/components/CvParseOverlay';
import AgreementModal from '@/features/onboarding/components/AgreementModal';
import { SelectedFileCard, SelectedPhotoCard, UploadPrompt } from '@/features/onboarding/components/UploadTile';
import { ROUTES } from '@/app/navigation/routes';

const MAX_CV_BYTES = 5 * 1024 * 1024;

const HOW_IT_WORKS = [
  { id: '01', title: 'DECLARE', desc: 'Upload your CV — our AI builds your profile. Review it, then submit for admin approval.' },
  { id: '02', title: 'DEMONSTRATE', desc: 'Complete a tailored, 25-min real-world client challenge.' },
  { id: '03', title: 'DEPLOY', desc: 'Once approved, your profile goes live in our talent directory for regional employers.' },
];

function StepHeading({ n, children }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepDot}>
        <Text style={styles.stepNum}>{n}</Text>
      </View>
      <Text style={styles.stepTitle}>{children}</Text>
    </View>
  );
}

/** Web: /talent/signup */
export default function SignupScreen({ navigation, route }) {
  const { signUp } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [ambassadorCode, setAmbassadorCode] = useState(() => String(route.params?.code || '').trim().toUpperCase());
  const [ambassadorId, setAmbassadorId] = useState(null);
  const [ambassadorHint, setAmbassadorHint] = useState('');
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [cvFile, setCvFile] = useState(null);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  // The error banner sits at the top of the form; the submit button is at the bottom.
  useEffect(() => {
    if (error) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [error]);
  const { photoFile, photoPreview, photoProcessing, photoProgress, handlePhotoSelect, clearPhoto } =
    useProfilePhotoUpload({ onError: setError });
  const [step, setStep] = useState('idle'); // idle | auth | parsing | uploading | done | cv-retry
  const [emailConfirmPending, setEmailConfirmPending] = useState(false);
  const [cvParseError, setCvParseError] = useState('');
  const [cvRetryParsing, setCvRetryParsing] = useState(false);

  useEffect(() => {
    const code = String(ambassadorCode || '').trim().toUpperCase();
    if (!code) {
      setAmbassadorId(null);
      setAmbassadorHint('');
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const data = await verifyAmbassadorCode(code);
        if (cancelled) return;
        setAmbassadorId(data.ambassador?.id || null);
        setAmbassadorHint(
          data.ambassador?.name
            ? `Linked to ambassador ${data.ambassador.name} (${data.ambassador.code})`
            : `Code ${data.ambassador?.code || code} accepted`
        );
      } catch {
        if (cancelled) return;
        setAmbassadorId(null);
        setAmbassadorHint('Code not recognized — you can still sign up without it.');
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ambassadorCode]);

  const handlePickCv = async () => {
    try {
      const file = await pickCvFile();
      if (!file) return;
      if (file.size && file.size > MAX_CV_BYTES) {
        setError('CV must be under 5MB.');
        return;
      }
      setCvFile(file);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not open the file picker.');
    }
  };

  const continueAfterParse = async (cvParsed, activeCvFile = cvFile) => {
    const { data: { session } } = await supabase.auth.getSession();

    const setupBase = {
      name: normalizeProfileName(form.name || cvParsed.name || ''),
      email: form.email.trim(),
      parsed: cvParsed,
      cvFile: activeCvFile,
      photoFile,
      cvUrl: '',
      photoUrl: '',
      uploadWarnings: [],
      ambassadorId: ambassadorId || null,
      ambassadorCode: ambassadorCode || null,
    };

    if (!session) {
      await savePendingSetup(setupBase);
      setEmailConfirmPending(true);
      setStep('done');
      return;
    }

    setStep('uploading');
    const { cvUrl, photoUrl, warnings } = await uploadSignupFiles(session.user.id, activeCvFile, photoFile);

    setStep('done');
    navigation.reset({
      index: 0,
      routes: [
        {
          name: ROUTES.Setup,
          params: {
            userId: session.user.id,
            email: setupBase.email,
            name: setupBase.name,
            parsed: cvParsed,
            cvUrl: cvUrl || '',
            photoUrl: photoUrl || '',
            cvFile: activeCvFile,
            photoFile,
            uploadWarnings: warnings,
            ambassadorId: ambassadorId || null,
          },
        },
      ],
    });
  };

  const parseCvFile = async (file) => {
    const base64 = await readFileAsBase64(file);
    return parseCV(base64, file.type || 'application/pdf');
  };

  const handleCvReupload = async (file) => {
    setCvFile(file);
    setError('');
    setCvParseError('');
    setCvRetryParsing(true);
    try {
      const result = await parseCvFile(file);
      if (!result.ok) {
        setCvParseError(result.message);
        setStep('cv-retry');
        return;
      }
      await continueAfterParse(result.parsed, file);
    } catch (err) {
      setCvParseError(err.message || 'Could not parse your CV.');
      setStep('cv-retry');
    } finally {
      setCvRetryParsing(false);
    }
  };

  const handleContinueManually = async () => {
    setError('');
    setCvParseError('');
    try {
      await continueAfterParse({
        name: form.name,
        job_title: '',
        skills: [],
        best_skill: '',
        experience_years: 3,
        department: DEFAULT_TALENT_DEPARTMENT,
        about: '',
      });
    } catch (err) {
      setStep('idle');
      setError(formatAuthError(err));
    }
  };

  const handleSubmit = async () => {
    setError('');
    setCvParseError('');

    if (!form.name || !form.email || !form.password || !cvFile || !photoFile) {
      setError('Please fill all fields and upload both your CV and photo.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const normalizedName = normalizeProfileName(form.name);
    const signupFieldErrors = validateProfileFields({ name: normalizedName, job_title: '', about: '', skills: [] });
    if (signupFieldErrors.length) {
      setError(formatProfileValidationErrors(signupFieldErrors));
      return;
    }

    try {
      setStep('auth');
      await signUp(form.email.trim(), form.password, { full_name: normalizedName });

      setStep('parsing');
      setCvParseError('');
      const parseResult = await parseCvFile(cvFile);
      if (!parseResult.ok) {
        setCvParseError(parseResult.message);
        setStep('cv-retry');
        return;
      }

      await continueAfterParse(parseResult.parsed, cvFile);
    } catch (err) {
      setStep('idle');
      setEmailConfirmPending(false);
      setError(formatAuthError(err));
    }
  };

  const showCvParseScreen = step === 'parsing' || step === 'cv-retry';
  const isLoading = step === 'auth' || step === 'uploading';
  const ready =
    !emailConfirmPending &&
    !isLoading &&
    !photoProcessing &&
    form.name &&
    form.email &&
    form.password &&
    cvFile &&
    photoFile &&
    agreementChecked;

  return (
    <Screen ref={scrollRef} contentStyle={styles.content}>
      {/* Hero */}
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroGlow} />
        <Text style={styles.heroTitle}>
          PROVE YOUR CRAFT.{'\n'}
          <Text style={{ color: colors.red }}>SKIP THE QUEUE.</Text>
        </Text>
        <View style={styles.heroBar} />
        <Text style={styles.heroBody}>
          No resume roulette. Complete a real-world task assessment, get scored, and make your profile stronger with your score.
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>Create your profile.</Text>
          <Text style={styles.introText}>
            Upload your CV — our AI will build your profile in seconds. Already have an account?{' '}
            <Text style={styles.link} onPress={() => navigation.popTo(ROUTES.Login)}>Log in</Text>
          </Text>
        </View>

        <Card elevated style={styles.card}>
          {emailConfirmPending ? (
            <Banner
              tone="success"
              title="Check your email to continue"
              message={`We saved your parsed profile. Confirm ${form.email}, then log in to finish setup.`}
            >
              <Text style={styles.bannerLink} onPress={() => navigation.popTo(ROUTES.Login)}>
                Go to Log In ›
              </Text>
            </Banner>
          ) : null}

          {error ? (
            <Banner tone="error" message={error}>
              {/already registered/i.test(error) ? (
                <Text style={styles.bannerLink} onPress={() => navigation.popTo(ROUTES.Login)}>Log in here</Text>
              ) : null}
            </Banner>
          ) : null}

          <View style={styles.section}>
            <StepHeading n="1">
              Upload CV <Text style={{ color: colors.red }}>*</Text>
            </StepHeading>
            {!cvFile ? (
              <UploadPrompt
                icon={UploadCloud}
                title="Tap to choose your CV"
                subtitle="PDF, PNG, JPG (max 5MB)"
                onPress={handlePickCv}
              />
            ) : (
              <SelectedFileCard file={cvFile} onRemove={() => setCvFile(null)} />
            )}
          </View>

          <View style={styles.section}>
            <StepHeading n="2">
              Profile Photo <Text style={{ color: colors.red }}>*</Text>
            </StepHeading>
            {photoProcessing ? (
              <ProfilePhotoGeneratingLoader message={photoProgress || 'Creating professional studio photo…'} />
            ) : photoPreview ? (
              <SelectedPhotoCard uri={photoPreview} onRemove={clearPhoto} />
            ) : (
              <UploadPrompt
                icon={Camera}
                title="Upload headshot"
                subtitle="Front-facing selfie (JPG, PNG, or HEIC). We'll turn it into a professional studio photo."
                onPress={handlePhotoSelect}
              />
            )}
          </View>

          <View style={styles.section}>
            <StepHeading n="3">Your Details</StepHeading>
            <TextField
              label="Full Name"
              icon={User}
              required
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
              placeholder="Maria Silva"
              autoCapitalize="words"
            />
            <TextField
              label="Email Address"
              icon={Mail}
              required
              value={form.email}
              onChangeText={(email) => setForm((f) => ({ ...f, email }))}
              placeholder="maria@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextField
              label="Password"
              icon={Lock}
              required
              value={form.password}
              onChangeText={(password) => setForm((f) => ({ ...f, password }))}
              placeholder="Min. 6 characters"
              secureTextEntry
              revealToggle
              autoCapitalize="none"
            />
            <View style={styles.ambassador}>
              <TextField
                label="Ambassador code (optional)"
                icon={KeyRound}
                value={ambassadorCode}
                onChangeText={(v) => setAmbassadorCode(v.toUpperCase())}
                placeholder="e.g. BYG-STAR-01"
                autoCapitalize="characters"
                inputStyle={styles.codeInput}
              />
              <Text style={[styles.hint, ambassadorHint && ambassadorId ? { color: colors.emerald700 } : null]}>
                {ambassadorHint || 'Have a referral code? Add it here — signup works the same without one.'}
              </Text>
            </View>
          </View>

          <View style={styles.aiBox}>
            <Sparkles size={18} color={colors.red} />
            <Text style={styles.aiText}>
              Our AI reads your CV and drafts your title, skills, and bio. You review and edit everything, then submit
              for admin approval before your profile goes live on the talent directory.
            </Text>
          </View>

          <View style={styles.agreeBox}>
            <Checkbox checked={agreementChecked} onChange={setAgreementChecked}>
              <Text style={styles.agreeText}>
                I agree to the{' '}
                <Text style={styles.agreeLink} onPress={() => setShowAgreementModal(true)}>
                  Candidate Talent Pool Agreement.
                </Text>
              </Text>
            </Checkbox>
            <Text style={styles.privacyText}>
              How we use your CV, photo and answers:{' '}
              <Text style={styles.agreeLink} onPress={() => Linking.openURL(`${env.webAppUrl}/privacy`).catch(() => {})}>
                Privacy Policy
              </Text>
            </Text>
          </View>

          <Button
            title="Submit and parse CV"
            variant={ready ? 'outlineRed' : 'light'}
            iconRight={ChevronRight}
            onPress={handleSubmit}
            disabled={!ready}
          />
        </Card>

        <View style={styles.how}>
          <Text style={styles.howTitle}>How It Works</Text>
          <View style={styles.howCard}>
            {HOW_IT_WORKS.map((s) => (
              <View key={s.id} style={styles.howRow}>
                <Text style={styles.howId}>{s.id}</Text>
                <View style={styles.flex}>
                  <Text style={styles.howStep}>{s.title}</Text>
                  <Text style={styles.howDesc}>{s.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Register request in progress */}
      <LoadingOverlay visible={step === 'auth'} message="Creating account..." />

      {/* File upload after the account is created */}
      <Modal visible={step === 'uploading'} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.red} />
          <Text style={styles.overlayTitle}>Uploading Your Files…</Text>
          <Text style={styles.overlayText}>Saving your CV and photo to secure storage.</Text>
        </View>
      </Modal>

      <CvParseOverlay
        visible={showCvParseScreen}
        parsing={step === 'parsing' || cvRetryParsing}
        message={cvParseError}
        fileName={cvFile?.name}
        context="signup"
        onReupload={handleCvReupload}
        onContinueManually={handleContinueManually}
      />

      <AgreementModal
        visible={showAgreementModal}
        onClose={() => setShowAgreementModal(false)}
        onAccept={() => {
          setAgreementChecked(true);
          setShowAgreementModal(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 0, paddingTop: 0 },
  hero: { backgroundColor: colors.black, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40, overflow: 'hidden', alignItems: 'center' },
  heroGlow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.red,
    opacity: 0.2,
  },
  heroTitle: { ...fonts.black, fontSize: 34, lineHeight: 38, color: colors.white, textAlign: 'center' },
  heroBar: { width: 72, height: 6, backgroundColor: colors.red, marginVertical: 16 },
  heroBody: { ...fonts.medium, fontSize: 14, lineHeight: 21, color: colors.gray400, textAlign: 'center', maxWidth: 420 },
  body: { paddingHorizontal: 16, paddingTop: 28, gap: 24 },
  intro: { alignItems: 'center', gap: 8 },
  introTitle: { ...fonts.bold, fontSize: 24, color: colors.black },
  introText: { ...fonts.medium, fontSize: 13, lineHeight: 19, color: colors.gray500, textAlign: 'center', maxWidth: 340 },
  link: { ...fonts.bold, color: colors.red },
  card: { padding: 22, gap: 26 },
  bannerLink: { ...fonts.black, fontSize: 11, color: colors.red, textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 },
  section: { gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  stepNum: { ...fonts.bold, fontSize: 10, color: colors.white },
  stepTitle: { ...fonts.black, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.black },
  ambassador: { gap: 6 },
  codeInput: { letterSpacing: 1.5 },
  hint: { ...fonts.medium, fontSize: 11, color: colors.gray400 },
  aiBox: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 16,
    padding: 14,
  },
  aiText: { ...fonts.bold, fontSize: 11, lineHeight: 16, color: colors.gray600, flex: 1 },
  agreeBox: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200, borderRadius: 12, padding: 14 },
  agreeText: { ...fonts.bold, fontSize: 12, lineHeight: 18, color: colors.gray600 },
  agreeLink: { ...fonts.black, color: colors.red },
  privacyText: { ...fonts.medium, fontSize: 11, lineHeight: 16, color: colors.gray500, marginTop: 10, marginLeft: 32 },
  how: { gap: 12 },
  howTitle: { ...type.eyebrow, fontSize: 13, color: colors.gray800, paddingHorizontal: 8 },
  howCard: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200, borderRadius: 28, padding: 22, gap: 22 },
  howRow: { flexDirection: 'row', gap: 14 },
  howId: { ...fonts.black, fontSize: 10, color: colors.red, width: 18 },
  howStep: { ...fonts.black, fontSize: 14, color: colors.black, textTransform: 'uppercase', marginBottom: 4 },
  howDesc: { ...fonts.medium, fontSize: 12, lineHeight: 18, color: colors.gray500 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  overlayTitle: { ...fonts.black, fontSize: 19, color: colors.white, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginTop: 12 },
  overlayText: { ...fonts.medium, fontSize: 13, color: colors.gray400, textAlign: 'center' },
});

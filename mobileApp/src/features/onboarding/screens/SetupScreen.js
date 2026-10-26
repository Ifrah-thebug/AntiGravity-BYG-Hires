import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Camera, Mail, Sparkles } from 'lucide-react-native';
import { Banner, BrandLoader, Button, Card, Screen } from '@/shared/components/ui';
import { colors, fonts, type } from '@/shared/theme';
import { supabase } from '@/core/api/supabase';
import { uploadSignupFiles, uploadTalentFile } from '@/core/storage/files';
import { useAuth } from '@/features/auth/context/AuthContext';
import { formatAuthError } from '@/features/auth/api/accountApi';
import { normalizeProfileName } from '@/shared/lib/formatDisplayName';
import { DEFAULT_TALENT_DEPARTMENT, normalizeTalentDepartment } from '@/shared/lib/talentDepartments';
import {
  DEFAULT_MONTHLY_FEE_USD,
  PROFILE_CONTENT_HINT,
  availabilityToForm,
  formatProfileValidationErrors,
  prepareProfileForSave,
  validateProfileFields,
} from '@/features/profile/utils/profileContentPolicy';
import { submitProfileForReview, upsertTalentProfile } from '@/features/profile/api/profileApi';
import { useProfilePhotoUpload } from '@/features/profile/hooks/useProfilePhotoUpload';
import ProfilePhotoGeneratingLoader from '@/features/profile/components/ProfilePhotoGeneratingLoader';
import ProfileSkillsEditor from '@/features/profile/components/ProfileSkillsEditor';
import ProfileFields from '@/features/profile/components/ProfileFields';
import { clearPendingSetup, loadPendingSetup } from '@/features/onboarding/storage/pendingSetup';
import {
  fetchInviteSetupStatus,
  parseInviteCvOnSetup,
  reuploadInviteCvOnSetup,
} from '@/features/onboarding/api/talentInviteApi';
import CvParseOverlay from '@/features/onboarding/components/CvParseOverlay';
import { SelectedPhotoCard, UploadPrompt } from '@/features/onboarding/components/UploadTile';
import { ROUTES } from '@/app/navigation/routes';

function formFromParsed(parsed, name) {
  return {
    name: normalizeProfileName(name || ''),
    job_title: parsed?.job_title || '',
    about: parsed?.about || '',
    experience_years: parsed?.experience_years ?? 3,
    monthly_fee_usd: parsed?.monthly_fee_usd ?? DEFAULT_MONTHLY_FEE_USD,
    ...availabilityToForm(parsed?.availability),
    role_type: parsed?.role_type || 'flexible',
    department: normalizeTalentDepartment(parsed?.department || DEFAULT_TALENT_DEPARTMENT),
    skills: parsed?.skills || [],
    best_skill: parsed?.best_skill || parsed?.skills?.[0] || '',
  };
}

/** Web: /talent/setup — review the AI-parsed profile, then submit for admin review. */
export default function SetupScreen({ navigation, route }) {
  const stateData = route.params || {};
  const { session, loading: authLoading } = useAuth();

  const [pending, setPending] = useState(null);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [form, setForm] = useState(() => formFromParsed(stateData.parsed, stateData.name));
  const [cvUrl, setCvUrl] = useState(stateData.cvUrl || '');
  const [photoUrl, setPhotoUrl] = useState(stateData.photoUrl || '');
  const [cvFile, setCvFile] = useState(stateData.cvFile || null);
  const [legacyPhotoFile, setLegacyPhotoFile] = useState(stateData.photoFile || null);
  const [uploadWarnings, setUploadWarnings] = useState(stateData.uploadWarnings || []);
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { photoFile: uploadedPhotoFile, photoPreview, photoProcessing, photoProgress, handlePhotoSelect, clearPhoto } =
    useProfilePhotoUpload({ onError: setError });
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);
  const [parsingInvite, setParsingInvite] = useState(false);
  const [inviteFlow, setInviteFlow] = useState(Boolean(stateData.inviteSetup));
  const [cvParseFailed, setCvParseFailed] = useState(false);
  const [cvParseError, setCvParseError] = useState('');
  const [reuploadingCv, setReuploadingCv] = useState(false);
  const [inviteCvFileName, setInviteCvFileName] = useState('');
  const [ambassadorId, setAmbassadorId] = useState(stateData.ambassadorId || null);
  const inviteChecked = useRef(false);

  const applyParsedToForm = useCallback((parsed, nameOverride) => {
    if (!parsed) return;
    setForm((f) => ({
      ...f,
      name: normalizeProfileName(nameOverride || parsed.name || f.name),
      job_title: parsed.job_title || f.job_title,
      about: parsed.about || f.about,
      experience_years: parsed.experience_years ?? f.experience_years,
      skills: parsed.skills?.length ? parsed.skills : f.skills,
      best_skill: parsed.best_skill || parsed.skills?.[0] || f.best_skill,
      department: normalizeTalentDepartment(parsed.department || f.department),
    }));
  }, []);

  // Pending signup draft (email confirmation flow) — web keeps it in sessionStorage.
  useEffect(() => {
    let alive = true;
    // Only this account's draft (routeAfterAuth passes the signed-in email).
    loadPendingSetup(stateData.email).then((p) => {
      if (!alive) return;
      setPending(p);
      setPendingLoaded(true);
      if (p && !stateData.parsed) {
        setForm(formFromParsed(p.parsed, p.name));
        setPhotoUrl(p.photoUrl || '');
        setCvUrl(p.cvUrl || '');
        setUploadWarnings(p.uploadWarnings || []);
        if (p.cvFile) setCvFile(p.cvFile);
        if (p.photoFile) setLegacyPhotoFile(p.photoFile);
        if (p.ambassadorId) setAmbassadorId(p.ambassadorId);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authLoading || !pendingLoaded) return;

    const hasSetupData = Boolean(
      stateData.parsed || pending?.parsed || stateData.name || pending?.name || stateData.inviteSetup || stateData.cvUrl
    );

    if (!session && !hasSetupData) {
      navigation.reset({ index: 0, routes: [{ name: ROUTES.Signup }] });
      return;
    }
    setAwaitingEmailConfirm(!session && hasSetupData);
  }, [authLoading, pendingLoaded, session, pending, stateData.parsed, stateData.name, stateData.inviteSetup, stateData.cvUrl, navigation]);

  // Invited talent: CV imported by BYG Hires is parsed on the server.
  // Keyed on the user id, not the session object: token refreshes must not cancel the parse.
  const sessionUserId = session?.user?.id;
  useEffect(() => {
    if (authLoading || !sessionUserId || inviteChecked.current) return undefined;
    inviteChecked.current = true;
    let cancelled = false;

    (async () => {
      try {
        const status = await fetchInviteSetupStatus();
        if (cancelled || !status.hasInvite) return;

        if (status.ambassadorId) setAmbassadorId(status.ambassadorId);

        if (status.hasInvite && status.hasCv === false) {
          setInviteFlow(true);
          if (status.name) setForm((f) => ({ ...f, name: status.name || f.name }));
          return;
        }

        setInviteFlow(true);
        if (status.cvUrl) setCvUrl(status.cvUrl);
        if (status.originalFilename) setInviteCvFileName(status.originalFilename);

        if (status.parseStatus === 'parsed' && status.parsed) {
          applyParsedToForm(status.parsed, status.name);
          return;
        }

        if (status.parseStatus === 'failed') {
          setCvParseFailed(true);
          setCvParseError(status.parseError || 'Could not parse your CV. Please re-upload a clear PDF.');
          return;
        }

        setParsingInvite(true);
        const result = await parseInviteCvOnSetup();
        if (cancelled) return;
        if (result.skipped) {
          if (status.name) setForm((f) => ({ ...f, name: status.name || f.name }));
          return;
        }
        if (result.parsed) applyParsedToForm(result.parsed, result.name || status.name);
        if (result.cvUrl) setCvUrl(result.cvUrl);
      } catch (err) {
        if (!cancelled) {
          setInviteFlow(true);
          setCvParseFailed(true);
          setCvParseError(err.message || 'Could not parse your CV. Please re-upload a clear PDF.');
        }
      } finally {
        setParsingInvite(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, sessionUserId, applyParsedToForm]);

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s) return;
    const skillErrors = validateProfileFields({ name: '', job_title: '', about: '', skills: [s] });
    if (skillErrors.length) {
      setError(skillErrors[0]);
      return;
    }
    if (form.skills.length < 8 && !form.skills.includes(s)) {
      setForm((f) => ({ ...f, skills: [...f.skills, s], best_skill: f.best_skill || s }));
      setNewSkill('');
      setError('');
    }
  };

  const activePhotoFile = uploadedPhotoFile || legacyPhotoFile;
  const existingPhoto = photoUrl?.startsWith('http') ? photoUrl : legacyPhotoFile?.uri || '';
  const hasProfilePhoto = Boolean(photoPreview || activePhotoFile || photoUrl?.startsWith('http'));

  const ensureFileUrls = async (userId) => {
    let nextCv = cvUrl;
    let nextPhoto = photoUrl;
    const warnings = [...uploadWarnings];

    if (cvFile && !nextCv?.startsWith('http')) {
      try {
        nextCv = await uploadTalentFile(userId, cvFile, 'cv');
      } catch (e) {
        warnings.push(`CV upload: ${e.message}`);
      }
    }

    if (activePhotoFile && (uploadedPhotoFile || !nextPhoto?.startsWith('http'))) {
      try {
        nextPhoto = await uploadTalentFile(userId, activePhotoFile, 'photo');
      } catch (e) {
        warnings.push(`Photo upload: ${e.message}`);
      }
    }

    if (!nextCv?.startsWith('http') && !nextPhoto?.startsWith('http') && cvFile && activePhotoFile) {
      const result = await uploadSignupFiles(userId, cvFile, activePhotoFile);
      if (result.cvUrl) nextCv = result.cvUrl;
      if (result.photoUrl) nextPhoto = result.photoUrl;
      warnings.push(...result.warnings);
    }

    setCvUrl(nextCv);
    setPhotoUrl(nextPhoto);
    setUploadWarnings(warnings);
    return { cvUrl: nextCv, photoUrl: nextPhoto, warnings };
  };

  const handleConfirm = async () => {
    setError('');
    if (!hasProfilePhoto) {
      setError('Please upload a profile photo before saving.');
      return;
    }
    const prepared = prepareProfileForSave(form);
    if (!prepared.ok) {
      setError(formatProfileValidationErrors(prepared.errors));
      return;
    }

    setSaving(true);
    try {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!activeSession) {
        throw new Error('No active session. Please confirm your email, then log in to save your profile.');
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Authenticated user could not be found. Please try again.');

      const { cvUrl: finalCv, photoUrl: finalPhoto, warnings: fileWarnings } = await ensureFileUrls(authUser.id);

      await upsertTalentProfile({
        user_id: authUser.id,
        email: authUser.email,
        name: prepared.data.name,
        job_title: prepared.data.job_title,
        about: prepared.data.about,
        skills: prepared.data.skills,
        best_skill: prepared.data.best_skill,
        experience_years: prepared.data.experience_years,
        monthly_fee_usd: prepared.data.monthly_fee_usd,
        directory_fee_usd: prepared.data.directory_fee_usd,
        availability: prepared.data.availability,
        role_type: prepared.data.role_type,
        department: prepared.data.department,
        photo_url: finalPhoto?.startsWith('http') ? finalPhoto : '',
        cv_url: finalCv?.startsWith('http') ? finalCv : '',
        ...(ambassadorId ? { ambassador_id: ambassadorId } : {}),
      });

      await submitProfileForReview();
      await clearPendingSetup();

      navigation.reset({
        index: 0,
        routes: [
          {
            name: ROUTES.Portal,
            params: { justSubmitted: true, uploadWarnings: fileWarnings.length ? fileWarnings : undefined },
          },
        ],
      });
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleInviteCvReupload = async (file) => {
    setReuploadingCv(true);
    setCvParseError('');
    setError('');
    setInviteCvFileName(file.name);
    try {
      const result = await reuploadInviteCvOnSetup(file);
      if (result.parsed) applyParsedToForm(result.parsed, result.name);
      if (result.cvUrl) setCvUrl(result.cvUrl);
      setCvParseFailed(false);
    } catch (err) {
      setCvParseError(err.message || 'Could not parse your CV. Please try another file.');
    } finally {
      setReuploadingCv(false);
    }
  };

  const canConfirm =
    form.name && form.job_title && session && !awaitingEmailConfirm && !parsingInvite && !cvParseFailed && !photoProcessing && hasProfilePhoto;

  if (authLoading || !pendingLoaded) return <BrandLoader message="Loading..." />;

  const showInviteOverlay = inviteFlow && (parsingInvite || cvParseFailed || reuploadingCv);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.aiPill}>
          <Sparkles size={11} color={colors.green700} />
          <Text style={styles.aiPillText}>{inviteFlow ? 'CV imported by BYG Hires' : 'AI Parsed Your CV'}</Text>
        </View>
        <Text style={styles.title}>
          Review your{'\n'}
          <Text style={{ color: colors.red }}>profile.</Text>
        </Text>
        <Text style={styles.subtitle}>
          {stateData.incompleteProfile
            ? 'Finish setting up your profile so it appears when you log in.'
            : 'Correct anything that looks off, then submit for admin review.'}
        </Text>
      </View>

      <Card elevated style={styles.card}>
        {awaitingEmailConfirm ? (
          <Banner tone="warning" icon={Mail} title="Confirm your email first">
            <Text style={styles.bannerText}>
              Your profile draft is saved. After confirming,{' '}
              <Text style={styles.link} onPress={() => navigation.popTo(ROUTES.Login)}>log in</Text> to complete setup.
            </Text>
          </Banner>
        ) : null}

        {uploadWarnings.length > 0 ? (
          <Banner tone="warning" title="Upload notes" icon={null}>
            {uploadWarnings.map((w, i) => (
              <Text key={i} style={styles.bannerText}>{w}</Text>
            ))}
          </Banner>
        ) : null}

        {error ? <Banner tone="error" message={error} /> : null}

        <Text style={styles.hint}>{PROFILE_CONTENT_HINT}</Text>

        <View style={styles.photoBlock}>
          <Text style={[type.label, { color: colors.gray500 }]}>
            Profile Photo <Text style={{ color: colors.red }}>*</Text>
          </Text>
          {photoProcessing ? (
            <ProfilePhotoGeneratingLoader message={photoProgress || 'Creating professional studio photo…'} />
          ) : photoPreview ? (
            <SelectedPhotoCard uri={photoPreview} onRemove={awaitingEmailConfirm ? undefined : clearPhoto} />
          ) : existingPhoto && !inviteFlow ? (
            <View style={styles.existingPhoto}>
              <Image source={{ uri: existingPhoto }} style={styles.existingImg} />
              <View>
                <Text style={styles.existingTitle}>Profile photo ready ✓</Text>
                <Pressable onPress={handlePhotoSelect} disabled={awaitingEmailConfirm} hitSlop={6}>
                  <Text style={styles.replace}>Replace photo</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <UploadPrompt
              icon={Camera}
              title="Upload headshot"
              subtitle="Front-facing photo (JPG, PNG, or HEIC). We'll crop and enhance it for your profile."
              onPress={handlePhotoSelect}
              disabled={awaitingEmailConfirm}
            />
          )}
        </View>

        <ProfileFields
          form={form}
          setForm={setForm}
          disabled={awaitingEmailConfirm}
          departmentHint="Suggested from your CV — change if needed."
        />

        <ProfileSkillsEditor
          skills={form.skills}
          bestSkill={form.best_skill}
          onSkillsChange={(skills) => setForm((f) => ({ ...f, skills }))}
          onBestSkillChange={(best_skill) => setForm((f) => ({ ...f, best_skill }))}
          newSkill={newSkill}
          onNewSkillChange={setNewSkill}
          onAddSkill={addSkill}
          disabled={awaitingEmailConfirm}
        />

        <View style={styles.submit}>
          <Button
            title={saving ? 'Submitting…' : 'Submit for review'}
            iconRight={ArrowRight}
            variant={canConfirm && !saving ? 'primary' : 'light'}
            onPress={handleConfirm}
            disabled={saving || !canConfirm}
            loading={saving}
          />
        </View>
      </Card>

      <CvParseOverlay
        visible={showInviteOverlay}
        parsing={parsingInvite || reuploadingCv}
        message={cvParseError}
        fileName={inviteCvFileName}
        context="invite"
        onReupload={cvParseFailed || reuploadingCv ? handleInviteCvReupload : undefined}
        onContinueManually={
          cvParseFailed && !parsingInvite && !reuploadingCv
            ? () => {
                setCvParseFailed(false);
                setError('');
              }
            : undefined
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 28 },
  header: { alignItems: 'center', marginBottom: 28, gap: 10 },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.green50,
    borderWidth: 1,
    borderColor: colors.green200,
    borderRadius: 999,
  },
  aiPillText: { ...fonts.black, fontSize: 10, color: colors.green700, textTransform: 'uppercase', letterSpacing: 1 },
  title: { ...type.h1, color: colors.black, textAlign: 'center' },
  subtitle: { ...type.body, color: colors.gray500, textAlign: 'center', maxWidth: 320 },
  card: { padding: 22, gap: 22 },
  bannerText: { ...fonts.medium, fontSize: 12, lineHeight: 18, color: colors.amber900 },
  link: { ...fonts.black, color: colors.red },
  hint: { ...fonts.medium, fontSize: 11, lineHeight: 16, color: colors.gray500 },
  photoBlock: { gap: 10 },
  existingPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 16,
    padding: 14,
  },
  existingImg: { width: 64, height: 64, borderRadius: 16, borderWidth: 2, borderColor: colors.white },
  existingTitle: { ...fonts.black, fontSize: 12, color: colors.gray800 },
  replace: { ...fonts.bold, fontSize: 10, color: colors.red, marginTop: 4 },
  submit: { borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 16 },
});

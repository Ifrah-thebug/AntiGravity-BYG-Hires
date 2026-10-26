import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowRight, Calendar, CheckCircle2, ClipboardCheck, Save } from 'lucide-react-native';
import { Banner, BrandLoader, Button, Card, Screen, SectionHeader } from '@/shared/components/ui';
import { colors, fonts, radius, type } from '@/shared/theme';
import { getString, setString } from '@/core/storage/keyValue';
import { uploadProfilePhoto } from '@/core/storage/files';
import { useAuth } from '@/features/auth/context/AuthContext';
import { fetchIsAdmin } from '@/features/auth/api/accountApi';
import { setupParamsFromProfile } from '@/app/navigation/routeAfterAuth';
import { ROUTES } from '@/app/navigation/routes';
import { normalizeProfileName } from '@/shared/lib/formatDisplayName';
import { normalizeTalentDepartment } from '@/shared/lib/talentDepartments';
import { photoUrlForDisplay } from '@/shared/lib/photoUrl';
import { sanitizeTalentForPublicDisplay } from '@/shared/lib/talentVerification';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import {
  DEFAULT_MONTHLY_FEE_USD,
  PROFILE_CONTENT_HINT,
  availabilityToForm,
  formatProfileValidationErrors,
  prepareProfileForSave,
  validateProfileFields,
} from '@/features/profile/utils/profileContentPolicy';
import { STATUS_LABELS, canSubmitForReview, isDirectoryLive, isProfileComplete } from '@/features/profile/utils/profileReview';
import { mapProfileToDirectoryTalent } from '@/features/profile/utils/directoryTalent';
import { submitProfileForReview, upsertTalentProfile } from '@/features/profile/api/profileApi';
import { useProfilePhotoUpload } from '@/features/profile/hooks/useProfilePhotoUpload';
import ProfileFields from '@/features/profile/components/ProfileFields';
import ProfileSkillsEditor from '@/features/profile/components/ProfileSkillsEditor';
import ProfilePhotoGeneratingLoader from '@/features/profile/components/ProfilePhotoGeneratingLoader';
import PublicProfileModal from '@/features/profile/components/PublicProfileModal';
import PortfolioRequestsPanel from '@/features/portfolio/components/PortfolioRequestsPanel';
import PortfolioSharingSettings from '@/features/portfolio/components/PortfolioSharingSettings';
import PortfolioEditor from '@/features/portfolio/components/PortfolioEditor';
import { usePortfolioSharing } from '@/features/portfolio/hooks/usePortfolioSharing';
import TalentIntroAvailability from '@/features/intro/components/TalentIntroAvailability';
import { buildConnectCalendarUrl } from '@/features/intro/api/introApi';
import TalentGuideModal, { TALENT_GUIDE_STORAGE_KEY } from '@/features/guide/components/TalentGuideModal';
import StrengthenProfilePanel from '@/features/portal/components/StrengthenProfilePanel';
import PortalStatusBanners from '@/features/portal/components/PortalStatusBanners';
import PortalHeaderCard from '@/features/portal/components/PortalHeaderCard';
import AccountPrivacyCard from '@/features/portal/components/AccountPrivacyCard';
import { usePortalData } from '@/features/portal/hooks/usePortalData';

const EMPTY_FORM = {
  name: '',
  job_title: '',
  about: '',
  experience_years: 0,
  monthly_fee_usd: DEFAULT_MONTHLY_FEE_USD,
  availability: 'immediate',
  availability_from_month: '',
  role_type: 'flexible',
  department: 'admin-operations',
  skills: [],
  best_skill: '',
};

function formFromProfile(data) {
  return {
    name: normalizeProfileName(data.name || ''),
    job_title: data.job_title || '',
    about: data.about || '',
    experience_years: data.experience_years || 0,
    monthly_fee_usd: data.monthly_fee_usd ?? DEFAULT_MONTHLY_FEE_USD,
    ...availabilityToForm(data.availability),
    role_type: data.role_type || 'flexible',
    department: normalizeTalentDepartment(data.department),
    skills: data.skills || [],
    best_skill: data.best_skill || data.skills?.[0] || '',
  };
}

/** Web: /portal — talent profile management hub. */
export default function PortalScreen({ navigation, route }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, setProfile, status, loading, error: loadError, load, setIntroSlotsPublished } = usePortalData(user);

  const [form, setForm] = useState(EMPTY_FORM);
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showPublicProfile, setShowPublicProfile] = useState(false);
  const { photoFile: uploadedPhotoFile, photoPreview, photoProcessing, photoProgress, handlePhotoSelect, clearPhoto } =
    useProfilePhotoUpload({ onError: setError });
  const { shareUrl, reload: reloadSharing } = usePortfolioSharing(profile?.id);
  const [refreshKey, setRefreshKey] = useState(0);
  const focusedOnce = useRef(false);
  const { copy, copiedKey } = useCopyToClipboard();

  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const editCardY = useRef(0);

  const justSubmitted = route.params?.justSubmitted;
  const uploadWarnings = route.params?.uploadWarnings;
  const connectCalendarUrl = buildConnectCalendarUrl(user);

  const fetchProfile = useCallback(
    async (opts) => {
      const data = await load(opts);
      if (!user) return;
      // Could not load (offline / server error): keep the talent here and show "Try again".
      if (data === undefined) return;
      if (!data || !isProfileComplete(data)) {
        if (data === null && opts?.silent) return;
        navigation.reset({ index: 0, routes: [{ name: ROUTES.Setup, params: setupParamsFromProfile(user, data) }] });
        return;
      }
      setForm(formFromProfile(data));
    },
    [load, navigation, user]
  );

  // Guard: guests → login; admins → not-talent screen.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigation.reset({ index: 0, routes: [{ name: ROUTES.Login }] });
      return;
    }
    fetchIsAdmin().then((isAdmin) => {
      if (isAdmin) navigation.reset({ index: 0, routes: [{ name: ROUTES.NotTalent, params: { kind: 'admin' } }] });
    });
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  // Back on the portal from another screen (skills test, storybook…): refresh scores, status and
  // chapters in the background. The edit-profile form is left alone so unsaved edits survive.
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (!user) return;
      load({ silent: true });
      reloadSharing();
      setRefreshKey((k) => k + 1);
    }, [load, reloadSharing, user])
  );

  // Back from the browser (Cal.com OAuth) → refresh calendar status.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) load({ silent: true });
    });
    return () => sub.remove();
  }, [load, user]);

  // First visit → show the talent guide once.
  useEffect(() => {
    if (loading || !user) return;
    getString(TALENT_GUIDE_STORAGE_KEY).then((seen) => {
      if (!seen) setShowGuide(true);
    });
  }, [loading, user]);

  const scrollToSection = useCallback((key) => {
    const y = sectionY.current[key];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, []);

  // Deep links from guide / BGuides chat: Portal { section: 'client-intro-scheduling' | ... }
  useEffect(() => {
    if (loading) return undefined;
    const section = route.params?.section;
    if (route.params?.guide) {
      setShowGuide(true);
      navigation.setParams({ guide: undefined });
    }
    if (!section) return undefined;
    const t = setTimeout(() => {
      scrollToSection(section);
      navigation.setParams({ section: undefined });
    }, 350);
    return () => clearTimeout(t);
  }, [loading, route.params?.section, route.params?.guide, navigation, scrollToSection]);

  const registerSection = (key, offset = 0) => (e) => {
    sectionY.current[key] = e.nativeEvent.layout.y + offset;
  };

  const closeGuide = () => {
    setShowGuide(false);
    setString(TALENT_GUIDE_STORAGE_KEY, '1');
  };

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

  const persistProfileChanges = async () => {
    const prepared = prepareProfileForSave(form);
    if (!prepared.ok) throw new Error(formatProfileValidationErrors(prepared.errors));

    let photoUrl = profile?.photo_url || '';
    if (uploadedPhotoFile) {
      setUploadingPhoto(true);
      try {
        photoUrl = await uploadProfilePhoto(user.id, uploadedPhotoFile);
      } catch (e) {
        throw new Error(`Photo upload failed: ${e.message}`);
      } finally {
        setUploadingPhoto(false);
      }
    }

    await upsertTalentProfile({
      user_id: user.id,
      email: user.email,
      name: prepared.data.name,
      job_title: prepared.data.job_title,
      about: prepared.data.about,
      experience_years: prepared.data.experience_years,
      monthly_fee_usd: prepared.data.monthly_fee_usd,
      directory_fee_usd: prepared.data.directory_fee_usd,
      availability: prepared.data.availability,
      role_type: prepared.data.role_type,
      department: prepared.data.department,
      skills: prepared.data.skills,
      best_skill: prepared.data.best_skill,
      photo_url: photoUrl,
      cv_url: profile?.cv_url || '',
    });

    setProfile((p) => (p ? { ...p, photo_url: photoUrl, updated_at: new Date().toISOString() } : p));
    clearPhoto();
    return photoUrl;
  };

  const handleSave = async () => {
    setError('');
    setSaveStatus('');
    setSaving(true);
    try {
      await persistProfileChanges();
      await fetchProfile({ silent: true });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save.');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    setError('');
    setSaveStatus('');
    setSubmittingReview(true);
    try {
      await persistProfileChanges();
      const updated = await submitProfileForReview();
      setProfile((p) => ({ ...p, ...updated }));
      await fetchProfile({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not submit for review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigation.reset({ index: 0, routes: [{ name: ROUTES.Login }] });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile({ silent: true });
    setRefreshing(false);
  };

  if (authLoading || (loading && !profile)) return <BrandLoader message="Loading..." />;
  if (!user || !profile) {
    return loadError ? (
      <Screen>
        <Banner tone="error" message={loadError} />
        <Button title="Try again" onPress={() => fetchProfile()} style={{ marginTop: 16 }} />
      </Screen>
    ) : (
      <BrandLoader message="Loading..." />
    );
  }

  const directoryStatus = profile.directory_status || 'draft';
  const directoryLive = isDirectoryLive(directoryStatus);
  const showSubmitReview = canSubmitForReview(directoryStatus);
  const busy = saving || uploadingPhoto || photoProcessing || submittingReview;
  const displayPhoto = photoPreview || photoUrlForDisplay(profile.photo_url, profile.updated_at) || '';
  const calendarConnected = Boolean(profile.cal_username);

  const openPortfolio = (params = {}) => navigation.navigate(ROUTES.Portfolio, { profileId: profile.id, ...params });

  const publicTalent = sanitizeTalentForPublicDisplay({
    ...mapProfileToDirectoryTalent(profile, {
      [profile.id]: { aiInterviewVerified: status.interviewCompleted, interviewScore: null },
    }),
    skillScores: status.skillScores,
  });

  return (
    <Screen
      ref={scrollRef}
      contentStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.red} />}
    >
      <PortalStatusBanners profile={profile} justSubmitted={justSubmitted} uploadWarnings={uploadWarnings} />

      <View onLayout={registerSection('profile-photo')}>
        <PortalHeaderCard
          name={form.name}
          email={user.email}
          jobTitle={form.job_title}
          photo={displayPhoto}
          photoProcessing={photoProcessing}
          onPickPhoto={handlePhotoSelect}
          ambassadorReferred={Boolean(profile.ambassador_id)}
          profileId={profile.id}
          directoryLive={directoryLive}
          shareCopied={copiedKey === 'share'}
          onViewPublicProfile={() => setShowPublicProfile(true)}
          onOpenPortfolio={() => openPortfolio()}
          onAddChapter={() => openPortfolio({ add: '1' })}
          onSharePortfolio={() => copy(shareUrl, 'share')}
          onOpenGuide={() => setShowGuide(true)}
          onLogout={handleLogout}
        />
      </View>

      <StrengthenProfilePanel
        calendarConnected={calendarConnected}
        introSlotsPublished={status.introSlotsPublished}
        assessmentDone={status.assessmentDone}
        interviewUnlocked={status.interviewUnlocked}
        interviewCompleted={status.interviewCompleted}
        hasCalendarUrl={Boolean(connectCalendarUrl)}
        actions={{
          onBuildPortfolio: () => openPortfolio({ add: '1' }),
          onOpenAssessment: () => navigation.navigate(ROUTES.Assessment),
          onOpenInterview: () => navigation.navigate(ROUTES.VoiceInterview),
          onConnectCalendar: () => Linking.openURL(connectCalendarUrl).catch(() => {}),
          onJumpToIntro: () => scrollToSection('client-intro-scheduling'),
          onOpenGuide: () => setShowGuide(true),
        }}
      />

      <View onLayout={(e) => (editCardY.current = e.nativeEvent.layout.y)}>
        <Card>
          <Text style={styles.cardTitle}>Edit Profile</Text>
          <Text style={styles.hint}>{PROFILE_CONTENT_HINT}</Text>

          {error ? <Banner tone="error" message={error} /> : null}
          {saveStatus === 'saved' ? <Banner tone="success" message="Profile saved successfully!" /> : null}

          <ProfileFields
            form={form}
            setForm={setForm}
            onLayoutPricing={(e) => {
              sectionY.current['profile-pricing'] = editCardY.current + e.nativeEvent.layout.y;
            }}
          />

          {status.inProgressSkill ? (
            <Banner tone="warning" icon={null}>
              <Text style={styles.warnTitle}>
                Unfinished skills test for <Text style={{ color: colors.red }}>{status.inProgressSkill}</Text>
              </Text>
              <Text style={styles.warnText}>
                Only one unfinished test is tracked at a time. Finish or restart this skill, or start another — any new test
                discards the previous attempt (new questions, no resume).
              </Text>
              <Button
                title="Pick a skill to assess"
                variant="ghost"
                size="sm"
                icon={ClipboardCheck}
                fullWidth={false}
                textStyle={{ color: colors.red }}
                onPress={() => navigation.navigate(ROUTES.Assessment)}
              />
            </Banner>
          ) : null}

          <ProfileSkillsEditor
            skills={form.skills}
            bestSkill={form.best_skill}
            skillScores={status.skillScores}
            inProgressSkill={status.inProgressSkill}
            showAssessmentLink
            onOpenAssessment={() => navigation.navigate(ROUTES.Assessment)}
            onSkillsChange={(skills) => setForm((f) => ({ ...f, skills }))}
            onBestSkillChange={(best_skill) => setForm((f) => ({ ...f, best_skill }))}
            newSkill={newSkill}
            onNewSkillChange={setNewSkill}
            onAddSkill={addSkill}
          />

          {photoProcessing ? <ProfilePhotoGeneratingLoader message={photoProgress || 'Creating professional studio photo…'} /> : null}

          {uploadedPhotoFile && !photoProcessing ? (
            <Banner
              tone="success"
              icon={CheckCircle2}
              message={
                showSubmitReview
                  ? 'New photo ready — it will be saved when you submit for review.'
                  : 'Professional photo ready — save to update your profile.'
              }
            />
          ) : null}

          <View
            style={styles.saveBlock}
            onLayout={(e) => {
              sectionY.current['profile-submit'] = editCardY.current + e.nativeEvent.layout.y;
            }}
          >
            {showSubmitReview ? (
              <Button
                title={
                  submittingReview
                    ? 'Saving & submitting…'
                    : uploadingPhoto
                      ? 'Uploading photo…'
                      : photoProcessing
                        ? 'Processing photo…'
                        : 'Save & submit for review'
                }
                variant="danger"
                iconRight={busy ? undefined : ArrowRight}
                loading={submittingReview}
                disabled={busy}
                onPress={handleSubmitForReview}
              />
            ) : null}

            <Button
              title={
                photoProcessing
                  ? 'Processing photo…'
                  : uploadingPhoto
                    ? 'Uploading photo…'
                    : saving
                      ? 'Saving…'
                      : showSubmitReview
                        ? 'Save changes only'
                        : 'Save Changes'
              }
              variant={showSubmitReview ? 'light' : 'primary'}
              icon={busy ? undefined : Save}
              loading={saving}
              disabled={busy}
              onPress={handleSave}
            />

            {/* Feedback next to the button too: the card-top banner is off screen after a long form. */}
            {saveStatus === 'saved' ? <Banner tone="success" message="Profile saved successfully!" /> : null}
            {saveStatus === 'error' && error ? <Banner tone="error" message={error} /> : null}

            {showSubmitReview ? (
              <Text style={styles.centerNote}>
                Use <Text style={styles.bold}>Save changes only</Text> if you are not ready to resubmit yet.
              </Text>
            ) : null}
            {directoryStatus === 'pending_review' ? (
              <Text style={[type.label, styles.centerStatus]}>Status: {STATUS_LABELS.pending_review}</Text>
            ) : null}
          </View>
        </Card>
      </View>

      <View onLayout={registerSection('portfolio-requests')}>
        <PortfolioRequestsPanel />
      </View>

      <PortfolioSharingSettings profileId={profile.id} onChange={reloadSharing} />

      <View onLayout={registerSection('talent-portfolio')}>
        <PortfolioEditor
          profileId={profile.id}
          userId={user.id}
          onOpenStorybook={() => openPortfolio()}
          onPreview={() => openPortfolio({ preview: 'visitor' })}
          refreshKey={refreshKey}
        />
      </View>

      <View onLayout={registerSection('client-intro-scheduling')}>
        <Card>
          <SectionHeader
            eyebrow="Client intros"
            eyebrowIcon={Calendar}
            title="Intro scheduling"
            description="Publish when you are free for intro calls, and see confirmed bookings in one place."
          />
          <TalentIntroAvailability
            talentId={profile.id || user.id}
            calConnected={calendarConnected}
            connectCalendarUrl={connectCalendarUrl}
            onPublishedChange={setIntroSlotsPublished}
          />
        </Card>
      </View>

      <AccountPrivacyCard name={form.name} email={user.email} />

      <TalentGuideModal
        open={showGuide}
        onClose={closeGuide}
        connectCalendarUrl={connectCalendarUrl}
        calendarConnected={calendarConnected}
        assessmentDone={status.assessmentDone}
        interviewUnlocked={status.interviewUnlocked}
        interviewCompleted={status.interviewCompleted}
        introSlotsPublished={status.introSlotsPublished}
        onScrollToTimings={() => setTimeout(() => scrollToSection('client-intro-scheduling'), 300)}
        onOpenAssessment={() => navigation.navigate(ROUTES.Assessment)}
        onOpenInterview={() => navigation.navigate(ROUTES.VoiceInterview)}
      />

      <PublicProfileModal
        visible={showPublicProfile}
        talent={publicTalent}
        onClose={() => setShowPublicProfile(false)}
        onViewPortfolio={() => {
          setShowPublicProfile(false);
          openPortfolio();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20, paddingBottom: 110 },
  cardTitle: { ...fonts.black, fontSize: 13, color: colors.gray800, textTransform: 'uppercase', letterSpacing: 1.5 },
  hint: { ...fonts.medium, fontSize: 11, lineHeight: 16, color: colors.gray500, marginTop: -8 },
  warnTitle: { ...fonts.bold, fontSize: 13, color: colors.amber900 },
  warnText: { ...fonts.medium, fontSize: 12, lineHeight: 17, color: colors.amber800 },
  saveBlock: { gap: 12, borderRadius: radius.md },
  centerNote: { ...fonts.medium, fontSize: 10, color: colors.gray500, textAlign: 'center' },
  bold: { ...fonts.bold },
  centerStatus: { color: colors.gray400, textAlign: 'center' },
});

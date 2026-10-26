import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, BookOpen, Check, ChevronRight, Eye, Link2, Pencil, Plus, Sparkles } from 'lucide-react-native';
import { Avatar, Banner, Button, FullScreenLoader, Screen, TopBar } from '@/shared/components/ui';
import { colors, fonts, type } from '@/shared/theme';
import { useAuth } from '@/features/auth/context/AuthContext';
import { ROUTES } from '@/app/navigation/routes';
import { formatDisplayName, formatFirstName } from '@/shared/lib/formatDisplayName';
import { getTalentDepartmentLabel } from '@/shared/lib/talentDepartments';
import { photoUrlForDisplay } from '@/shared/lib/photoUrl';
import { SHOW_ASSESSMENT_SCORE, sanitizeTalentForPublicDisplay } from '@/shared/lib/talentVerification';
import { scoreBadgeColors } from '@/shared/lib/skillAssessmentDisplay';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { isDirectoryLive } from '@/features/profile/utils/profileReview';
import { AiInterviewVerifiedBadge, ProfileVerificationBadge } from '@/features/profile/components/Badges';
import { fetchPublicSkillScores, buildTalentSkillScores } from '@/features/assessment/api/assessmentApi';
import { fetchPublicAiInterviewBadges } from '@/features/interview/api/voiceInterviewApi';
import { fetchOwnPortfolioProjects, fetchPortfolioProfile } from '@/features/portfolio/api/portfolioApi';
import { usePortfolioSharing } from '@/features/portfolio/hooks/usePortfolioSharing';
import PortfolioEditor from '@/features/portfolio/components/PortfolioEditor';
import {
  HighlightsStrip,
  JourneyTimeline,
  ProjectDetailModal,
  StoryQuote,
  StorybookDivider,
  StorybookProjectCard,
  StorybookSpread,
  buildPortfolioStoryQuotes,
} from '@/features/portfolio/components/Storybook';

/** Web: /talent/:id/portfolio — storybook portfolio (owner view + "preview as visitor"). */
export default function PortfolioScreen({ navigation, route }) {
  const profileId = route.params?.profileId;
  const visitorPreview = route.params?.preview === 'visitor';
  const wantsAddChapter = route.params?.add === '1' || route.params?.add === 'chapter';
  const { user, loading: authLoading } = useAuth();

  const scrollRef = useRef(null);
  const projectsY = useRef(0);
  const editorLocalY = useRef(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [draftCount, setDraftCount] = useState(0);
  const [skillScores, setSkillScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeProject, setActiveProject] = useState(null);
  const [addChapterSignal, setAddChapterSignal] = useState(0);
  const { shareUrl } = usePortfolioSharing(profileId);
  const { copy, copiedKey } = useCopyToClipboard(2200);

  const refreshDisplayProjects = useCallback(async () => {
    if (!profileId) return;
    try {
      const items = await fetchOwnPortfolioProjects(profileId);
      setProjects(items.filter((p) => p.published));
      setDraftCount(items.filter((p) => !p.published).length);
    } catch {
      setProjects([]);
      setDraftCount(0);
    }
  }, [profileId]);

  const fetchPageData = useCallback(
    async ({ silent = false } = {}) => {
      if (!profileId) {
        setError('Portfolio not found.');
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError('');
      try {
        const profileData = await fetchPortfolioProfile(profileId);
        const [scoreMap, aiBadgeMap] = await Promise.all([
          fetchPublicSkillScores([profileData.id]).catch(() => ({})),
          fetchPublicAiInterviewBadges([profileData.id]).catch(() => ({})),
        ]);
        const aiMeta = aiBadgeMap[profileData.id] || {};
        setProfile({
          ...profileData,
          aiInterviewVerified: Boolean(aiMeta.aiInterviewVerified),
          aiInterviewScore: aiMeta.interviewScore ?? null,
        });
        setSkillScores(buildTalentSkillScores(scoreMap, profileData.id, profileData.skills || []));

        const items = await fetchOwnPortfolioProjects(profileData.id);
        setProjects(items.filter((p) => p.published));
        setDraftCount(visitorPreview ? 0 : items.filter((p) => !p.published).length);
      } catch {
        setError('Portfolio not found.');
      } finally {
        setLoading(false);
      }
    },
    [profileId, visitorPreview]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigation.reset({ index: 0, routes: [{ name: ROUTES.Login }] });
      return;
    }
    fetchPageData();
  }, [authLoading, user, fetchPageData, navigation]);

  const scrollToEditor = useCallback(() => {
    if (editorLocalY.current == null) return;
    const y = projectsY.current + editorLocalY.current;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, []);

  useEffect(() => {
    if (loading || !wantsAddChapter) return undefined;
    const t = setTimeout(scrollToEditor, 400);
    return () => clearTimeout(t);
  }, [loading, wantsAddChapter, scrollToEditor]);

  const openAddChapter = () => {
    setAddChapterSignal((n) => n + 1);
    setTimeout(scrollToEditor, 150);
  };

  const setPreview = (on) => navigation.setParams({ preview: on ? 'visitor' : undefined, add: undefined });

  if (authLoading || loading) {
    return (
      <View style={styles.loading}>
        <View style={styles.loadingBook}>
          <BookOpen size={32} color="rgba(255,61,61,0.5)" />
        </View>
        <Text style={[type.eyebrow, { color: colors.gray500 }]}>Opening story…</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <Screen background={colors.paper} contentStyle={styles.notFound}>
        <Text style={[type.eyebrow, { color: colors.gray400, fontSize: 13 }]}>{error || 'Story not found'}</Text>
        <Button title="Back to portal" fullWidth={false} onPress={() => navigation.popTo(ROUTES.Portal)} />
      </Screen>
    );
  }

  const isOwner = Boolean(user?.id && profile.user_id === user.id);
  if (!isOwner) {
    return <FullScreenLoader label="Only your own portfolio can be opened in the talent app." />;
  }

  const showOwnerEditor = !visitorPreview;
  const directoryLive = isDirectoryLive(profile.directory_status);
  const displayPhotoUrl = photoUrlForDisplay(profile.photo_url, profile.updated_at || profile.created_at);
  const displayName = formatDisplayName(profile.name);
  const firstName = formatFirstName(profile.name);
  const departmentLabel = getTalentDepartmentLabel(profile.department);
  const skills = profile.skills || [];

  const displayTalent = sanitizeTalentForPublicDisplay({
    bestSkill: profile.best_skill || skills[0],
    tags: skills,
    skillScores,
    aiInterviewVerified: profile.aiInterviewVerified,
    aiInterviewScore: profile.aiInterviewScore,
  });

  const storyQuotes = buildPortfolioStoryQuotes({ profile, firstName, displayName, projects, departmentLabel });
  const openQuote = storyQuotes[0];
  const craftQuote = storyQuotes.find((q) => q.attribution === firstName && q.text.includes('craft')) || storyQuotes[1];
  const closingQuote = storyQuotes[storyQuotes.length - 1];

  return (
    <Screen
      ref={scrollRef}
      background={colors.paperShade}
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.red}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchPageData({ silent: true });
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={styles.pad}>
        <TopBar
          onBack={() => navigation.popTo(ROUTES.Portal)}
          color={colors.gray500}
          right={
            <View style={styles.topActions}>
              {visitorPreview ? (
                <Button title="Exit" size="sm" icon={Pencil} fullWidth={false} onPress={() => setPreview(false)} />
              ) : (
                <Button title="Preview" size="sm" variant="outline" icon={Eye} fullWidth={false} onPress={() => setPreview(true)} />
              )}
              <Button
                size="sm"
                variant="primary"
                icon={copiedKey === 'share' ? Check : Link2}
                fullWidth={false}
                onPress={() => copy(shareUrl, 'share')}
                title={copiedKey === 'share' ? 'Copied' : 'Share'}
              />
            </View>
          }
        />

        {visitorPreview ? (
          <View style={styles.previewBar}>
            <View style={styles.rowGap}>
              <Eye size={14} color={colors.red} />
              <Text style={styles.previewText}>Visitor preview — this is what clients see when your profile is live.</Text>
            </View>
            {!directoryLive ? (
              <Text style={styles.previewSub}>Your profile isn't approved yet — projects won't appear publicly until it is.</Text>
            ) : null}
            <Text style={styles.previewExit} onPress={() => setPreview(false)}>Exit preview & edit</Text>
          </View>
        ) : null}

        {showOwnerEditor ? (
          <View style={styles.ownerBar}>
            <Text style={styles.ownerText}>
              You're editing <Text style={styles.bold}>your portfolio</Text>.
            </Text>
            {draftCount > 0 && projects.length === 0 ? (
              <Text style={styles.ownerDraft}>
                You have {draftCount} draft chapter{draftCount === 1 ? '' : 's'} — publish them in Chapter studio below to show here.
              </Text>
            ) : null}
            <View style={styles.ownerActions}>
              <Button title="Add chapter" size="sm" icon={Plus} onPress={openAddChapter} style={styles.flex} />
              <Button title="Manage chapters" size="sm" variant="outline" icon={Pencil} onPress={scrollToEditor} style={styles.flex} />
            </View>
          </View>
        ) : null}

        {!directoryLive && !visitorPreview ? (
          <Banner tone="warning" icon={null} message="Preview — this story goes public once your profile is approved." />
        ) : null}
      </View>

      {/* Cover */}
      <View style={styles.pad}>
        <View style={styles.cover}>
          <View pointerEvents="none" style={styles.coverGlow} />
          <View style={styles.seal}>
            <BookOpen size={16} color="rgba(255,255,255,0.9)" />
          </View>
          <View style={styles.coverInner}>
            <View style={styles.rowGap}>
              <Sparkles size={12} color={colors.red} />
              <Text style={[type.eyebrow, { color: colors.red, fontSize: 9 }]}>A BYG Hires Story</Text>
            </View>
            <Avatar name={profile.name} photo={displayPhotoUrl} size={112} rounded={56} borderColor="rgba(255,255,255,0.2)" />
            <Text style={styles.coverTitle}>
              The Story of{'\n'}
              <Text style={{ color: colors.red }}>{displayName}</Text>
            </Text>
            <Text style={styles.coverRole}>{profile.job_title}</Text>
            <View style={styles.coverBadges}>
              <ProfileVerificationBadge talent={displayTalent} variant="dark" />
              <AiInterviewVerifiedBadge talent={displayTalent} variant="dark" />
            </View>
            <View style={styles.rowGap}>
              <Text style={[type.eyebrow, { color: 'rgba(255,255,255,0.6)' }]}>Turn the page</Text>
              <ChevronRight size={14} color="rgba(255,255,255,0.6)" />
            </View>
          </View>
          <View style={styles.coverBottom} />
        </View>
        <Text style={styles.coverCaption}>Digital Portfolio · Share instead of LinkedIn</Text>
      </View>

      <HighlightsStrip
        experienceYears={profile.experience_years}
        projectCount={projects.length}
        skillCount={skills.length}
        verified={displayTalent.aiInterviewVerified || directoryLive}
      />

      <StorybookDivider />

      <StorybookSpread
        chapter="I"
        chapterLabel="The Beginning"
        title="Once upon a career…"
        subtitle={`Every professional has an origin story. This is ${firstName}'s.`}
      >
        {openQuote ? <StoryQuote text={openQuote.text} attribution={openQuote.attribution} large /> : null}
        <Text style={styles.story}>
          {profile.about ||
            `${displayName} is a ${profile.job_title?.toLowerCase() || 'professional'} on BYG Hires — vetted remote talent ready to help teams build, ship, and grow.`}
        </Text>
        {profile.experience_years > 0 ? (
          <Text style={styles.years}>
            <Text style={{ color: colors.red }}>{profile.experience_years}+</Text> years writing this story so far.
          </Text>
        ) : null}
      </StorybookSpread>

      <StorybookDivider />

      <StorybookSpread
        chapter="II"
        chapterLabel="The Craft"
        title="Tools of the trade"
        subtitle="The skills and strengths that shape every chapter of this journey."
        align="right"
      >
        {craftQuote ? <StoryQuote text={craftQuote.text} attribution={craftQuote.attribution} /> : null}
        {profile.best_skill ? (
          <View style={styles.signature}>
            <Text style={[type.eyebrow, { color: colors.gray400, fontSize: 9 }]}>Signature strength</Text>
            <Text style={styles.signatureText}>{profile.best_skill}</Text>
          </View>
        ) : null}
        {skills.length > 0 ? (
          <View style={styles.skills}>
            {skills.map((skill) => {
              const score = skillScores[skill];
              return (
                <View key={skill} style={styles.skill}>
                  <Text style={styles.skillText}>{skill}</Text>
                  {SHOW_ASSESSMENT_SCORE && score != null ? (
                    <Text style={[styles.skillScore, scoreBadgeColors(score)]}>{score}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.italic}>Skills chapter still being written…</Text>
        )}
      </StorybookSpread>

      <StorybookDivider />

      <StorybookSpread
        chapter="·"
        chapterLabel="The Journey"
        title="Milestones along the way"
        subtitle={`Key moments that shaped ${firstName}'s path as a ${profile.job_title?.toLowerCase() || 'professional'}.`}
      >
        <JourneyTimeline
          firstName={firstName}
          jobTitle={profile.job_title}
          departmentLabel={departmentLabel}
          experienceYears={profile.experience_years}
          bestSkill={profile.best_skill}
        />
      </StorybookSpread>

      <StorybookDivider />

      <StorybookSpread
        chapter="III"
        chapterLabel="The Adventures"
        title="Chapters of real work"
        subtitle={`Projects, case studies, and live links — each one a page in ${firstName}'s professional storybook.`}
      />

      <View style={styles.projects} onLayout={(e) => (projectsY.current = e.nativeEvent.layout.y)}>
        {projects.length === 0 ? (
          <StorybookSpread
            chapterLabel={showOwnerEditor ? 'Your first chapter' : 'Still being written'}
            title={showOwnerEditor ? 'Start writing your story…' : 'An empty page awaits…'}
            subtitle={
              showOwnerEditor
                ? 'Add a project below — once published, it appears in this chapter for visitors.'
                : `${firstName} is adding work samples soon.`
            }
          >
            <View style={styles.emptyIcon}>
              <BookOpen size={44} color={showOwnerEditor ? 'rgba(255,61,61,0.2)' : colors.gray200} strokeWidth={1.5} />
            </View>
          </StorybookSpread>
        ) : (
          projects.map((project, index) => (
            <View key={project.id} style={styles.projectBlock}>
              <StorybookProjectCard project={project} chapterNum={index + 1} onOpen={setActiveProject} />
              {index < projects.length - 1 && storyQuotes[index + 2] ? (
                <View style={styles.pad}>
                  <StoryQuote text={storyQuotes[index + 2].text} attribution={storyQuotes[index + 2].attribution} />
                </View>
              ) : null}
            </View>
          ))
        )}

        {showOwnerEditor && projects.length > 0 ? (
          <View style={styles.center}>
            <Button title="Write next chapter" size="sm" icon={Plus} iconRight={ArrowRight} fullWidth={false} onPress={openAddChapter} />
          </View>
        ) : null}

        {showOwnerEditor ? (
          <View
            style={styles.pad}
            onLayout={(e) => {
              editorLocalY.current = e.nativeEvent.layout.y;
            }}
          >
            <PortfolioEditor
              embedded
              profileId={profile.id}
              userId={user?.id}
              autoOpenAdd={wantsAddChapter}
              openAddSignal={addChapterSignal}
              onProjectsChange={refreshDisplayProjects}
            />
          </View>
        ) : null}
      </View>

      <StorybookDivider />

      <StorybookSpread
        chapter="IV"
        chapterLabel="The End… or a New Beginning"
        title="Every story deserves a next chapter"
        subtitle={`Interested in working with ${firstName}? The BYG Hires team can make the introduction.`}
      >
        {closingQuote ? <StoryQuote text={closingQuote.text} attribution={closingQuote.attribution} /> : null}
        <View style={styles.closingActions}>
          <Button
            title={copiedKey === 'share' ? 'Link copied' : 'Share Portfolio'}
            icon={copiedKey === 'share' ? Check : Link2}
            size="sm"
            onPress={() => copy(shareUrl, 'share')}
          />
          <Button title="Back to portal" size="sm" variant="outline" onPress={() => navigation.popTo(ROUTES.Portal)} />
        </View>
      </StorybookSpread>

      <View style={[styles.rowGap, styles.theEnd]}>
        <BookOpen size={12} color={colors.gray400} />
        <Text style={[type.eyebrow, { color: colors.gray400 }]}>
          The End · Powered by <Text style={{ color: colors.red }}>BYG Hires</Text>
        </Text>
      </View>

      <ProjectDetailModal project={activeProject} onClose={() => setActiveProject(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { ...fonts.black, color: colors.black },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  center: { alignItems: 'center' },
  loading: { flex: 1, backgroundColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center', gap: 18 },
  loadingBook: {
    width: 80,
    height: 96,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.paperBorder,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  content: { paddingHorizontal: 0, gap: 14, paddingBottom: 110 },
  pad: { paddingHorizontal: 16, gap: 12 },
  topActions: { flexDirection: 'row', gap: 8 },
  previewBar: { backgroundColor: colors.black, borderRadius: 12, padding: 14, gap: 6 },
  previewText: { ...fonts.semibold, fontSize: 12, color: colors.white, flex: 1 },
  previewSub: { ...fonts.medium, fontSize: 10, color: colors.gray400 },
  previewExit: { ...fonts.black, fontSize: 10, color: colors.red, textTransform: 'uppercase', letterSpacing: 1.5 },
  ownerBar: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.paperBorder, borderRadius: 12, padding: 14, gap: 10 },
  ownerText: { ...fonts.semibold, fontSize: 12, color: colors.gray700 },
  ownerDraft: { ...fonts.bold, fontSize: 10, color: colors.amber700 },
  ownerActions: { flexDirection: 'row', gap: 8 },
  cover: { backgroundColor: colors.black, borderWidth: 6, borderColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden' },
  coverGlow: { position: 'absolute', top: -80, left: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: colors.red, opacity: 0.22 },
  seal: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverInner: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 18, gap: 16 },
  coverTitle: { ...fonts.black, fontSize: 28, lineHeight: 33, color: colors.white, textAlign: 'center' },
  coverRole: { ...fonts.bold, fontSize: 11, color: colors.gray400, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' },
  coverBadges: { alignItems: 'center' },
  coverBottom: { height: 14, backgroundColor: colors.red },
  coverCaption: { ...type.eyebrow, color: colors.gray400, textAlign: 'center', marginTop: 4 },
  story: { ...fonts.medium, fontSize: 15, lineHeight: 26, color: colors.gray700 },
  years: { ...fonts.bold, fontSize: 13, color: colors.gray500, marginTop: 14 },
  signature: { alignSelf: 'flex-start', backgroundColor: colors.black, borderRadius: 12, padding: 16, marginBottom: 14, gap: 4 },
  signatureText: { ...fonts.black, fontSize: 17, color: colors.red },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skillText: { ...fonts.bold, fontSize: 10, color: colors.gray800, textTransform: 'uppercase' },
  skillScore: { ...fonts.black, fontSize: 9, borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, overflow: 'hidden' },
  italic: { ...fonts.medium, fontStyle: 'italic', fontSize: 13, color: colors.gray500 },
  projects: { gap: 16 },
  projectBlock: { gap: 12 },
  emptyIcon: { alignItems: 'center', paddingVertical: 12 },
  closingActions: { gap: 10, marginTop: 16 },
  theEnd: { justifyContent: 'center', paddingVertical: 8 },
});

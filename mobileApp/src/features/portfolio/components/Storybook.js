import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ArrowUpRight, Award, BookOpen, Briefcase, ExternalLink, Flag, FolderOpen, MapPin, Rocket, Sparkles, Star, X } from 'lucide-react-native';
import { BottomSheet, Button } from '@/shared/components/ui';
import { colors, fonts, radius, type } from '@/shared/theme';
import { normalizeProjectUrl } from '@/features/portfolio/api/portfolioApi';

/** Curl divider between story sections. */
export function StorybookDivider() {
  return (
    <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.dividerLine, { backgroundColor: 'rgba(255,61,61,0.25)' }]} />
      <Svg viewBox="0 0 120 24" width={72} height={18}>
        <Path d="M0 12C20 4 40 20 60 12C80 4 100 20 120 12" stroke="rgba(255,61,61,0.5)" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        <Circle cx={60} cy={12} r={3.5} fill="rgba(255,61,61,0.5)" />
      </Svg>
      <View style={[styles.dividerLine, { backgroundColor: 'rgba(255,61,61,0.25)' }]} />
    </View>
  );
}

/** Paper "page" with chapter ribbon and number. */
export function StorybookSpread({ chapter, chapterLabel, title, subtitle, children, align = 'left' }) {
  return (
    <View style={styles.spreadWrap}>
      <View style={styles.spread}>
        {chapter ? <View style={styles.ribbon} /> : null}
        <View style={styles.spreadInner}>
          {chapter ? (
            <View style={styles.chapterRow}>
              <View style={styles.chapterBadge}>
                <Text style={styles.chapterBadgeText}>{chapter}</Text>
              </View>
              <Text style={[type.eyebrow, { color: colors.red, fontSize: 9 }]}>{chapterLabel}</Text>
            </View>
          ) : chapterLabel ? (
            <Text style={[type.eyebrow, { color: colors.red, fontSize: 9, marginBottom: 10 }]}>{chapterLabel}</Text>
          ) : null}
          {title ? <Text style={styles.spreadTitle}>{title}</Text> : null}
          {subtitle ? <Text style={styles.spreadSubtitle}>{subtitle}</Text> : null}
          {children}
        </View>
      </View>
      {chapter ? <Text style={[styles.pageNo, { textAlign: align === 'right' ? 'right' : 'left' }]}>— {chapter} —</Text> : null}
    </View>
  );
}

export function StoryQuote({ text, attribution, large = false }) {
  if (!text) return null;
  return (
    <View style={styles.quote}>
      <Text style={[styles.quoteText, large && styles.quoteLarge]}>“{text}”</Text>
      {attribution ? (
        <View style={styles.quoteFooter}>
          <View style={styles.quoteLine} />
          <Text style={[type.eyebrow, { color: colors.red }]}>{attribution}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Build narrative quotes from profile + projects (same rules as web). */
export function buildPortfolioStoryQuotes({ profile, firstName, displayName, projects, departmentLabel }) {
  const quotes = [];

  if (profile?.about) {
    const trimmed = profile.about.trim();
    const firstSentence = trimmed.match(/^[^.!?]+[.!?]?/)?.[0]?.trim();
    if (firstSentence && firstSentence.length > 15 && firstSentence.length < 200) {
      quotes.push({ text: firstSentence.replace(/^["']|["']$/g, ''), attribution: displayName });
    } else if (trimmed.length <= 180) {
      quotes.push({ text: trimmed, attribution: displayName });
    }
  }

  if (profile?.best_skill) {
    quotes.push({ text: `My craft lives in ${profile.best_skill} — where precision meets creativity.`, attribution: firstName });
  }

  if (profile?.job_title) {
    quotes.push({
      text: `I show up as a ${profile.job_title.toLowerCase()} who delivers work that speaks for itself.`,
      attribution: firstName,
    });
  }

  if (departmentLabel) {
    quotes.push({ text: `Remote talent, real impact — building from the ${departmentLabel} lane.`, attribution: 'BYG Hires' });
  }

  if (profile?.experience_years > 0) {
    quotes.push({
      text: `${profile.experience_years} year${profile.experience_years === 1 ? '' : 's'} of learning, shipping, and getting better every chapter.`,
      attribution: firstName,
    });
  }

  projects.slice(0, 3).forEach((p) => {
    if (p.description) {
      const excerpt = p.description.length > 140 ? `${p.description.slice(0, 137)}…` : p.description;
      quotes.push({ text: excerpt, attribution: p.title });
    }
  });

  quotes.push({ text: 'One link. Your whole story. Share your portfolio instead of another LinkedIn scroll.', attribution: 'BYG Hires' });

  return quotes;
}

export function HighlightsStrip({ experienceYears = 0, projectCount = 0, skillCount = 0, verified = false }) {
  const items = [
    experienceYears > 0 && { value: experienceYears, label: 'Years experience', icon: Briefcase },
    projectCount > 0 && { value: projectCount, label: 'Work chapters', icon: FolderOpen },
    skillCount > 0 && { value: skillCount, label: 'Core skills', icon: Sparkles },
    verified && { value: '✓', label: 'BYG verified', icon: Award },
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <View style={styles.stats}>
      {items.map(({ value, label, icon: Icon }) => (
        <View key={label} style={styles.stat}>
          <View style={styles.statHead}>
            <Icon size={14} color={colors.red} />
            <Text style={[type.eyebrow, { color: colors.gray400, fontSize: 9 }]}>{label}</Text>
          </View>
          <Text style={styles.statValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const TIMELINE_ICONS = [MapPin, Star, Rocket, Flag];

export function JourneyTimeline({ firstName, jobTitle, departmentLabel, experienceYears = 0, bestSkill }) {
  const milestones = [
    {
      title: 'Where it started',
      text: departmentLabel
        ? `Building a career in ${departmentLabel.toLowerCase()}.`
        : 'Every story begins with curiosity and a first step forward.',
    },
    experienceYears > 0 && {
      title: `${experienceYears}+ years in the making`,
      text: `Season after season of learning, shipping, and growing as a ${jobTitle?.toLowerCase() || 'professional'}.`,
    },
    bestSkill && {
      title: 'Signature craft',
      text: `Known for strength in ${bestSkill} — the skill that shows up in every chapter.`,
    },
    { title: 'Writing the next page', text: `${firstName} is ready for the next team, project, and adventure.` },
  ].filter(Boolean);

  return (
    <View style={styles.timeline}>
      <View style={styles.timelineLine} />
      {milestones.map((step, i) => {
        const Icon = TIMELINE_ICONS[i % TIMELINE_ICONS.length];
        return (
          <View key={step.title} style={styles.milestone}>
            <View style={styles.milestoneDot}>
              <Icon size={15} color={colors.red} />
            </View>
            <View style={styles.flex}>
              <Text style={[type.eyebrow, { color: colors.red, fontSize: 9 }]}>Milestone {i + 1}</Text>
              <Text style={styles.milestoneTitle}>{step.title}</Text>
              <Text style={styles.milestoneText}>{step.text}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function StorybookProjectCard({ project, chapterNum, onOpen }) {
  return (
    <Pressable onPress={() => onOpen?.(project)} style={({ pressed }) => [styles.projectCard, pressed && { borderColor: colors.red30 }]}>
      <View style={styles.ribbon} />
      <View style={styles.projectCover}>
        {project.cover_image_url ? (
          <Image source={{ uri: project.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <BookOpen size={40} color="rgba(255,61,61,0.3)" strokeWidth={1.5} />
        )}
        <View style={styles.chapterCircle}>
          <Text style={styles.chapterCircleText}>{chapterNum}</Text>
        </View>
      </View>
      <View style={styles.projectBody}>
        <Text style={[type.eyebrow, { color: colors.red, fontSize: 9 }]}>A chapter in the work</Text>
        <Text style={styles.projectTitle}>{project.title}</Text>
        {project.description ? (
          <Text style={styles.projectDesc} numberOfLines={3}>“{project.description}”</Text>
        ) : null}
        {project.tags?.length > 0 ? (
          <View style={styles.tags}>
            {project.tags.slice(0, 4).map((tag, i) => (
              <Text key={`${tag}-${i}`} style={styles.tag}>{tag}</Text>
            ))}
          </View>
        ) : null}
        {project.project_url ? (
          <View style={styles.readRow}>
            <Text style={[type.eyebrow, { color: colors.red }]}>Read this chapter</Text>
            <ExternalLink size={11} color={colors.red} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ProjectDetailModal({ project, onClose }) {
  const link = normalizeProjectUrl(project?.project_url);

  const header = project ? (
    <View>
      <View style={styles.ribbon} />
      <View style={styles.detailHero}>
        {project.cover_image_url ? (
          <Image source={{ uri: project.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        <View style={styles.detailShade} />
        <Pressable onPress={onClose} style={styles.detailClose} hitSlop={10} accessibilityLabel="Close chapter">
          <X size={17} color={colors.white} />
        </Pressable>
        <View style={styles.detailTitleWrap}>
          <View style={styles.rowGap}>
            <BookOpen size={10} color={colors.red} />
            <Text style={[type.eyebrow, { color: colors.red, fontSize: 9 }]}>A chapter in the work</Text>
          </View>
          <Text style={styles.detailTitle}>{project.title}</Text>
        </View>
      </View>
    </View>
  ) : null;

  return (
    <BottomSheet
      visible={Boolean(project)}
      onClose={onClose}
      header={header}
      scroll
      background={colors.paper}
      footer={
        link ? (
          <View style={styles.detailFooter}>
            <Text style={styles.detailUrl} numberOfLines={1}>{link.replace(/^https?:\/\//, '')}</Text>
            <Button title="View live work" size="sm" iconRight={ArrowUpRight} onPress={() => Linking.openURL(link).catch(() => {})} />
          </View>
        ) : (
          <Text style={[type.eyebrow, styles.noLink]}>No live link for this chapter</Text>
        )
      }
    >
      {project ? (
        <View style={styles.detailBody}>
          {project.tags?.length > 0 ? (
            <View style={styles.tags}>
              {project.tags.map((tag, i) => (
                <Text key={`${tag}-${i}`} style={styles.tag}>{tag}</Text>
              ))}
            </View>
          ) : null}
          {project.description ? (
            <Text style={styles.detailDesc}>“{project.description}”</Text>
          ) : (
            <Text style={styles.detailEmpty}>No description added for this chapter yet.</Text>
          )}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 },
  dividerLine: { height: 1, width: 40 },
  spreadWrap: { paddingHorizontal: 12 },
  spread: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  ribbon: { height: 6, backgroundColor: colors.red },
  spreadInner: { paddingHorizontal: 18, paddingVertical: 22, gap: 4 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  chapterBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  chapterBadgeText: { ...fonts.black, fontSize: 12, color: colors.white },
  spreadTitle: { ...fonts.black, fontSize: 24, lineHeight: 29, color: colors.black, letterSpacing: -0.3 },
  spreadSubtitle: { ...fonts.medium, fontSize: 14, lineHeight: 21, color: colors.gray500, marginTop: 6, marginBottom: 12 },
  pageNo: { ...fonts.black, fontSize: 10, color: colors.gray400, marginTop: 10 },
  quote: {
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(255,61,61,0.7)',
    backgroundColor: 'rgba(255,61,61,0.05)',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 14,
    gap: 10,
  },
  quoteText: { ...fonts.medium, fontStyle: 'italic', fontSize: 15, lineHeight: 23, color: colors.gray800 },
  quoteLarge: { fontSize: 18, lineHeight: 27 },
  quoteFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quoteLine: { width: 24, height: 1, backgroundColor: 'rgba(255,61,61,0.3)' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 12 },
  stat: {
    flexGrow: 1,
    width: '45%',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { ...fonts.black, fontSize: 26, color: colors.black },
  timeline: { gap: 22, paddingLeft: 4, paddingTop: 4 },
  timelineLine: { position: 'absolute', left: 22, top: 10, bottom: 10, width: 1, backgroundColor: 'rgba(255,61,61,0.3)' },
  milestone: { flexDirection: 'row', gap: 14 },
  milestoneDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.black,
    borderWidth: 4,
    borderColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneTitle: { ...fonts.black, fontSize: 16, color: colors.black, marginTop: 2 },
  milestoneText: { ...fonts.medium, fontSize: 14, lineHeight: 21, color: colors.gray600, marginTop: 2 },
  projectCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  projectCover: { height: 176, backgroundColor: colors.gray900, alignItems: 'center', justifyContent: 'center' },
  chapterCircle: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCircleText: { ...fonts.black, fontSize: 13, color: colors.white },
  projectBody: { padding: 18, gap: 8 },
  projectTitle: { ...fonts.black, fontSize: 20, color: colors.black },
  projectDesc: { ...fonts.medium, fontStyle: 'italic', fontSize: 14, lineHeight: 21, color: colors.gray600 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    ...fonts.bold,
    fontSize: 9,
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  detailHero: { height: 220, backgroundColor: colors.black, justifyContent: 'flex-end' },
  detailShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  detailClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitleWrap: { padding: 20, paddingRight: 60, gap: 6 },
  detailTitle: { ...fonts.black, fontSize: 24, lineHeight: 29, color: colors.white },
  detailBody: { gap: 16, paddingBottom: 8 },
  detailDesc: {
    ...fonts.medium,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 23,
    color: colors.gray600,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,61,61,0.3)',
    paddingLeft: 14,
  },
  detailEmpty: { ...fonts.medium, fontStyle: 'italic', fontSize: 13, color: colors.gray400 },
  detailFooter: { gap: 10 },
  detailUrl: { ...fonts.bold, fontSize: 10, color: colors.gray400, textTransform: 'uppercase', letterSpacing: 1 },
  noLink: { color: colors.gray400, textAlign: 'center', paddingVertical: 4 },
});

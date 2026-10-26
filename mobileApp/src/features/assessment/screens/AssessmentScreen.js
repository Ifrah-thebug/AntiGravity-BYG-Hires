import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { ArrowRight, ClipboardCheck, Flame, Save, Send, Sparkles, Timer } from 'lucide-react-native';
import { Banner, Button, FullScreenLoader, Screen, TopBar } from '@/shared/components/ui';
import { useScrollToFocusedInput } from '@/shared/components/ui/Screen';
import { colors, fonts, radius, type } from '@/shared/theme';
import { scoreBadgeColors } from '@/shared/lib/skillAssessmentDisplay';
import { useAuth } from '@/features/auth/context/AuthContext';
import { ROUTES } from '@/app/navigation/routes';
import {
  fetchAssessmentSession,
  fetchAssessmentStatus,
  saveAssessmentDraft,
  startAssessment,
  submitAssessment,
} from '@/features/assessment/api/assessmentApi';
import AssessmentGeneratingLoader from '@/features/assessment/components/AssessmentGeneratingLoader';
import AssessmentResult from '@/features/assessment/components/AssessmentResult';

const STEPS = { LOADING: 'loading', PICK: 'pick', GENERATING: 'generating', EXAM: 'exam', RESULT: 'result' };

const GENERATING_STATUS_LINES = [
  'Crafting unique scenario questions for your skills test…',
  'Tailoring questions to your profile and experience…',
  'Almost there — your test is on the way…',
];

function isSameSkill(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function pickDefaultSkill(skills, inProgressSkill, bestSkill) {
  if (inProgressSkill) {
    const unfinished = (skills || []).find((s) => isSameSkill(s, inProgressSkill));
    if (unfinished) return unfinished;
  }
  return bestSkill || skills?.[0] || '';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Answer box — paste menu hidden; keeps the cursor above the keyboard while typing. */
function AnswerInput({ value, onChangeText }) {
  const scrollToFocused = useScrollToFocusedInput();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onFocus={scrollToFocused}
      onContentSizeChange={scrollToFocused}
      multiline
      contextMenuHidden
      placeholder="Write a clear, specific answer with examples from your experience (min. 20 characters)…"
      placeholderTextColor={colors.gray400}
      textAlignVertical="top"
      style={styles.answer}
    />
  );
}

function confirmAsync(title, message) {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]);
  });
}

/** Web: /assessment — pick a skill, AI generates 5 questions, 25-min timed test, AI grading. */
export default function AssessmentScreen({ navigation }) {
  const { user, loading: authLoading } = useAuth();
  const scrollRef = useRef(null);

  const [step, setStep] = useState(STEPS.LOADING);
  const [status, setStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftState, setDraftState] = useState('idle');
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [tabWarning, setTabWarning] = useState(false);
  const [generatingMessageIndex, setGeneratingMessageIndex] = useState(0);
  const [generatingElapsed, setGeneratingElapsed] = useState(0);
  const [questionSource, setQuestionSource] = useState('');
  const [generateRetryable, setGenerateRetryable] = useState(false);
  const [viewingPast, setViewingPast] = useState(false);
  const [loadingSkill, setLoadingSkill] = useState('');
  const stepRef = useRef(step);
  const submittingRef = useRef(false);

  const questions = useMemo(() => session?.questions || [], [session?.questions]);
  const question = questions[currentQ];
  const inProgressSkill = status?.activeSession?.skill || '';

  useEffect(() => {
    stepRef.current = step;
  }, [step]);


  const loadStatus = useCallback(async () => {
    setError('');
    try {
      const data = await fetchAssessmentStatus();
      setStatus(data);
      setStep((prev) => (prev === STEPS.EXAM || prev === STEPS.GENERATING ? prev : STEPS.PICK));
      setSelectedSkill((prev) => {
        const lockedStep = stepRef.current === STEPS.GENERATING || stepRef.current === STEPS.EXAM;
        const skills = data.skills || [];
        if (lockedStep && prev) return prev;
        if (prev && skills.some((s) => isSameSkill(s, prev))) return prev;
        return pickDefaultSkill(skills, data.activeSession?.skill, data.best_skill);
      });
    } catch (err) {
      setError(err.message || 'Could not load assessment.');
      setStep(STEPS.PICK);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigation.reset({ index: 0, routes: [{ name: ROUTES.Login }] });
      return;
    }
    loadStatus();
  }, [user, authLoading, navigation, loadStatus]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step, currentQ]);

  // Leaving the app during the exam is flagged (web: tab switch warning).
  // Only a real background counts: iOS "inactive" (Control Center, call banner) is ignored.
  useEffect(() => {
    if (step !== STEPS.EXAM) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') setTabWarning(true);
    });
    return () => sub.remove();
  }, [step]);

  useEffect(() => {
    if (step !== STEPS.EXAM || !session?.expires_at) return undefined;
    const tick = () => {
      const expires = new Date(session.expires_at).getTime();
      setTimeLeft(Math.max(0, Math.floor((expires - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, session?.expires_at]);

  useEffect(() => {
    if (step !== STEPS.GENERATING) {
      setGeneratingElapsed(0);
      return undefined;
    }
    setGeneratingElapsed(0);
    const tick = setInterval(() => setGeneratingElapsed((s) => s + 1), 1000);
    const rotate = setInterval(
      () => setGeneratingMessageIndex((i) => (i + 1) % GENERATING_STATUS_LINES.length),
      3200
    );
    return () => {
      clearInterval(tick);
      clearInterval(rotate);
    };
  }, [step]);

  const allAnswered = useMemo(
    () => questions.every((q) => String(answers[q.id] || '').trim().length >= 20),
    [questions, answers]
  );

  const handleStart = async (skillOverride) => {
    const skill = skillOverride || selectedSkill;
    if (!skill || starting) return;

    if (inProgressSkill && !isSameSkill(skill, inProgressSkill)) {
      const ok = await confirmAsync(
        'Discard unfinished test?',
        `You have an unfinished test for ${inProgressSkill}. Starting ${skill} will discard that attempt (it won't be saved). Continue?`
      );
      if (!ok) return;
    }

    setSelectedSkill(skill);
    setViewingPast(false);
    setResult(null);
    setStarting(true);
    setError('');
    setGeneratingMessageIndex(0);
    setGenerateRetryable(false);
    setQuestionSource('');
    setStep(STEPS.GENERATING);
    try {
      const data = await startAssessment(skill);
      setSession(data.session);
      setAnswers(data.session.answers || {});
      setQuestionSource(data.questionSource || 'gemini');
      setCurrentQ(0);
      const expires = new Date(data.session.expires_at).getTime();
      setTimeLeft(Math.max(0, Math.floor((expires - Date.now()) / 1000)));
      setStep(STEPS.EXAM);
    } catch (err) {
      const busy =
        err.status === 503 ||
        err.code === 'AI_GENERATE_UNAVAILABLE' ||
        /high demand|busy|try again/i.test(String(err.message || ''));
      setGenerateRetryable(busy || err.retryable !== false);
      setError(
        err.message ||
          (busy ? 'Our AI question generator is busy. Please wait a moment and try again.' : 'Could not start assessment.')
      );
      setStep(STEPS.PICK);
    } finally {
      setStarting(false);
    }
  };

  const handleSkillClick = async (skill) => {
    setSelectedSkill(skill);
    const sessionId = status?.completedSessions?.[skill]?.sessionId;
    if (!sessionId) return;

    setLoadingSkill(skill);
    setError('');
    try {
      const data = await fetchAssessmentSession(sessionId);
      setSession(data.session);
      setResult({ total_score: data.session.total_score, summary: data.session.feedback_summary, session: data.session });
      setViewingPast(true);
      setStep(STEPS.RESULT);
    } catch (err) {
      setError(err.message || 'Could not load past results.');
    } finally {
      setLoadingSkill('');
    }
  };

  const handleSkillRowClick = (skill) => {
    if (status?.completedSessions?.[skill]) {
      handleSkillClick(skill);
      return;
    }
    setSelectedSkill(skill);
  };

  const handleBackToPick = () => {
    setViewingPast(false);
    setResult(null);
    setSession(null);
    setAnswers({});
    setCurrentQ(0);
    setStep(STEPS.LOADING);
    loadStatus();
  };

  const handleSaveDraft = async () => {
    if (!session?.id) return;
    setDraftState('saving');
    try {
      const data = await saveAssessmentDraft(session.id, answers);
      setSession(data.session);
      setDraftState('saved');
      setTimeout(() => setDraftState('idle'), 2000);
    } catch {
      setDraftState('idle');
    }
  };

  const handleSubmit = async () => {
    // Ref guard: a fast double tap must not send two submissions.
    if (!session?.id || !allAnswered || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      await saveAssessmentDraft(session.id, answers);
      const data = await submitAssessment(session.id, answers);
      setResult(data);
      setSession(data.session);
      setViewingPast(false);
      setStep(STEPS.RESULT);
    } catch (err) {
      const busy =
        err.status === 503 ||
        err.code === 'AI_GRADE_UNAVAILABLE' ||
        /grader is busy|high demand|try again/i.test(String(err.message || ''));
      setError(
        err.message ||
          (busy ? 'Our AI grader is busy. Your answers are saved — please try submitting again.' : 'Submission failed.')
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Back / swipe / "Portal" while a test is being generated or taken: confirm first.
  // Attempts cannot be resumed (backend rule, same as web), so say so plainly.
  usePreventRemove(step === STEPS.EXAM || step === STEPS.GENERATING, ({ data }) => {
    const inExam = stepRef.current === STEPS.EXAM;
    Alert.alert(
      'Leave the skills test?',
      inExam
        ? 'This attempt cannot be resumed. If you leave, you will need to start again with new questions.'
        : 'Your test is still being prepared. If you leave now, you will need to start again.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ]
    );
  });

  const backToPortal = () => navigation.popTo(ROUTES.Portal);

  if (authLoading || step === STEPS.LOADING) return <FullScreenLoader />;

  const selectedIsInProgress = inProgressSkill && isSameSkill(selectedSkill, inProgressSkill);

  return (
    <Screen ref={scrollRef} contentStyle={styles.content}>
      <TopBar
        onBack={backToPortal}
        right={
          step === STEPS.EXAM ? (
            <View style={[styles.timer, timeLeft < 300 && styles.timerLow]}>
              <Timer size={14} color={timeLeft < 300 ? colors.red : colors.gray700} />
              <Text style={[styles.timerText, timeLeft < 300 && { color: colors.red }]}>{formatTime(timeLeft)}</Text>
            </View>
          ) : null
        }
      />

      {tabWarning && step === STEPS.EXAM ? (
        <Banner
          tone="warning"
          message="Please stay in the app during your assessment. Leaving the app is logged for integrity."
          style={styles.mb}
        />
      ) : null}

      {error ? (
        <Banner tone="error" message={error} style={styles.mb}>
          {generateRetryable && step === STEPS.PICK && selectedSkill ? (
            <Button
              title={starting ? 'Retrying…' : 'Try again'}
              size="sm"
              variant="danger"
              fullWidth={false}
              onPress={() => handleStart(selectedSkill)}
              disabled={starting}
              style={{ marginTop: 8 }}
            />
          ) : null}
        </Banner>
      ) : null}

      {step === STEPS.GENERATING ? (
        <AssessmentGeneratingLoader
          skill={selectedSkill}
          elapsedSeconds={generatingElapsed}
          statusLine={GENERATING_STATUS_LINES[generatingMessageIndex]}
        />
      ) : null}

      {step === STEPS.PICK ? (
        <View style={styles.pick}>
          <View style={styles.center}>
            <View style={styles.bigIcon}>
              <ClipboardCheck size={28} color={colors.white} />
            </View>
            <View style={styles.eyebrowRow}>
              <Sparkles size={12} color={colors.red} />
              <Text style={[type.eyebrow, { color: colors.red }]}>Skills assessment</Text>
            </View>
            <Text style={styles.h1}>Prove your expertise</Text>
            <Text style={styles.lead}>
              Pick a skill from your profile. Each test uses unique scenario questions. Your score is shown on your public
              profile for that skill.
            </Text>
          </View>

          {inProgressSkill ? (
            <Banner tone="warning" icon={null}>
              <Text style={styles.warnTitle}>
                Unfinished test for <Text style={{ color: colors.red }}>{inProgressSkill}</Text>
              </Text>
              <Text style={styles.warnText}>
                Only one unfinished test is saved at a time. This is yours right now. Starting any skill (including{' '}
                {inProgressSkill} again) discards it and uses new questions — you cannot resume a previous attempt.
              </Text>
            </Banner>
          ) : null}

          {status?.assessedCount > 0 ? (
            <View style={styles.progressBox}>
              <Text style={[type.eyebrow, { color: colors.gray400 }]}>Your progress</Text>
              <Text style={styles.progressValue}>
                {status.assessedCount} / {status.skills?.length || 0}
                <Text style={styles.progressSuffix}>  skills assessed</Text>
              </Text>
              {status.averageScore != null ? (
                <Text style={styles.avg}>Average score: {status.averageScore}/100</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.skillList}>
            <Text style={[type.eyebrow, { color: colors.gray400 }]}>Choose skill to assess</Text>
            {(status?.skills || []).map((skill) => {
              const score = status?.skillScores?.[skill];
              const isAssessed = status?.completedSessions?.[skill];
              const isInProgress = inProgressSkill && isSameSkill(skill, inProgressSkill);
              const selected = selectedSkill === skill;
              const isLoading = loadingSkill === skill;
              return (
                <Pressable
                  key={skill}
                  onPress={() => handleSkillRowClick(skill)}
                  disabled={!!loadingSkill}
                  style={[
                    styles.skillRow,
                    isInProgress ? styles.skillProgress : selected ? styles.skillSelected : null,
                    loadingSkill && { opacity: 0.6 },
                  ]}
                >
                  <View style={styles.flex}>
                    <View style={styles.rowGap}>
                      {skill === status?.best_skill ? <Flame size={14} color={colors.red} fill={colors.red20} /> : null}
                      <Text style={styles.skillName} numberOfLines={1}>{skill}</Text>
                    </View>
                    {isInProgress ? (
                      <Text style={styles.skillSubAmber}>Unfinished — start again for new questions</Text>
                    ) : isAssessed ? (
                      <Text style={styles.skillSub}>Tap to view feedback</Text>
                    ) : null}
                  </View>
                  {isLoading ? (
                    <Text style={styles.skillSub}>Loading…</Text>
                  ) : isInProgress ? (
                    <Text style={styles.inProgressTag}>In progress</Text>
                  ) : score != null ? (
                    <Text style={[styles.scoreTag, scoreBadgeColors(score)]}>{score}/100</Text>
                  ) : (
                    <Text style={styles.skillSub}>Not assessed</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {status?.completedSessions?.[selectedSkill] ? (
            <Button
              title={loadingSkill === selectedSkill ? 'Loading feedback…' : 'View feedback & retake'}
              iconRight={ArrowRight}
              loading={loadingSkill === selectedSkill}
              disabled={!selectedSkill || !!loadingSkill}
              onPress={() => handleSkillClick(selectedSkill)}
            />
          ) : (
            <Button
              title={starting ? 'Generating questions…' : selectedIsInProgress ? 'Start again with new questions' : 'Start skills test'}
              iconRight={ArrowRight}
              loading={starting}
              disabled={!selectedSkill || starting}
              onPress={() => handleStart()}
            />
          )}

          <Text style={styles.footNote}>~25 minutes · 5 questions · Paste disabled on answers · Stay in the app</Text>
        </View>
      ) : null}

      {step === STEPS.EXAM && session && question ? (
        <View style={styles.exam}>
          {questionSource === 'fallback' ? (
            <Banner tone="warning" icon={null}>
              <Text style={styles.warnText}>
                AI was unavailable — these are standard practice questions. For a fully tailored test, try generating again.
              </Text>
              <Button
                title="Regenerate with AI"
                size="sm"
                fullWidth={false}
                onPress={() => handleStart(session.skill)}
                disabled={starting}
                style={{ marginTop: 8 }}
              />
            </Banner>
          ) : null}

          <View style={styles.examHead}>
            <View>
              <Text style={[type.eyebrow, { color: colors.red }]}>{session.skill}</Text>
              <Text style={styles.qCount}>Question {currentQ + 1} of {questions.length}</Text>
            </View>
            <View style={styles.qNav}>
              {questions.map((q, i) => {
                const active = i === currentQ;
                const answered = answers[q.id]?.trim();
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => setCurrentQ(i)}
                    style={[styles.qDot, active ? styles.qDotActive : answered ? styles.qDotDone : null]}
                  >
                    <Text style={[styles.qDotText, (active || answered) && { color: colors.white }]}>{i + 1}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${((currentQ + 1) / questions.length) * 100}%` }]} />
          </View>

          <View style={styles.questionCard}>
            <View pointerEvents="none" style={styles.qGlow} />
            <Text style={[type.eyebrow, { color: colors.gray400, marginBottom: 10 }]}>{question.type}</Text>
            <Text style={styles.prompt} selectable={false}>{question.prompt}</Text>
          </View>

          <View style={styles.answerBlock}>
            <Text style={[type.eyebrow, { color: colors.gray400 }]}>Your answer</Text>
            <AnswerInput
              value={answers[question.id] || ''}
              onChangeText={(value) => setAnswers((prev) => ({ ...prev, [question.id]: value }))}
            />
            <Text style={styles.charCount}>{(answers[question.id] || '').length} characters · paste disabled on answers</Text>
          </View>

          <View style={styles.examActions}>
            <Button
              title="Previous"
              size="sm"
              variant="outline"
              fullWidth={false}
              disabled={currentQ === 0}
              onPress={() => setCurrentQ((q) => Math.max(0, q - 1))}
            />
            {currentQ < questions.length - 1 ? (
              <Button title="Next question" size="sm" onPress={() => setCurrentQ((q) => q + 1)} style={styles.flex} />
            ) : (
              <Button
                title={submitting ? 'Evaluating answers…' : 'Submit test'}
                size="sm"
                variant="danger"
                icon={submitting ? undefined : Send}
                loading={submitting}
                disabled={!allAnswered || submitting}
                onPress={handleSubmit}
                style={styles.flex}
              />
            )}
          </View>
          <Button
            title={draftState === 'saved' ? 'Saved' : 'Save draft'}
            size="sm"
            variant="outline"
            icon={Save}
            loading={draftState === 'saving'}
            onPress={handleSaveDraft}
          />
        </View>
      ) : null}

      {step === STEPS.RESULT && result ? (
        <AssessmentResult
          result={result}
          session={session}
          viewingPast={viewingPast}
          starting={starting}
          onRetake={() => handleStart(session?.skill || selectedSkill)}
          onTestAnother={handleBackToPick}
          onBackToPortal={backToPortal}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  content: { paddingBottom: 110 },
  mb: { marginBottom: 18 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.gray100, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  timerLow: { backgroundColor: colors.red10 },
  timerText: { ...fonts.black, fontSize: 12, color: colors.gray700 },
  pick: { gap: 24 },
  center: { alignItems: 'center', gap: 10 },
  bigIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  h1: { ...fonts.extrabold, fontSize: 28, color: colors.black, textAlign: 'center' },
  lead: { ...fonts.medium, fontSize: 14, lineHeight: 21, color: colors.gray600, textAlign: 'center' },
  warnTitle: { ...fonts.bold, fontSize: 13, color: colors.amber900 },
  warnText: { ...fonts.medium, fontSize: 12, lineHeight: 18, color: colors.amber800 },
  progressBox: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray100, borderRadius: radius.lg, padding: 18, alignItems: 'center', gap: 4 },
  progressValue: { ...fonts.black, fontSize: 24, color: colors.black },
  progressSuffix: { ...fonts.bold, fontSize: 13, color: colors.gray400 },
  avg: { ...fonts.semibold, fontSize: 12, color: colors.gray500 },
  skillList: { gap: 8 },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.gray100,
    backgroundColor: colors.white,
  },
  skillProgress: { borderColor: colors.amber200, backgroundColor: 'rgba(255,251,235,0.8)' },
  skillSelected: { borderColor: colors.red, backgroundColor: colors.red5 },
  skillName: { ...fonts.black, fontSize: 14, color: colors.black, flexShrink: 1 },
  skillSub: { ...fonts.bold, fontSize: 10, color: colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  skillSubAmber: { ...fonts.bold, fontSize: 10, color: colors.amber700, textTransform: 'uppercase', marginTop: 2 },
  inProgressTag: {
    ...fonts.black,
    fontSize: 10,
    color: colors.amber800,
    backgroundColor: colors.amber100,
    borderWidth: 1,
    borderColor: colors.amber300,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  scoreTag: { ...fonts.black, fontSize: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  footNote: { ...fonts.medium, fontSize: 11, color: colors.gray400, textAlign: 'center' },
  exam: { gap: 18 },
  examHead: { gap: 12 },
  qCount: { ...fonts.bold, fontSize: 12, color: colors.gray400, marginTop: 2 },
  qNav: { flexDirection: 'row', gap: 6 },
  qDot: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  qDotActive: { backgroundColor: colors.red },
  qDotDone: { backgroundColor: colors.black },
  qDotText: { ...fonts.black, fontSize: 11, color: colors.gray400 },
  bar: { height: 6, backgroundColor: colors.gray100, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.red },
  questionCard: { backgroundColor: colors.black, borderRadius: radius.xxl, padding: 24, overflow: 'hidden' },
  qGlow: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.red, opacity: 0.2 },
  prompt: { ...fonts.bold, fontSize: 16, lineHeight: 25, color: colors.white },
  answerBlock: { gap: 8 },
  answer: {
    ...fonts.medium,
    minHeight: 180,
    fontSize: 14,
    lineHeight: 21,
    color: colors.gray900,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    padding: 16,
  },
  charCount: { ...fonts.medium, fontSize: 10, color: colors.gray400 },
  examActions: { flexDirection: 'row', gap: 10 },
});

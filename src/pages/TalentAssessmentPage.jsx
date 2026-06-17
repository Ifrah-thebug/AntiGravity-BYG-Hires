import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Flame,
  Loader2, Save, Send, Sparkles, Timer, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAssessmentStatus,
  fetchAssessmentSession,
  startAssessment,
  saveAssessmentDraft,
  submitAssessment,
} from '../services/assessmentService';
import { scoreBadgeClass } from '../lib/skillAssessmentDisplay';
import AssessmentGeneratingLoader from '../components/AssessmentGeneratingLoader';

const STEPS = { LOADING: 'loading', PICK: 'pick', GENERATING: 'generating', EXAM: 'exam', RESULT: 'result' };

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

const GENERATING_STATUS_LINES = [
  'Crafting unique scenario questions for your skills test…',
  'Tailoring questions to your profile and experience…',
  'Almost there — your test is on the way…',
];

function blockClipboard(e) {
  e.preventDefault();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSubmittedAt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function scrollAssessmentToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export default function TalentAssessmentPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

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
  const pageTopRef = useRef(null);
  const stepRef = useRef(step);

  const questions = session?.questions || [];
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
        const currentStep = stepRef.current;
        const lockedStep = currentStep === STEPS.GENERATING || currentStep === STEPS.EXAM;
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
    document.title = 'Skills assessment | BYG Hires';
    return () => { document.title = 'BYG Hires'; };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: '/assessment' } });
      return;
    }
    loadStatus();
  }, [user, authLoading, navigate, loadStatus]);

  useLayoutEffect(() => {
    scrollAssessmentToTop();
    pageTopRef.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  useLayoutEffect(() => {
    if (step !== STEPS.EXAM) return;
    scrollAssessmentToTop();
    pageTopRef.current?.scrollIntoView({ block: 'start' });
  }, [currentQ, step]);

  useEffect(() => {
    if (step !== STEPS.EXAM) return undefined;
    const onVis = () => {
      if (document.hidden) setTabWarning(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [step]);

  useEffect(() => {
    if (step !== STEPS.EXAM || !session?.expires_at) return undefined;
    const tick = () => {
      const expires = new Date(session.expires_at).getTime();
      const left = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, session?.expires_at]);

  const allAnswered = useMemo(
    () => questions.every((q) => String(answers[q.id] || '').trim().length >= 20),
    [questions, answers]
  );

  const handleStart = async (skillOverride) => {
    const skill = skillOverride || selectedSkill;
    if (!skill || starting) return;

    if (
      inProgressSkill &&
      !isSameSkill(skill, inProgressSkill) &&
      !window.confirm(
        `You have an unfinished test for ${inProgressSkill}. Starting ${skill} will discard that attempt (it won't be saved). Continue?`
      )
    ) {
      return;
    }

    setSelectedSkill(skill);
    setViewingPast(false);
    setResult(null);
    setStarting(true);
    setError('');
    setGeneratingMessageIndex(0);
    setGenerateRetryable(false);
    setQuestionSource('');
    scrollAssessmentToTop();
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
          (busy
            ? 'Our AI question generator is busy. Please wait a moment and try again.'
            : 'Could not start assessment.')
      );
      setStep(STEPS.PICK);
    } finally {
      setStarting(false);
    }
  };

  const handleSkillRowClick = (skill) => {
    if (status?.completedSessions?.[skill]) {
      handleSkillClick(skill);
      return;
    }
    setSelectedSkill(skill);
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
      setResult({
        total_score: data.session.total_score,
        summary: data.session.feedback_summary,
        session: data.session,
      });
      setViewingPast(true);
      setStep(STEPS.RESULT);
    } catch (err) {
      setError(err.message || 'Could not load past results.');
    } finally {
      setLoadingSkill('');
    }
  };

  const handleRetake = () => {
    const skill = session?.skill || selectedSkill;
    handleStart(skill);
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

  const selectedIsInProgress = inProgressSkill && isSameSkill(selectedSkill, inProgressSkill);

  useEffect(() => {
    if (step !== STEPS.GENERATING) {
      setGeneratingElapsed(0);
      return undefined;
    }
    setGeneratingElapsed(0);
    const tick = setInterval(() => {
      setGeneratingElapsed((s) => s + 1);
    }, 1000);
    const rotate = setInterval(() => {
      setGeneratingMessageIndex((i) => (i + 1) % GENERATING_STATUS_LINES.length);
    }, 3200);
    return () => {
      clearInterval(tick);
      clearInterval(rotate);
    };
  }, [step]);

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
    if (!session?.id || !allAnswered) return;
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
          (busy
            ? 'Our AI grader is busy. Your answers are saved — please try submitting again.'
            : 'Submission failed.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  if (authLoading || step === STEPS.LOADING) {
    return (
      <div className="bg-white min-h-screen pt-28 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-red animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pt-24 pb-24 font-sans">
      <div ref={pageTopRef} className="max-w-3xl mx-auto px-4 sm:px-6 scroll-mt-28">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/portal"
            className="inline-flex items-center gap-2 text-xs font-black text-gray-400 hover:text-black uppercase tracking-widest transition-colors"
          >
            <ArrowLeft size={14} /> Portal
          </Link>
          {step === STEPS.EXAM && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black ${
              timeLeft < 300 ? 'bg-red/10 text-red' : 'bg-gray-100 text-gray-700'
            }`}>
              <Timer size={14} />
              {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {tabWarning && step === STEPS.EXAM && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-semibold flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            Please stay on this tab during your assessment. Tab switches are logged for integrity.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red/5 border border-red/20 text-red text-sm font-semibold flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {generateRetryable && step === STEPS.PICK && selectedSkill && (
              <button
                type="button"
                onClick={() => handleStart(selectedSkill)}
                disabled={starting}
                className="shrink-0 px-4 py-2 bg-red hover:bg-black text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors"
              >
                {starting ? 'Retrying…' : 'Try again'}
              </button>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === STEPS.GENERATING && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center py-12"
            >
              <AssessmentGeneratingLoader
                skill={selectedSkill}
                elapsedSeconds={generatingElapsed}
                statusLine={GENERATING_STATUS_LINES[generatingMessageIndex]}
              />
            </motion.div>
          )}

          {step === STEPS.PICK && (
            <motion.div
              key="pick"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red text-white">
                  <ClipboardCheck size={28} />
                </div>
                <p className="text-red font-bold tracking-[0.2em] uppercase text-xs flex items-center justify-center gap-2">
                  <Sparkles size={12} /> Skills assessment
                </p>
                <h1 className="text-3xl md:text-4xl font-extrabold text-black tracking-tight">
                  Prove your expertise
                </h1>
                <p className="text-gray-600 font-medium max-w-lg mx-auto leading-relaxed">
                  Pick a skill from your profile. Each test uses unique scenario questions.
                  Your score is shown on your public profile for that skill.
                </p>
              </div>

              {inProgressSkill && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-left space-y-2">
                  <p className="text-sm font-bold text-amber-900">
                    Unfinished test for <span className="text-red">{inProgressSkill}</span>
                  </p>
                  <p className="text-xs text-amber-800/90 font-medium leading-relaxed">
                    Only one unfinished test is saved at a time. This is yours right now.
                    Starting any skill (including {inProgressSkill} again) discards it and
                    uses new questions — you cannot resume a previous attempt.
                  </p>
                </div>
              )}

              {status?.assessedCount > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                    Your progress
                  </p>
                  <p className="font-black text-2xl text-black">
                    {status.assessedCount} / {status.skills?.length || 0}
                    <span className="text-sm font-bold text-gray-400 ml-2">skills assessed</span>
                  </p>
                  {status.averageScore != null && (
                    <p className="text-xs font-semibold text-gray-500 mt-1">
                      Average score: {status.averageScore}/100
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Choose skill to assess
                </p>
                <div className="grid gap-2">
                  {(status?.skills || []).map((skill) => {
                    const score = status?.skillScores?.[skill];
                    const isAssessed = status?.completedSessions?.[skill];
                    const isInProgress = inProgressSkill && isSameSkill(skill, inProgressSkill);
                    const selected = selectedSkill === skill;
                    const isLoading = loadingSkill === skill;
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleSkillRowClick(skill)}
                        disabled={!!loadingSkill}
                        className={`w-full text-left flex items-center justify-between gap-3 p-4 rounded-2xl border-2 transition-all disabled:opacity-60 ${
                          isInProgress
                            ? 'border-amber-200 bg-amber-50/80 hover:border-amber-300'
                            : selected
                              ? 'border-red bg-red/5'
                              : 'border-gray-100 bg-white hover:border-gray-200'
                        }`}
                      >
                        <span className="flex flex-col items-start gap-0.5 min-w-0">
                          <span className="flex items-center gap-2 min-w-0">
                            {skill === status?.best_skill && (
                              <Flame size={14} className="text-red shrink-0 fill-red/20" />
                            )}
                            <span className="font-black text-sm text-black truncate">{skill}</span>
                          </span>
                          {isInProgress ? (
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                              Unfinished — start again for new questions
                            </span>
                          ) : isAssessed ? (
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                              Tap to view feedback
                            </span>
                          ) : null}
                        </span>
                        {isLoading ? (
                          <Loader2 size={16} className="text-red animate-spin shrink-0" />
                        ) : isInProgress ? (
                          <span className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black border border-amber-300 bg-amber-100 text-amber-800">
                            In progress
                          </span>
                        ) : score != null ? (
                          <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black border ${scoreBadgeClass(score)}`}>
                            {score}/100
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] font-bold text-gray-400 uppercase">
                            Not assessed
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {status?.completedSessions?.[selectedSkill] ? (
                <button
                  type="button"
                  onClick={() => handleSkillClick(selectedSkill)}
                  disabled={!selectedSkill || !!loadingSkill}
                  className="w-full py-4 bg-black hover:bg-red disabled:opacity-40 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  {loadingSkill === selectedSkill ? (
                    <><Loader2 size={16} className="animate-spin" /> Loading feedback…</>
                  ) : (
                    <>View feedback & retake <ArrowRight size={16} /></>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStart()}
                  disabled={!selectedSkill || starting}
                  className="w-full py-4 bg-black hover:bg-red disabled:opacity-40 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  {starting ? (
                    <><Loader2 size={16} className="animate-spin" /> Generating questions…</>
                  ) : selectedIsInProgress ? (
                    <>Start again with new questions <ArrowRight size={16} /></>
                  ) : (
                    <>Start skills test <ArrowRight size={16} /></>
                  )}
                </button>
              )}

              <p className="text-center text-[11px] text-gray-400 font-medium">
                ~25 minutes · 5 questions · Paste disabled on answers · Stay on this tab
              </p>
            </motion.div>
          )}

          {step === STEPS.EXAM && session && question && (
            <motion.div
              key="exam"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {questionSource === 'fallback' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-medium flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p>
                    AI was unavailable — these are standard practice questions.
                    For a fully tailored test, try generating again.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleStart(session.skill)}
                    disabled={starting}
                    className="shrink-0 px-4 py-2 bg-black hover:bg-red text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors"
                  >
                    Regenerate with AI
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black text-red uppercase tracking-widest">{session.skill}</p>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">
                    Question {currentQ + 1} of {questions.length}
                  </p>
                </div>
                <div className="flex gap-1">
                  {questions.map((q, i) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentQ(i)}
                      className={`w-8 h-8 rounded-lg text-[10px] font-black transition-colors ${
                        i === currentQ
                          ? 'bg-red text-white'
                          : answers[q.id]?.trim()
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red transition-all duration-300"
                  style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                />
              </div>

              <div
                className="bg-black text-white rounded-[2rem] p-8 relative overflow-hidden select-none"
                onCopy={blockClipboard}
                onCut={blockClipboard}
                onContextMenu={blockClipboard}
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-red rounded-full blur-[80px] opacity-20 pointer-events-none" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 relative z-10">
                  {question.type}
                </p>
                <p className="text-base md:text-lg font-bold leading-relaxed relative z-10 max-w-2xl">{question.prompt}</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  Your answer
                </label>
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  onPaste={blockClipboard}
                  rows={8}
                  placeholder="Write a clear, specific answer with examples from your experience (min. 20 characters)…"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-900 focus:border-red focus:bg-white outline-none resize-y min-h-[160px]"
                />
                <p className="text-[10px] text-gray-400 font-medium mt-1.5">
                  {(answers[question.id] || '').length} characters · paste disabled on answers
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentQ((q) => Math.max(0, q - 1))}
                  disabled={currentQ === 0}
                  className="px-5 py-3 border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 disabled:opacity-30 hover:border-gray-400 transition-colors"
                >
                  Previous
                </button>
                {currentQ < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQ((q) => q + 1)}
                    className="flex-1 py-3 bg-black hover:bg-red text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
                  >
                    Next question
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!allAnswered || submitting}
                    className="flex-1 py-3 bg-red hover:bg-black disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <><Loader2 size={16} className="animate-spin" /> Evaluating answers…</>
                    ) : (
                      <><Send size={14} /> Submit test</>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={draftState === 'saving'}
                  className="px-5 py-3 border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 hover:text-black transition-colors flex items-center gap-1.5"
                >
                  <Save size={13} />
                  {draftState === 'saved' ? 'Saved' : 'Save draft'}
                </button>
              </div>
            </motion.div>
          )}

          {step === STEPS.RESULT && result && (() => {
            const breakdown = result.session?.score_breakdown || {};
            const perQuestion = breakdown.per_question || [];
            const dimensions = breakdown.dimensions || {};
            const questionsById = Object.fromEntries(
              (session?.questions || []).map((q) => [q.id, q])
            );
            const dimensionLabels = {
              relevance: 'Relevance',
              depth: 'Depth',
              clarity: 'Clarity',
              practicality: 'Practicality',
              problem_solving: 'Problem solving',
            };

            return (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-600 mb-4">
                  <CheckCircle2 size={36} />
                </div>
                <h2 className="text-3xl font-extrabold text-black tracking-tight">
                  {viewingPast ? 'Your skills test results' : 'Skills test complete'}
                </h2>
                <p className="text-gray-500 font-medium mt-2">{session?.skill}</p>
                {viewingPast && session?.submitted_at && (
                  <p className="text-[11px] text-gray-400 font-semibold mt-1">
                    Submitted {formatSubmittedAt(session.submitted_at)}
                  </p>
                )}
              </div>

              <div className="text-center">
                <div className={`inline-block px-8 py-6 rounded-3xl border-2 ${scoreBadgeClass(result.total_score)}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Your score</p>
                  <p className="text-5xl font-black">{result.total_score}<span className="text-2xl">/100</span></p>
                </div>
              </div>

              {result.summary && (
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-left">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Overall feedback
                  </p>
                  <p className="text-gray-700 font-medium leading-relaxed">{result.summary}</p>
                </div>
              )}

              {Object.keys(dimensions).length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    How you were scored
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {Object.entries(dimensions).map(([key, dim]) => (
                      <div key={key} className="bg-white border border-gray-100 rounded-2xl p-4">
                        <div className="flex justify-between items-baseline gap-2 mb-1">
                          <p className="text-xs font-black text-black">
                            {dimensionLabels[key] || key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm font-black text-red">
                            {dim.score ?? '—'}/{dim.max ?? '—'}
                          </p>
                        </div>
                        {dim.note && (
                          <p className="text-[11px] text-gray-500 font-medium leading-snug">{dim.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {perQuestion.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Question-by-question feedback
                  </p>
                  <div className="space-y-3">
                    {perQuestion.map((item, index) => {
                      const q = questionsById[item.id];
                      return (
                        <div
                          key={item.id || index}
                          className="bg-white border border-gray-100 rounded-2xl p-5 text-left space-y-2"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-[10px] font-black text-red uppercase tracking-widest">
                              Question {index + 1}
                              {q?.type ? ` · ${q.type}` : ''}
                            </p>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${scoreBadgeClass(Math.round((item.score / (item.max_points || 20)) * 100))}`}>
                              {item.score}/{item.max_points ?? 20}
                            </span>
                          </div>
                          {q?.prompt && (
                            <p className="text-xs text-gray-500 font-medium leading-snug line-clamp-3">
                              {q.prompt}
                            </p>
                          )}
                          {item.feedback && (
                            <p className="text-sm text-gray-800 font-medium leading-relaxed pt-1 border-t border-gray-100">
                              {item.feedback}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="text-center text-[11px] text-gray-400 font-medium">
                {viewingPast
                  ? 'Review your feedback below, then retake when you are ready to improve your score.'
                  : 'Use this feedback to improve before your next skills test on this skill.'}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {viewingPast && (
                  <button
                    type="button"
                    onClick={handleRetake}
                    disabled={starting}
                    className="px-8 py-4 bg-red hover:bg-black disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
                  >
                    {starting ? (
                      <><Loader2 size={14} className="animate-spin" /> Starting…</>
                    ) : (
                      <>Retake with new questions <ArrowRight size={14} /></>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleBackToPick}
                  className="px-8 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-colors"
                >
                  Test another skill
                </button>
                <Link
                  to="/portal"
                  className="px-8 py-4 border-2 border-gray-200 text-gray-700 font-black text-xs uppercase tracking-widest rounded-2xl hover:border-black transition-colors text-center"
                >
                  Back to portal
                </Link>
              </div>
            </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}

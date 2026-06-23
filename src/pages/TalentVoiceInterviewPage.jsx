import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowLeft, ClipboardCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVapiInterview } from '../hooks/useVapiInterview';
import { fetchVoiceInterviewStatus } from '../services/voiceInterviewService';
import VoiceInterviewLanding from '../components/voiceInterview/VoiceInterviewLanding';
import { VoiceInterviewRoom } from '../components/voiceInterview/VoiceInterviewRoom';
import VoiceInterviewComplete from '../components/voiceInterview/VoiceInterviewComplete';
import VoiceInterviewResults from '../components/voiceInterview/VoiceInterviewResults';

const SCORE_POLL_INTERVAL_MS = 5000;
const SCORE_POLL_MAX_ATTEMPTS = 24;

export default function TalentVoiceInterviewPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    status,
    isSpeaking,
    liveCaption,
    error,
    context,
    loadContext,
    startInterview,
    endInterview,
    reset,
  } = useVapiInterview();

  const [gateLoading, setGateLoading] = useState(true);
  const [gateError, setGateError] = useState('');
  const [skillsRequired, setSkillsRequired] = useState(false);
  const [clientRequestRequired, setClientRequestRequired] = useState(false);
  const [interviewStatus, setInterviewStatus] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [statusRefreshing, setStatusRefreshing] = useState(false);
  const [scorePending, setScorePending] = useState(false);
  const pollAttemptsRef = useRef(0);
  const pollTimerRef = useRef(null);

  const clearScorePoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }, []);

  const refreshInterviewStatus = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatusRefreshing(true);
    try {
      const data = await fetchVoiceInterviewStatus();
      setInterviewStatus(data);
      if (data?.latestResult?.interview_score != null) {
        setScorePending(false);
        clearScorePoll();
      }
      return data;
    } catch (err) {
      if (!silent) {
        setGateError((prev) => prev || err.message || 'Could not load interview score.');
      }
      return null;
    } finally {
      if (!silent) setStatusRefreshing(false);
    }
  }, [clearScorePoll]);

  const startScorePolling = useCallback(() => {
    clearScorePoll();
    setScorePending(true);
    pollAttemptsRef.current = 0;

    pollTimerRef.current = setInterval(async () => {
      pollAttemptsRef.current += 1;
      const data = await refreshInterviewStatus({ silent: true });
      const hasScore = data?.latestResult?.interview_score != null;
      if (hasScore || pollAttemptsRef.current >= SCORE_POLL_MAX_ATTEMPTS) {
        clearScorePoll();
        if (hasScore) {
          setShowResults(true);
        }
      }
    }, SCORE_POLL_INTERVAL_MS);
  }, [clearScorePoll, refreshInterviewStatus]);

  useEffect(() => {
    document.title = 'AI voice interview | BYG Hires';
    return () => {
      document.title = 'BYG Hires';
      clearScorePoll();
    };
  }, [clearScorePoll]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: '/interview' } });
      return;
    }

    let cancelled = false;
    (async () => {
      setGateLoading(true);
      setGateError('');
      setSkillsRequired(false);
      setClientRequestRequired(false);

      const statusData = await refreshInterviewStatus({ silent: true }).catch(() => null);
      if (cancelled) return;

      if (statusData?.hasCompleted) {
        setShowResults(true);
      }

      if (!statusData?.interviewUnlocked && !statusData?.hasCompleted) {
        setClientRequestRequired(true);
        setGateError(
          'A client must request an AI interview before you can start. You will receive an email when a client requests one.'
        );
        setGateLoading(false);
        return;
      }

      if (!statusData?.interviewUnlocked) {
        setGateLoading(false);
        return;
      }

      try {
        await loadContext();
      } catch (err) {
        if (cancelled) return;
        if (err?.code === 'SKILLS_TEST_REQUIRED') {
          setSkillsRequired(true);
          setGateError(err.message);
        } else if (err?.code === 'CLIENT_REQUEST_REQUIRED') {
          setClientRequestRequired(true);
          setGateError(err.message);
        } else {
          setGateError(err.message || 'Could not load interview context.');
        }
      } finally {
        if (!cancelled) setGateLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate, loadContext, refreshInterviewStatus]);

  const handleRetake = () => {
    setShowResults(false);
    reset();
  };

  const handleInterviewComplete = () => {
    reset();
    setShowResults(true);
    startScorePolling();
    refreshInterviewStatus({ silent: true });
  };

  const isActive = status === 'connecting' || status === 'in_progress';
  const latestResult = interviewStatus?.latestResult || null;
  const interviewUnlocked = Boolean(interviewStatus?.interviewUnlocked);

  if (authLoading || gateLoading) {
    return (
      <div className="bg-white min-h-screen pt-28 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-red animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pt-24 pb-24 font-sans">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/portal"
            className="inline-flex items-center gap-2 text-xs font-black text-gray-400 hover:text-black uppercase tracking-widest transition-colors"
          >
            <ArrowLeft size={14} /> Portal
          </Link>
        </div>

        {skillsRequired && (
          <div className="mb-6 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-sm">Skills test required first</p>
                <p className="text-sm font-medium mt-1 leading-relaxed">{gateError}</p>
              </div>
            </div>
            <Link
              to="/assessment"
              className="inline-flex items-center gap-2 px-5 py-3 bg-black hover:bg-red text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors"
            >
              <ClipboardCheck size={14} />
              Go to skills test
            </Link>
          </div>
        )}

        {clientRequestRequired && (
          <div className="mb-6 p-5 rounded-2xl bg-gray-50 border border-gray-200 text-gray-800 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-gray-500" />
              <div>
                <p className="font-black text-sm">AI interview not available yet</p>
                <p className="text-sm font-medium mt-1 leading-relaxed">{gateError}</p>
              </div>
            </div>
            <Link
              to="/portal"
              className="inline-flex items-center gap-2 px-5 py-3 bg-black hover:bg-red text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors"
            >
              Back to portal
            </Link>
          </div>
        )}

        {gateError && !skillsRequired && !clientRequestRequired && (
          <div className="mb-6 p-4 rounded-2xl bg-red/5 border border-red/20 text-red text-sm font-semibold flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{gateError}</span>
          </div>
        )}

        {error && status === 'error' && (
          <div className="mb-6 p-4 rounded-2xl bg-red/5 border border-red/20 text-red text-sm font-semibold flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 px-4 py-2 bg-red hover:bg-black text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!skillsRequired && !clientRequestRequired && (
          <AnimatePresence mode="wait">
            {showResults && status === 'idle' && (latestResult || scorePending) && (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VoiceInterviewResults
                  result={latestResult}
                  attemptCount={interviewStatus?.attemptCount || 0}
                  onRetake={interviewUnlocked ? handleRetake : undefined}
                  onRefresh={() => refreshInterviewStatus()}
                  refreshing={statusRefreshing}
                  scorePending={scorePending}
                />
              </motion.div>
            )}

            {!showResults && status === 'idle' && context && (
              <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VoiceInterviewLanding
                  context={context}
                  onStart={startInterview}
                  isLoading={false}
                  hasPreviousAttempt={interviewStatus?.hasCompleted}
                />
              </motion.div>
            )}

            {isActive && (
              <motion.div key="room" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VoiceInterviewRoom
                  isSpeaking={isSpeaking}
                  isConnecting={status === 'connecting'}
                  liveCaption={liveCaption}
                  jobRole={context?.roleTitle}
                  onEnd={endInterview}
                />
              </motion.div>
            )}

            {status === 'complete' && (
              <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VoiceInterviewComplete
                  jobRole={context?.roleTitle}
                  onDone={handleInterviewComplete}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {!skillsRequired && !clientRequestRequired && !showResults && status === 'idle' && context && (
          <p className="text-center text-[11px] text-gray-400 font-medium mt-8">
            Voice only · ~15 minutes · Microphone required · Stay on this tab during your interview
          </p>
        )}
      </div>
    </div>
  );
}

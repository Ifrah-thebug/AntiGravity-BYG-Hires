import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { ClipboardCheck } from 'lucide-react-native';
import { Banner, Button, FullScreenLoader, Screen, TopBar } from '@/shared/components/ui';
import { colors, fonts } from '@/shared/theme';
import { useAuth } from '@/features/auth/context/AuthContext';
import { ROUTES } from '@/app/navigation/routes';
import { fetchVoiceInterviewStatus } from '@/features/interview/api/voiceInterviewApi';
import { useVapiInterview } from '@/features/interview/hooks/useVapiInterview';
import VapiBridge from '@/features/interview/vapi/VapiBridge';
import {
  VoiceInterviewComplete,
  VoiceInterviewLanding,
  VoiceInterviewResults,
  VoiceInterviewRoom,
} from '@/features/interview/components/VoiceInterviewViews';

const SCORE_POLL_INTERVAL_MS = 5000;
const SCORE_POLL_MAX_ATTEMPTS = 24;

/** Web: /interview — AI voice interview (unlocked when a client requests it). */
export default function VoiceInterviewScreen({ navigation }) {
  const { user, loading: authLoading } = useAuth();
  const {
    status,
    isSpeaking,
    liveCaption,
    error,
    micBlocked,
    notice,
    openSettings,
    context,
    loadContext,
    startInterview,
    endInterview,
    reset,
    bridgeRef,
    handleBridgeEvent,
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

  const refreshInterviewStatus = useCallback(
    async ({ silent = false } = {}) => {
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
        if (!silent) setGateError((prev) => prev || err.message || 'Could not load interview score.');
        return null;
      } finally {
        if (!silent) setStatusRefreshing(false);
      }
    },
    [clearScorePoll]
  );

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
        if (hasScore) setShowResults(true);
      }
    }, SCORE_POLL_INTERVAL_MS);
  }, [clearScorePoll, refreshInterviewStatus]);

  useEffect(() => () => clearScorePoll(), [clearScorePoll]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) {
      navigation.reset({ index: 0, routes: [{ name: ROUTES.Login }] });
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setGateLoading(true);
      setGateError('');
      setSkillsRequired(false);
      setClientRequestRequired(false);

      const statusData = await refreshInterviewStatus({ silent: true }).catch(() => null);
      if (cancelled) return;

      if (statusData?.hasCompleted) setShowResults(true);

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
  }, [user, authLoading, navigation, loadContext, refreshInterviewStatus]);

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

  const backToPortal = () => navigation.popTo(ROUTES.Portal);
  const isActive = status === 'connecting' || status === 'in_progress';
  const latestResult = interviewStatus?.latestResult || null;
  const interviewUnlocked = Boolean(interviewStatus?.interviewUnlocked);
  const blocked = skillsRequired || clientRequestRequired;

  // Back / swipe / "Portal" during a live call: confirm, end the call cleanly, then leave.
  usePreventRemove(isActive, ({ data }) => {
    Alert.alert('End interview?', 'Leaving this screen will end your AI interview.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'End interview',
        style: 'destructive',
        onPress: () => {
          endInterview();
          setTimeout(() => navigation.dispatch(data.action), 300);
        },
      },
    ]);
  });

  if (authLoading || gateLoading) return <FullScreenLoader />;

  return (
    <Screen contentStyle={styles.content}>
      <VapiBridge ref={bridgeRef} onEvent={handleBridgeEvent} />
      <TopBar onBack={backToPortal} />

      {skillsRequired ? (
        <Banner tone="warning" title="Skills test required first" message={gateError} style={styles.mb}>
          <Button
            title="Go to skills test"
            size="sm"
            icon={ClipboardCheck}
            fullWidth={false}
            onPress={() => navigation.navigate(ROUTES.Assessment)}
            style={{ marginTop: 10 }}
          />
        </Banner>
      ) : null}

      {clientRequestRequired ? (
        <Banner tone="info" title="AI interview not available yet" message={gateError} style={styles.mb}>
          <Button title="Back to portal" size="sm" fullWidth={false} onPress={backToPortal} style={{ marginTop: 10 }} />
        </Banner>
      ) : null}

      {gateError && !blocked ? <Banner tone="error" message={gateError} style={styles.mb} /> : null}

      {error && status === 'error' ? (
        <Banner tone="error" message={error} style={styles.mb}>
          {micBlocked ? (
            <Button title="Open settings" size="sm" fullWidth={false} onPress={openSettings} style={styles.bannerBtn} />
          ) : null}
          <Button title="Try again" size="sm" variant="danger" fullWidth={false} onPress={reset} style={styles.bannerBtn} />
        </Banner>
      ) : null}

      {notice && isActive ? <Banner tone="warning" message={notice} style={styles.mb} /> : null}

      {!blocked ? (
        <View>
          {showResults && status === 'idle' && (latestResult || scorePending) ? (
            <VoiceInterviewResults
              result={latestResult}
              attemptCount={interviewStatus?.attemptCount || 0}
              onRetake={interviewUnlocked ? handleRetake : undefined}
              onRefresh={() => refreshInterviewStatus()}
              refreshing={statusRefreshing}
              scorePending={scorePending}
            />
          ) : null}

          {!showResults && status === 'idle' && context ? (
            <VoiceInterviewLanding
              context={context}
              onStart={startInterview}
              isLoading={false}
              hasPreviousAttempt={interviewStatus?.hasCompleted}
            />
          ) : null}

          {isActive ? (
            <VoiceInterviewRoom
              isSpeaking={isSpeaking}
              isConnecting={status === 'connecting'}
              liveCaption={liveCaption}
              jobRole={context?.roleTitle}
              onEnd={endInterview}
            />
          ) : null}

          {status === 'complete' ? (
            <VoiceInterviewComplete
              jobRole={context?.roleTitle}
              onDone={handleInterviewComplete}
              onBackToPortal={backToPortal}
            />
          ) : null}
        </View>
      ) : null}

      {!blocked && !showResults && status === 'idle' && context ? (
        <Text style={styles.footNote}>Voice only · ~15 minutes · Microphone required · Keep the app open during your interview</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 110 },
  mb: { marginBottom: 18 },
  bannerBtn: { marginTop: 10 },
  footNote: { ...fonts.medium, fontSize: 11, color: colors.gray400, textAlign: 'center', marginTop: 24 },
});

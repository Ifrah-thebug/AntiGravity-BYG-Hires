import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import { env } from '@/core/config/env';
import { fetchVoiceInterviewContext } from '@/features/interview/api/voiceInterviewApi';

/** @typedef {'idle' | 'connecting' | 'in_progress' | 'complete' | 'error'} InterviewStatus */

/** No call-start within this window → show an error instead of "Connecting…" forever. */
const CONNECT_TIMEOUT_MS = 30000;
const MIC_DENIED_MESSAGE =
  'Microphone access was denied. Please allow microphone access in your phone settings and try again.';
const MIC_BLOCKED_MESSAGE =
  'Microphone access is turned off for BYG Hires. Tap "Open settings", allow the microphone, then try again.';

/** @returns {Promise<'granted' | 'denied' | 'blocked'>} */
async function ensureMicPermission() {
  if (Platform.OS !== 'android') return 'granted';
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone access',
    message: 'BYG Hires needs your microphone for the AI voice interview.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  // "Don't ask again": the system dialog will never show again, only Settings can fix it.
  return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
}

/**
 * Same contract as the web `useVapiInterview` hook. Render <VapiBridge ref={bridgeRef} onEvent={handleBridgeEvent} />.
 */
export function useVapiInterview() {
  const [status, setStatus] = useState('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveCaption, setLiveCaption] = useState(null);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);
  const [micBlocked, setMicBlocked] = useState(false);
  const [notice, setNotice] = useState(null);
  const bridgeRef = useRef(null);
  const readyRef = useRef(false);
  const pendingStart = useRef(null);

  const configError = !env.vapiPublicKey
    ? 'VAPI is not configured. Missing VAPI_PUBLIC_KEY.'
    : !env.vapiAssistantId
      ? 'VAPI assistant is not configured. Missing VAPI_ASSISTANT_ID.'
      : null;

  useEffect(() => {
    if (configError) {
      setError(configError);
      setStatus('error');
    }
  }, [configError]);

  const handleBridgeEvent = useCallback((event) => {
    switch (event?.type) {
      case 'ready':
        readyRef.current = true;
        if (pendingStart.current) {
          bridgeRef.current?.send(pendingStart.current);
          pendingStart.current = null;
        }
        break;
      case 'call-start':
        setStatus('in_progress');
        setError(null);
        break;
      case 'call-end':
        setStatus('complete');
        setIsSpeaking(false);
        break;
      case 'speech-start':
        setIsSpeaking(true);
        break;
      case 'speech-end':
        setIsSpeaking(false);
        break;
      case 'transcript':
        if (event.transcript && event.role) {
          setLiveCaption({ role: event.role === 'user' ? 'user' : 'assistant', text: event.transcript });
        }
        break;
      case 'error':
        setError(
          event.code === 'MIC_DENIED' ? MIC_DENIED_MESSAGE : event.message || 'An unexpected error occurred during the interview.'
        );
        setStatus('error');
        setIsSpeaking(false);
        break;
      default:
        break;
    }
  }, []);

  // Layout cleanup runs before the bridge's ref is cleared, so the stop command still reaches it.
  useLayoutEffect(() => () => bridgeRef.current?.send({ type: 'stop' }), []);

  useEffect(() => {
    if (status !== 'connecting') return undefined;
    const timer = setTimeout(() => {
      bridgeRef.current?.send({ type: 'stop' });
      pendingStart.current = null;
      setError('Could not connect to the interview. Check your internet connection and try again.');
      setStatus('error');
    }, CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // The microphone is paused while the app is in the background: tell the talent when they return.
  useEffect(() => {
    if (status !== 'in_progress') return undefined;
    let wentAway = false;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') wentAway = true;
      if (next === 'active' && wentAway) {
        wentAway = false;
        setNotice('You left the app during the interview, so the AI could not hear you. Keep BYG Hires open until you finish.');
      }
    });
    return () => sub.remove();
  }, [status]);

  const loadContext = useCallback(async () => {
    const data = await fetchVoiceInterviewContext();
    setContext(data);
    return data;
  }, []);

  const startInterview = useCallback(async () => {
    if (configError) return;
    setError(null);
    setMicBlocked(false);
    setNotice(null);
    setLiveCaption(null);
    setStatus('connecting');

    try {
      const interviewContext = context || (await loadContext());
      const mic = await ensureMicPermission();
      if (mic !== 'granted') {
        setMicBlocked(mic === 'blocked');
        throw new Error(mic === 'blocked' ? MIC_BLOCKED_MESSAGE : MIC_DENIED_MESSAGE);
      }

      const cmd = {
        type: 'start',
        publicKey: env.vapiPublicKey,
        assistantId: env.vapiAssistantId,
        overrides: {
          variableValues: {
            RoleTitle: interviewContext.roleTitle,
            candidateEmail: interviewContext.candidate_email,
          },
          metadata: {
            talent_id: interviewContext.talent_id,
            candidateEmail: interviewContext.candidate_email,
            RoleTitle: interviewContext.roleTitle,
          },
        },
      };

      if (readyRef.current) bridgeRef.current?.send(cmd);
      else pendingStart.current = cmd;
    } catch (err) {
      setError(err?.code === 'SKILLS_TEST_REQUIRED' ? err.message : err?.message || 'Failed to start the interview.');
      setStatus('error');
    }
  }, [configError, context, loadContext]);

  const endInterview = useCallback(() => {
    bridgeRef.current?.send({ type: 'stop' });
    setStatus('complete');
    setIsSpeaking(false);
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setLiveCaption(null);
    setError(null);
    setMicBlocked(false);
    setNotice(null);
    setIsSpeaking(false);
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  return {
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
  };
}

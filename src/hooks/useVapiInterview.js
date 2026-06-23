import { useCallback, useEffect, useRef, useState } from 'react';
import { getAssistantId, getVapi } from '../lib/vapiClient';
import { fetchVoiceInterviewContext } from '../services/voiceInterviewService';

/** @typedef {'idle' | 'connecting' | 'in_progress' | 'complete' | 'error'} InterviewStatus */
/** @typedef {{ role: 'user' | 'assistant', text: string }} LiveCaption */

function isTranscriptMessage(message) {
  return (
    message?.type === 'transcript' ||
    message?.type === "transcript[transcriptType='final']"
  );
}

export function useVapiInterview() {
  const [status, setStatus] = useState('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveCaption, setLiveCaption] = useState(null);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);
  const vapiRef = useRef(null);

  useEffect(() => {
    try {
      vapiRef.current = getVapi();
    } catch (err) {
      setError(err.message || 'VAPI is not configured.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const vapi = vapiRef.current;
    if (!vapi) return undefined;

    const onCallStart = () => {
      setStatus('in_progress');
      setError(null);
    };

    const onCallEnd = () => {
      setStatus('complete');
      setIsSpeaking(false);
    };

    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);

    const onMessage = (message) => {
      if (!isTranscriptMessage(message) || !message.transcript || !message.role) return;
      const role = message.role === 'user' ? 'user' : 'assistant';
      setLiveCaption({ role, text: message.transcript });
    };

    const onError = (err) => {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred during the interview.';
      setError(message);
      setStatus('error');
      setIsSpeaking(false);
    };

    vapi.on('call-start', onCallStart);
    vapi.on('call-end', onCallEnd);
    vapi.on('speech-start', onSpeechStart);
    vapi.on('speech-end', onSpeechEnd);
    vapi.on('message', onMessage);
    vapi.on('error', onError);

    return () => {
      vapi.removeListener('call-start', onCallStart);
      vapi.removeListener('call-end', onCallEnd);
      vapi.removeListener('speech-start', onSpeechStart);
      vapi.removeListener('speech-end', onSpeechEnd);
      vapi.removeListener('message', onMessage);
      vapi.removeListener('error', onError);
      vapi.stop();
    };
  }, []);

  const loadContext = useCallback(async () => {
    const data = await fetchVoiceInterviewContext();
    setContext(data);
    return data;
  }, []);

  const startInterview = useCallback(async () => {
    const vapi = vapiRef.current;
    if (!vapi) return;

    setError(null);
    setLiveCaption(null);
    setStatus('connecting');

    try {
      const interviewContext = context || (await loadContext());
      await navigator.mediaDevices.getUserMedia({ audio: true });

      await vapi.start(getAssistantId(), {
        variableValues: {
          RoleTitle: interviewContext.roleTitle,
          candidateEmail: interviewContext.candidate_email,
        },
        metadata: {
          talent_id: interviewContext.talent_id,
          candidateEmail: interviewContext.candidate_email,
          RoleTitle: interviewContext.roleTitle,
        },
      });
    } catch (err) {
      let message = 'Failed to start the interview.';
      if (err?.code === 'SKILLS_TEST_REQUIRED') {
        message = err.message;
      } else if (err instanceof DOMException && err.name === 'NotAllowedError') {
        message =
          'Microphone access was denied. Please allow microphone access in your browser settings and try again.';
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      setStatus('error');
    }
  }, [context, loadContext]);

  const endInterview = useCallback(() => {
    vapiRef.current?.stop();
    setStatus('complete');
    setIsSpeaking(false);
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setLiveCaption(null);
    setError(null);
    setIsSpeaking(false);
  }, []);

  return {
    status,
    isSpeaking,
    liveCaption,
    error,
    context,
    loadContext,
    startInterview,
    endInterview,
    reset,
  };
}

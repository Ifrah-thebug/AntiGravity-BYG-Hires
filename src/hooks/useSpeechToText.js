import { useCallback, useEffect, useRef, useState } from 'react';

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Browser Web Speech API — click to start / click to stop.
 * @param {{
 *   lang?: string,
 *   onTranscript?: (payload: { interim: string, finalChunk: string, finalsJoined: string }) => void,
 * }} [options]
 */
export function useSpeechToText(options = {}) {
  const { lang = 'en-US', onTranscript } = options;
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const recognitionRef = useRef(null);
  const finalsRef = useRef([]);
  const intentionalStopRef = useRef(false);

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    const secure = typeof window !== 'undefined' && window.isSecureContext;
    setSupported(Boolean(Ctor) && secure);
  }, []);

  const teardown = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (!rec) return;
    try {
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.stop();
    } catch {
      // already stopped
    }
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const resetError = useCallback(() => setError(''), []);

  const stop = useCallback(() => {
    intentionalStopRef.current = true;
    setListening(false);
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // ignore
    }
  }, []);

  const start = useCallback(() => {
    setError('');
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('Voice input needs a secure connection (HTTPS or localhost).');
      return;
    }

    teardown();
    finalsRef.current = [];
    intentionalStopRef.current = false;

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    recognitionRef.current = rec;

    rec.onstart = () => setListening(true);

    rec.onresult = (event) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript || '';
        if (!text) continue;
        if (result.isFinal) {
          finalChunk += text;
          finalsRef.current.push(text.trim());
        } else {
          interim += text;
        }
      }
      const finalsJoined = finalsRef.current.filter(Boolean).join(' ').trim();
      onTranscriptRef.current?.({
        interim: interim.trim(),
        finalChunk: finalChunk.trim(),
        finalsJoined,
      });
    };

    rec.onerror = (event) => {
      const code = event?.error || 'unknown';
      if (code === 'aborted' || code === 'no-speech') {
        if (code === 'no-speech') {
          setError('No speech detected. Tap the mic and try again.');
        }
        return;
      }
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Microphone access denied. Allow mic permission to use voice input.');
      } else if (code === 'audio-capture') {
        setError('No microphone found. Check your device and try again.');
      } else if (code === 'network') {
        setError('Voice recognition lost connection. Try again.');
      } else {
        setError('Voice input failed. You can keep typing instead.');
      }
    };

    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      // continuous sessions can end on pause; only leave listening false
      if (!intentionalStopRef.current) {
        intentionalStopRef.current = false;
      }
    };

    try {
      rec.start();
    } catch (err) {
      setListening(false);
      recognitionRef.current = null;
      setError(err?.message || 'Could not start voice input.');
    }
  }, [lang, teardown]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return {
    supported,
    listening,
    error,
    start,
    stop,
    toggle,
    resetError,
  };
}

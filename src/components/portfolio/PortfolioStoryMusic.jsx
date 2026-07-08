import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Music } from 'lucide-react';
import { createStorybookSynth } from '../../lib/portfolioStorySynth';

const STORAGE_KEY = 'byg_portfolio_music_enabled';
const DEFAULT_SRC = '/audio/portfolio-story.mp3';
const DEFAULT_VOLUME = 0.32;

function getMusicSrc() {
  const custom = String(import.meta.env.VITE_PORTFOLIO_MUSIC_URL || '').trim();
  return custom || DEFAULT_SRC;
}

function shouldAutoPlay() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export default function PortfolioStoryMusic() {
  const audioRef = useRef(null);
  const synthRef = useRef(null);
  const playingRef = useRef(false);
  const unlockedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [useSynth, setUseSynth] = useState(true);

  useEffect(() => {
    const audio = new Audio(getMusicSrc());
    audio.loop = true;
    audio.volume = DEFAULT_VOLUME;
    audio.preload = 'auto';
    audioRef.current = audio;

    const onCanPlay = () => {
      setUseSynth(false);
      setReady(true);
    };
    const onError = () => {
      setUseSynth(true);
      setReady(true);
    };

    audio.addEventListener('canplaythrough', onCanPlay);
    audio.addEventListener('error', onError);
    audio.load();

    const fallbackTimer = setTimeout(() => {
      setUseSynth(true);
      setReady(true);
    }, 800);

    return () => {
      clearTimeout(fallbackTimer);
      audio.pause();
      audio.removeEventListener('canplaythrough', onCanPlay);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
      synthRef.current?.stop();
      synthRef.current = null;
    };
  }, []);

  const setPlayingState = useCallback((next) => {
    playingRef.current = next;
    setPlaying(next);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    synthRef.current?.stop();
    synthRef.current = null;
    setPlayingState(false);
  }, [setPlayingState]);

  const play = useCallback(async () => {
    try {
      if (useSynth) {
        if (!synthRef.current) synthRef.current = createStorybookSynth();
        synthRef.current.start();
        await synthRef.current.resume();
      } else {
        const audio = audioRef.current;
        if (!audio) return;
        await audio.play();
      }
      setPlayingState(true);
      try {
        localStorage.setItem(STORAGE_KEY, 'on');
      } catch {
        /* ignore */
      }
    } catch {
      setUseSynth(true);
      if (!synthRef.current) synthRef.current = createStorybookSynth();
      synthRef.current.start();
      await synthRef.current.resume();
      setPlayingState(true);
      try {
        localStorage.setItem(STORAGE_KEY, 'on');
      } catch {
        /* ignore */
      }
    }
  }, [useSynth, setPlayingState]);

  const toggle = useCallback(async () => {
    if (playingRef.current) {
      pause();
      try {
        localStorage.setItem(STORAGE_KEY, 'off');
      } catch {
        /* ignore */
      }
    } else {
      unlockedRef.current = true;
      await play();
    }
  }, [pause, play]);

  // Auto-play: try on ready, then unlock on first visitor interaction
  useEffect(() => {
    if (!ready || !shouldAutoPlay()) return undefined;

    const tryPlay = () => {
      if (!shouldAutoPlay() || playingRef.current) return;
      play().catch(() => {});
    };

    tryPlay();

    const unlock = () => {
      if (unlockedRef.current || !shouldAutoPlay()) return;
      unlockedRef.current = true;
      tryPlay();
    };

    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));
    const timer = setTimeout(unlock, 1200);

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => document.removeEventListener(ev, unlock));
    };
  }, [ready, play]);

  if (!ready) return null;

  return (
    <motion.button
      type="button"
      onClick={toggle}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 }}
      className={`fixed bottom-5 md:bottom-8 right-3 md:right-4 z-50 flex items-center gap-1.5 sm:gap-2 pl-2.5 sm:pl-3 pr-2.5 sm:pr-4 py-2 sm:py-2.5 rounded-full shadow-lg border-2 transition-all ${
        playing
          ? 'bg-red border-red text-white shadow-red/25'
          : 'bg-[#fffbf5] border-[#e8dcc8] text-gray-600 hover:border-red/40 hover:text-red'
      }`}
      aria-label={playing ? 'Mute story music' : 'Play story music'}
      title={playing ? 'Mute music' : 'Play music'}
    >
      <span className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8">
        {playing && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-white/40"
            animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <motion.span
          animate={playing ? { rotate: [0, 6, -6, 0] } : { rotate: 0 }}
          transition={playing ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
          <Music size={18} className={playing ? 'text-white' : 'text-red'} />
        </motion.span>
        {!playing && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
            <span className="w-[130%] h-0.5 bg-gray-400/70 rotate-[-35deg] rounded-full" />
          </span>
        )}
      </span>
      <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
        {playing ? 'Playing' : 'Music'}
      </span>
      {playing && (
        <span className="hidden sm:flex items-end gap-0.5 h-4 ml-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-0.5 bg-white/80 rounded-full"
              animate={{ height: ['4px', '14px', '6px', '12px', '4px'] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
            />
          ))}
        </span>
      )}
    </motion.button>
  );
}

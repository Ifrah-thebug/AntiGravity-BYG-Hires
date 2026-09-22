import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, Briefcase, CheckCircle2, MailX, Sparkles } from 'lucide-react';

const ease = [0.22, 1, 0.36, 1];
/** stress → approach → boom → hold */
const LOOP_MS = 14000;

const REJECTIONS = [
  { id: 1, text: 'Thanks, but…', x: -38, y: -28, rot: -12 },
  { id: 2, text: 'Position filled', x: 42, y: -34, rot: 10 },
  { id: 3, text: 'No response', x: -48, y: 22, rot: 8 },
  { id: 4, text: 'Not a fit', x: 46, y: 28, rot: -9 },
];

/** Simple illustrated person — expression changes with mood. */
function Person({ mood = 'stressed' }) {
  const celebrating = mood === 'happy';
  const hopeful = mood === 'hopeful';
  const skin = '#f2c4a0';
  const hair = '#2a211c';
  const shirt = celebrating ? '#059669' : hopeful ? '#111111' : '#4b5563';

  return (
    <motion.div
      className="relative flex flex-col items-center"
      animate={
        celebrating
          ? { y: [0, -10, 0], rotate: [0, -2, 2, 0] }
          : hopeful
            ? { y: [0, -4, 0] }
            : { y: [0, 2, 0], rotate: [0, -1.5, 1.5, 0] }
      }
      transition={{ duration: celebrating ? 0.7 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Arms up when celebrating */}
      {celebrating ? (
        <>
          <motion.div
            className="absolute -left-7 top-10 w-3 h-10 rounded-full origin-bottom"
            style={{ background: skin }}
            animate={{ rotate: [-40, -55, -40] }}
            transition={{ duration: 0.55, repeat: Infinity }}
          />
          <motion.div
            className="absolute -right-7 top-10 w-3 h-10 rounded-full origin-bottom"
            style={{ background: skin }}
            animate={{ rotate: [40, 55, 40] }}
            transition={{ duration: 0.55, repeat: Infinity }}
          />
        </>
      ) : null}

      {/* Head */}
      <div className="relative z-[2]">
        <div className="w-14 h-14 rounded-full relative" style={{ background: skin }}>
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-6 rounded-t-full"
            style={{ background: hair }}
          />
          {/* Eyes */}
          <div className="absolute top-[22px] left-[12px] flex gap-4">
            {celebrating ? (
              <>
                <span className="w-2 h-1.5 border-b-2 border-black rounded-b-full" />
                <span className="w-2 h-1.5 border-b-2 border-black rounded-b-full" />
              </>
            ) : hopeful ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-black" />
                <span className="w-1.5 h-1.5 rounded-full bg-black" />
              </>
            ) : (
              <>
                <span className="w-2 h-0.5 bg-black rotate-12" />
                <span className="w-2 h-0.5 bg-black -rotate-12" />
              </>
            )}
          </div>
          {/* Mouth */}
          <div className="absolute bottom-[12px] left-1/2 -translate-x-1/2">
            {celebrating ? (
              <span className="block w-4 h-2.5 border-b-2 border-black rounded-b-full" />
            ) : hopeful ? (
              <span className="block w-3 h-1.5 border-b-2 border-black rounded-b-full" />
            ) : (
              <span className="block w-3 h-0.5 bg-black rounded-full" />
            )}
          </div>
          {/* Stress sweat */}
          {!celebrating && !hopeful ? (
            <motion.span
              className="absolute -right-1 top-3 w-1.5 h-2.5 rounded-full bg-sky-300/80"
              animate={{ y: [0, 6], opacity: [0.8, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div
        className="mt-0.5 w-16 h-[4.25rem] rounded-t-[1.4rem] relative z-[1]"
        style={{ background: shirt }}
      >
        {celebrating ? (
          <Sparkles className="absolute left-1/2 top-3 -translate-x-1/2 text-white/90" size={16} />
        ) : (
          <Briefcase className="absolute left-1/2 top-3 -translate-x-1/2 text-white/70" size={14} />
        )}
      </div>
    </motion.div>
  );
}

function ConfettiBurst() {
  const bits = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: (i % 2 ? 1 : -1) * (20 + (i * 13) % 90),
    y: -30 - (i * 11) % 70,
    rot: (i * 37) % 360,
    color: ['#ff3d3d', '#059669', '#fbbf24', '#111', '#38bdf8'][i % 5],
    size: 5 + (i % 4),
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="absolute left-1/2 top-[42%] rounded-sm"
          style={{ width: b.size, height: b.size * 1.4, background: b.color }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: b.x,
            y: b.y,
            rotate: b.rot,
            scale: 1,
          }}
          transition={{ duration: 1.35, ease: 'easeOut', delay: (b.id % 6) * 0.04 }}
        />
      ))}
    </div>
  );
}

/**
 * Cinematic hire journey (web-proven 3-act explainer pattern):
 * Stress → approach BYG → JOB LANDED boom.
 */
function HireJourneyStage({ reduce }) {
  const [act, setAct] = useState(0); // 0 stress, 1 approach, 2 boom

  useEffect(() => {
    if (reduce) {
      setAct(2);
      return undefined;
    }
    let timeouts = [];
    const clear = () => {
      timeouts.forEach(clearTimeout);
      timeouts = [];
    };
    const run = () => {
      clear();
      setAct(0);
      timeouts.push(setTimeout(() => setAct(1), 4000));
      timeouts.push(setTimeout(() => setAct(2), 7800));
    };
    run();
    const loop = setInterval(run, LOOP_MS);
    return () => {
      clearInterval(loop);
      clear();
    };
  }, [reduce]);

  const mood = act === 2 ? 'happy' : act === 1 ? 'hopeful' : 'stressed';

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Scene lighting */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background:
            act === 2
              ? 'radial-gradient(circle at 55% 40%, rgba(16,185,129,0.35), transparent 55%), linear-gradient(180deg,#ecfdf5 0%,#ffffff 60%)'
              : act === 1
                ? 'radial-gradient(circle at 70% 45%, rgba(255,61,61,0.18), transparent 50%), linear-gradient(180deg,#fff7f5 0%,#ffffff 70%)'
                : 'radial-gradient(circle at 30% 40%, rgba(0,0,0,0.12), transparent 55%), linear-gradient(180deg,#e8e6e4 0%,#f6f4f2 70%)',
        }}
        transition={{ duration: 0.7 }}
      />

      {/* Floor shadow */}
      <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-48 h-4 rounded-[100%] bg-black/10 blur-md" />

      <AnimatePresence mode="wait">
        {/* ACT 0 — STRESS */}
        {act === 0 ? (
          <motion.div
            key="stress"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -40, filter: 'blur(6px)' }}
            transition={{ duration: 0.45 }}
          >
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red">
                Week 6 of applying
              </span>
              <span className="text-[10px] font-bold text-gray-500 tabular-nums">47 apps · 0 offers</span>
            </div>

            {REJECTIONS.map((r, i) => (
              <motion.div
                key={r.id}
                className="absolute left-[32%] top-[38%] w-[7.5rem]"
                initial={{ opacity: 0, scale: 0.7, x: 0, y: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0.85],
                  x: r.x,
                  y: r.y,
                  rotate: [0, r.rot],
                }}
                transition={{ delay: 0.2 + i * 0.18, duration: 0.55, ease }}
              >
                <div className="rounded-xl bg-white border border-red/30 shadow-lg px-2.5 py-2 flex items-start gap-1.5">
                  <MailX size={12} className="text-red shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-gray-800 leading-tight">{r.text}</p>
                </div>
              </motion.div>
            ))}

            <div className="absolute left-[18%] bottom-[22%]">
              <Person mood="stressed" />
            </div>

            <motion.div
              className="absolute right-[10%] bottom-[26%] w-28 rounded-xl bg-white/90 border border-black/10 shadow-md px-3 py-2"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            >
              <p className="text-[8px] font-black uppercase tracking-wider text-gray-400">Inbox</p>
              <p className="text-[11px] font-extrabold text-red mt-0.5">Still waiting…</p>
            </motion.div>
          </motion.div>
        ) : null}

        {/* ACT 1 — APPROACH BYG */}
        {act === 1 ? (
          <motion.div
            key="approach"
            className="absolute inset-0"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
            transition={{ duration: 0.5, ease }}
          >
            <div className="absolute top-4 left-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red">
                Discovers BYG Hires
              </span>
            </div>

            {/* Glowing BYG portal / door */}
            <motion.div
              className="absolute right-[12%] top-[22%] bottom-[20%] w-[38%] max-w-[13rem] rounded-[1.5rem] border-2 border-red overflow-hidden"
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(255,61,61,0.35)',
                  '0 0 40px 8px rgba(255,61,61,0.35)',
                  '0 0 0 0 rgba(255,61,61,0.35)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red via-[#ff6b6b] to-black" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-3 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] opacity-80">BYG Hires</p>
                <p className="text-lg font-extrabold leading-tight mt-1">Your next role</p>
                <p className="text-[10px] font-semibold opacity-90 mt-1">starts here</p>
              </div>
              <motion.div
                className="absolute inset-y-0 w-12 bg-white/25 skew-x-12"
                animate={{ left: ['-20%', '120%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.4 }}
              />
            </motion.div>

            {/* Person walking toward portal */}
            <motion.div
              className="absolute bottom-[22%]"
              initial={{ left: '14%' }}
              animate={{ left: '42%' }}
              transition={{ duration: 2.8, ease }}
            >
              <Person mood="hopeful" />
            </motion.div>

            <motion.p
              className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] font-bold text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              One application. Real placement.
            </motion.p>
          </motion.div>
        ) : null}

        {/* ACT 2 — JOB LANDED BOOM */}
        {act === 2 ? (
          <motion.div
            key="boom"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            {/* Flash */}
            <motion.div
              className="absolute inset-0 bg-emerald-200/50 z-30 pointer-events-none"
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
            />
            <ConfettiBurst />

            <div className="absolute top-4 left-0 right-0 z-20 flex flex-col items-center gap-2 px-3">
              <motion.div
                initial={{ scale: 0.6, opacity: 0, y: -12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-1.5 shadow-xl shadow-emerald-600/40"
              >
                <CheckCircle2 size={14} />
                <span className="text-[11px] font-black uppercase tracking-[0.18em]">Job landed</span>
              </motion.div>
              <motion.p
                initial={{ scale: 0.7, opacity: 0, y: -6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: 0.35, type: 'spring', stiffness: 320, damping: 18 }}
                className="text-base sm:text-lg font-black text-emerald-800 drop-shadow-sm"
              >
                BOOM. You&apos;re hired!
              </motion.p>
            </div>

            <div className="absolute left-[14%] bottom-[18%] z-10">
              <Person mood="happy" />
            </div>

            {/* Offer letter slam */}
            <motion.div
              className="absolute right-[8%] top-[36%] w-[13.5rem] rounded-2xl bg-white border-2 border-emerald-500 shadow-2xl shadow-emerald-500/25 overflow-hidden z-10"
              initial={{ y: -80, rotate: -8, opacity: 0, scale: 0.85 }}
              animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
            >
              <div className="bg-emerald-600 text-white px-3 py-2 flex items-center gap-2">
                <Briefcase size={13} />
                <span className="text-[10px] font-black uppercase tracking-wider">Offer letter</span>
              </div>
              <div className="px-3 py-3 space-y-2">
                <p className="text-[12px] font-extrabold text-black">Remote Ops Lead</p>
                <p className="text-[10px] font-semibold text-gray-500">via BYG Hires · Full-time</p>
                {[
                  { label: 'Base', value: '$4,200 / mo' },
                  { label: 'Start', value: 'Next Monday' },
                  { label: 'Status', value: 'ACCEPTED ✓' },
                ].map((row, i) => (
                  <motion.div
                    key={row.label}
                    className="flex items-center justify-between text-[11px] border-t border-gray-100 pt-1.5"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.12 }}
                  >
                    <span className="font-semibold text-gray-500">{row.label}</span>
                    <span className="font-extrabold text-emerald-700">{row.value}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Act progress dots */}
      <div className="absolute bottom-3 right-3 z-20 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              act === i ? 'w-5 bg-red' : act > i ? 'w-1.5 bg-emerald-500' : 'w-1.5 bg-black/15'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function HeroProblemSolve({ plate = false }) {
  const reduce = useReducedMotion();

  return (
    <div className={`relative w-full flex flex-col ${plate ? 'h-full min-h-0' : ''}`}>
      <div className="shrink-0 max-w-xl mb-3">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-black uppercase tracking-[0.22em] text-red mb-1.5"
        >
          From stressed → hired
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="text-3xl sm:text-4xl lg:text-[2.45rem] font-extrabold text-black tracking-tight leading-[1.06]"
        >
          Your first hire
          <br />
          shouldn&apos;t be your <span className="text-red">biggest risk.</span>
        </motion.h1>
      </div>

      <div
        className={`relative rounded-[1.35rem] border border-black/10 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${
          plate ? 'flex-1 min-h-[18rem]' : 'h-[22rem] mb-4'
        }`}
      >
        <HireJourneyStage reduce={!!reduce} />
      </div>

      <div
        className={`shrink-0 pt-4 mt-auto flex flex-col sm:flex-row sm:items-center gap-3 ${
          plate ? 'border-t border-black/8 sm:justify-end' : ''
        }`}
      >
        <Link
          to="/talent/signup"
          className="order-2 sm:order-1 text-sm font-bold text-gray-600 hover:text-red underline-offset-4 hover:underline px-1 sm:mr-auto"
        >
          Or join the talent pool →
        </Link>
        <motion.div
          className="order-1 sm:order-2 relative"
          animate={reduce ? {} : { y: [0, -3, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {!reduce ? (
            <motion.span
              className="pointer-events-none absolute -inset-1 rounded-full bg-red/35 blur-md"
              animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.98, 1.05, 0.98] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : null}
          <Link
            to="/talent"
            className="relative group inline-flex items-center justify-center gap-2 px-8 py-4 bg-red text-white rounded-full font-bold text-base sm:text-lg shadow-xl shadow-red/30 border-2 border-red hover:bg-black hover:border-black transition-colors"
          >
            Find a Great Hire
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

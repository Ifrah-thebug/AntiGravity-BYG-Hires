import React from 'react';
import { motion } from 'framer-motion';

const CYCLE = 2.6;

/** Talent figure — puzzled, waiting on AI. */
function PuzzledTalentFigure({ className = '' }) {
  return (
    <svg
      viewBox="0 0 88 116"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M8 116V78C8 70 22 64 44 64C66 64 80 70 80 78V116H8Z" fill="#0a0a0a" />
      <path d="M26 78L44 90L62 78V116H26V78Z" fill="#111" />
      <path d="M34 78H54V98H34V78Z" fill="#fff" />
      <path d="M32 78L44 86L56 78" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M41 78L44 104L47 78H41Z" fill="#dc2626" />
      <rect x="38" y="60" width="12" height="20" rx="3" fill="#e8c4a8" />
      <ellipse cx="44" cy="44" rx="19" ry="21" fill="#e8c4a8" />
      <path
        d="M24 46C24 24 32 16 44 16C56 16 64 24 64 46C64 36 56 30 44 30C32 30 24 36 24 46Z"
        fill="#0a0a0a"
      />
      {/* Worried brows */}
      <path d="M30 36L38 38" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 38L58 36" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      {/* Eyes looking up at AI bubble */}
      <ellipse cx="36" cy="44" rx="2.5" ry="3" fill="#111" />
      <ellipse cx="52" cy="44" rx="2.5" ry="3" fill="#111" />
      <circle cx="37" cy="43" r="0.8" fill="#fff" />
      <circle cx="53" cy="43" r="0.8" fill="#fff" />
      {/* Wavy uncertain mouth */}
      <path
        d="M34 54Q40 50 44 54T54 54"
        stroke="#111"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Hand on chin */}
      <ellipse cx="58" cy="58" rx="7" ry="6" fill="#e8c4a8" stroke="#d4a574" strokeWidth="1" />
      <path d="M52 52C54 48 58 46 62 48" stroke="#d4a574" strokeWidth="1.5" strokeLinecap="round" />
      {/* Tiny sweat — cute stress */}
      <motion.ellipse
        cx="66"
        cy="32"
        rx="2"
        ry="3"
        fill="#93c5fd"
        opacity="0.85"
        animate={{ y: [0, 4, 0], opacity: [0.85, 0.2, 0.85] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 ml-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-red"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.18,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
}

/**
 * Loader while Gemini generates skills-test questions.
 */
export default function AssessmentGeneratingLoader({
  className = '',
  skill = '',
  elapsedSeconds = 0,
  statusLine = '',
}) {
  const patienceHint =
    elapsedSeconds >= 45
      ? 'Thanks for waiting — this can take up to a minute when demand is high.'
      : elapsedSeconds >= 20
        ? 'Still crafting your questions… almost there.'
        : 'Usually 15–30 seconds. Please keep this tab open.';

  return (
    <div
      className={`w-full max-w-md mx-auto ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Generating your skills test questions"
    >
      <div className="relative w-[300px] h-[200px] mx-auto mb-2">
        {/* AI response bubble */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 top-0 z-20"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: CYCLE, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="relative bg-black text-white px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-lg border border-gray-800 min-w-[148px]">
            <p className="text-[9px] font-black uppercase tracking-widest text-red mb-0.5">AI thinking</p>
            <p className="text-[11px] font-bold text-gray-200 flex items-center">
              Generating
              <TypingDots />
            </p>
            <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-black border-r border-b border-gray-800 rotate-45" />
          </div>
        </motion.div>

        {/* Signal waves toward bubble */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-[52px] w-16 h-8 border-2 border-red/30 rounded-full -translate-x-1/2"
            style={{ marginLeft: -8 }}
            animate={{ scale: [0.6, 1.15, 0.6], opacity: [0.5, 0, 0.5] }}
            transition={{
              duration: CYCLE,
              repeat: Infinity,
              delay: i * 0.35,
              ease: 'easeOut',
            }}
          />
        ))}

        {/* Puzzled person */}
        <motion.div
          className="absolute left-1/2 bottom-0 -translate-x-1/2 z-10"
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: CYCLE * 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <PuzzledTalentFigure className="w-[5.5rem] h-[7.25rem] drop-shadow-lg" />
        </motion.div>

        {/* Waiting clock */}
        <motion.div
          className="absolute right-2 bottom-8 w-9 h-9 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center text-[10px] font-black text-gray-500"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          {elapsedSeconds > 0 ? `${elapsedSeconds}s` : '…'}
        </motion.div>
      </div>

      <div className="space-y-3 text-center px-2">
        {skill && (
          <p className="text-red font-bold tracking-[0.15em] uppercase text-xs">{skill}</p>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-left">
          <p className="text-sm font-bold text-amber-900 leading-snug">
            Our AI model is experiencing high demand right now — sorry for the delay!
          </p>
        </div>

        {statusLine && (
          <motion.p
            key={statusLine}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-base md:text-lg font-extrabold text-black tracking-tight leading-snug"
          >
            {statusLine}
          </motion.p>
        )}

        <p className="text-sm text-gray-500 font-medium">{patienceHint}</p>
      </div>
    </div>
  );
}

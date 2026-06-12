import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Star } from 'lucide-react';

const CYCLE = 2.8;

/** Professional bust for studio-photo creation state. */
function StudioTalentFigure({ className = '' }) {
  return (
    <svg
      viewBox="0 0 80 108"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M4 108V72C4 64 18 58 40 58C62 58 76 64 76 72V108H4Z" fill="#0a0a0a" />
      <path d="M22 72L40 84L58 72V108H22V72Z" fill="#111" />
      <path d="M30 72H50V92H30V72Z" fill="#fff" />
      <path d="M28 72L40 80L52 72" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M37 72L40 98L43 72H37Z" fill="#dc2626" />
      <rect x="34" y="54" width="12" height="20" rx="3" fill="#e8c4a8" />
      <ellipse cx="40" cy="38" rx="19" ry="21" fill="#e8c4a8" />
      <path
        d="M20 40C20 18 28 10 40 10C52 10 60 18 60 40C60 30 52 24 40 24C28 24 20 30 20 40Z"
        fill="#0a0a0a"
      />
      <ellipse cx="32" cy="40" rx="2.5" ry="3" fill="#111" />
      <ellipse cx="48" cy="40" rx="2.5" ry="3" fill="#111" />
      <circle cx="33" cy="39" r="0.8" fill="#fff" />
      <circle cx="49" cy="39" r="0.8" fill="#fff" />
      <path d="M31 48Q40 54 49 48" stroke="#111" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const SPARKLE_SPOTS = [
  { x: -48, y: -32, delay: 0, Icon: Sparkles, size: 13 },
  { x: 50, y: -38, delay: 0.35, Icon: Star, size: 11 },
  { x: -40, y: 24, delay: 0.7, Icon: Star, size: 9 },
  { x: 46, y: 18, delay: 1.05, Icon: Sparkles, size: 14 },
  { x: 0, y: -48, delay: 0.5, Icon: Sparkles, size: 10 },
];

/**
 * Cute loader while professional profile photo is being created.
 */
export default function ProfilePhotoGeneratingLoader({
  className = '',
  message = 'Creating professional studio photo…',
  hint = 'Usually takes 15–40 seconds',
}) {
  return (
    <div
      className={`w-full ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="min-h-[180px] border border-gray-200 bg-gray-50 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-4">
        <div className="relative w-[120px] h-[110px] flex items-center justify-center">
          <motion.div
            className="absolute inset-1 rounded-full bg-red/5 border border-red/10"
            animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.85, 0.45] }}
            transition={{ duration: CYCLE, repeat: Infinity, ease: 'easeInOut' }}
          />

          {SPARKLE_SPOTS.map(({ x, y, delay, Icon, size }, i) => (
            <motion.div
              key={i}
              className="absolute text-red pointer-events-none"
              style={{ left: '50%', top: '50%', marginLeft: x, marginTop: y }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.4, 1.12, 1, 0.5],
                y: [0, -5, -2, 0],
                rotate: [0, 10, -6, 0],
              }}
              transition={{
                duration: CYCLE,
                repeat: Infinity,
                delay,
                ease: 'easeInOut',
              }}
            >
              <Icon size={size} className="fill-red/20" strokeWidth={2.25} />
            </motion.div>
          ))}

          <motion.div
            className="relative z-10 flex flex-col items-center"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: CYCLE, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.span
              className="text-xl leading-none mb-0.5 select-none"
              animate={{ scale: [1, 1.15, 1], opacity: [0.65, 1, 0.65] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: 0.15 }}
              aria-hidden
            >
              ✨
            </motion.span>
            <StudioTalentFigure className="w-[4.5rem] h-[6rem] drop-shadow-md" />
          </motion.div>
        </div>

        <div className="space-y-1.5">
          <motion.p
            key={message}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-black text-xs text-gray-700 uppercase tracking-wider leading-snug"
          >
            {message}
          </motion.p>
          <p className="text-[10px] text-gray-500 font-medium">{hint}</p>
        </div>
      </div>
    </div>
  );
}

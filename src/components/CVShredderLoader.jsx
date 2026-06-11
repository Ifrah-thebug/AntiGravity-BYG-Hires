import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const CYCLE = 3.4;

/** Professional bust — head, blazer, collar (BYG black / red / white). */
function TalentPersonFigure({ className = '' }) {
  return (
    <svg
      viewBox="0 0 80 108"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Blazer shoulders */}
      <path
        d="M4 108V72C4 64 18 58 40 58C62 58 76 64 76 72V108H4Z"
        fill="#0a0a0a"
        stroke="#0a0a0a"
        strokeWidth="1"
      />
      {/* Lapels */}
      <path d="M22 72L40 84L58 72V108H22V72Z" fill="#111" />
      {/* Shirt + collar */}
      <path d="M30 72H50V92H30V72Z" fill="#fff" />
      <path d="M28 72L40 80L52 72" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      {/* Tie */}
      <path d="M37 72L40 98L43 72H37Z" fill="#dc2626" />
      <path d="M36 72H44V76H36V72Z" fill="#b91c1c" />
      {/* Neck */}
      <rect x="34" y="54" width="12" height="20" rx="3" fill="#e8c4a8" />
      {/* Face */}
      <ellipse cx="40" cy="38" rx="19" ry="21" fill="#e8c4a8" />
      {/* Hair */}
      <path
        d="M20 40C20 18 28 10 40 10C52 10 60 18 60 40C60 30 52 24 40 24C28 24 20 30 20 40Z"
        fill="#0a0a0a"
      />
      <path d="M20 36C22 28 30 22 40 22C50 22 58 28 60 36" stroke="#0a0a0a" strokeWidth="3" />
      {/* Eyes */}
      <ellipse cx="32" cy="40" rx="2.5" ry="3" fill="#111" />
      <ellipse cx="48" cy="40" rx="2.5" ry="3" fill="#111" />
      <circle cx="33" cy="39" r="0.8" fill="#fff" />
      <circle cx="49" cy="39" r="0.8" fill="#fff" />
      {/* Brows */}
      <path d="M28 34L36 35" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M44 35L52 34" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
      {/* Friendly smile */}
      <path
        d="M31 48Q40 54 49 48"
        stroke="#111"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Verified badge on blazer */}
      <circle cx="58" cy="88" r="9" fill="#dc2626" stroke="#fff" strokeWidth="2" />
      <path
        d="M54 88L57 91L63 85"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Resume → shredder → detailed talent figure loop for CV parsing states.
 */
export default function CVShredderLoader({ className = '', label = 'Parsing your CV' }) {
  return (
    <div
      className={`relative w-[340px] h-[190px] mx-auto ${className}`}
      role="status"
      aria-label={label}
    >
      {/* Shredder */}
      <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 z-20">
        <div className="relative w-[96px] h-[80px] bg-black rounded-2xl border-2 border-red shadow-xl flex flex-col items-center pt-2 overflow-visible">
          <div className="w-[74px] h-2 bg-red rounded-full mb-2" />
          <div className="flex gap-[3px] px-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-[3px] h-4 bg-gray-500 rounded-sm origin-bottom"
                animate={{ scaleY: [1, 0.6, 1] }}
                transition={{
                  duration: 0.35,
                  repeat: Infinity,
                  delay: i * 0.04,
                  repeatDelay: CYCLE - 0.35,
                }}
              />
            ))}
          </div>
          <div className="w-[76px] h-2.5 bg-gray-900 rounded-b-xl mt-auto border-t border-gray-700" />
        </div>
        {/* Input slot */}
        <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-4 h-11 bg-gray-800 rounded-l-md border-2 border-r-0 border-red" />
        {/* Output slot — person emerges here */}
        <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-5 h-14 bg-gray-900 rounded-r-md border-2 border-l-0 border-red overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-gray-900 to-transparent"
            animate={{ opacity: [0.8, 0.4, 0.8] }}
            transition={{ duration: CYCLE, repeat: Infinity }}
          />
        </div>
      </div>

      {/* Resume feeds in */}
      <motion.div
        className="absolute top-[52%] -translate-y-1/2 left-2 z-10"
        animate={{
          x: [0, 112, 125],
          opacity: [1, 0.45, 0],
          rotate: [0, -3, -8],
        }}
        transition={{
          duration: CYCLE,
          repeat: Infinity,
          ease: 'easeInOut',
          times: [0, 0.5, 0.66],
          repeatDelay: 0.4,
        }}
      >
        <div className="w-[3.5rem] h-[4.75rem] bg-white border-2 border-black rounded-md shadow-lg p-2 flex flex-col gap-1.5">
          <div className="h-2 w-10 bg-red rounded-sm" />
          <div className="h-0.5 w-full bg-gray-300 rounded-full" />
          <div className="h-0.5 w-full bg-gray-300 rounded-full" />
          <div className="h-0.5 w-4/5 bg-gray-300 rounded-full" />
          <div className="h-0.5 w-full bg-gray-300 rounded-full" />
          <div className="h-0.5 w-2/3 bg-gray-300 rounded-full" />
          <div className="h-0.5 w-full bg-gray-200 rounded-full" />
        </div>
      </motion.div>

      {/* Shred strips */}
      {[-14, -5, 4, 13].map((offset, i) => (
        <motion.div
          key={offset}
          className="absolute z-30 w-[3px] h-5 bg-gray-400 rounded-sm"
          style={{ left: `calc(50% + ${offset}px)`, top: '62%' }}
          animate={{
            y: [0, 32, 58],
            opacity: [0, 0.85, 0],
            rotate: [0, (i - 1.5) * 10, (i - 1.5) * 16],
          }}
          transition={{
            duration: CYCLE,
            repeat: Infinity,
            ease: 'easeIn',
            times: [0.44, 0.6, 0.76],
            delay: i * 0.05,
            repeatDelay: 0.4,
          }}
        />
      ))}

      {/* Detailed person slides out of shredder */}
      <motion.div
        className="absolute top-[52%] z-10"
        style={{ left: 'calc(50% + 38px)' }}
        animate={{
          x: [-8, 42, 58],
          y: ['-50%', '-50%', '-50%'],
          opacity: [0, 0.85, 1],
          scale: [0.72, 0.92, 1],
        }}
        transition={{
          duration: CYCLE,
          repeat: Infinity,
          ease: [0.22, 1, 0.36, 1],
          times: [0.48, 0.72, 0.88],
          repeatDelay: 0.4,
        }}
      >
        <div className="relative -translate-y-1/2">
          <TalentPersonFigure className="w-[5.5rem] h-[7.5rem] drop-shadow-xl" />
          <motion.div
            className="absolute -top-1 right-0 text-red"
            animate={{ opacity: [0, 0, 1, 0.6, 0], scale: [0.5, 0.5, 1.15, 1, 0.8] }}
            transition={{
              duration: CYCLE,
              repeat: Infinity,
              times: [0, 0.68, 0.78, 0.88, 1],
              repeatDelay: 0.4,
            }}
          >
            <Sparkles size={16} fill="currentColor" />
          </motion.div>
        </div>
      </motion.div>

      {/* Speed lines as CV transforms */}
      <motion.div
        className="absolute left-[44%] top-[40%] flex gap-1.5"
        animate={{ opacity: [0, 0.7, 0], x: [0, 6, 12] }}
        transition={{ duration: CYCLE, repeat: Infinity, times: [0.32, 0.48, 0.62], repeatDelay: 0.4 }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-4 h-0.5 bg-red rounded-full" />
        ))}
      </motion.div>
    </div>
  );
}

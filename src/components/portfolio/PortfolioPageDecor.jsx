import React from 'react';
import { motion } from 'framer-motion';

/** Ambient storybook flourishes — fixed, non-interactive */
export default function PortfolioPageDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden" aria-hidden>
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 55% at 50% 45%, transparent 40%, rgba(0,0,0,0.06) 100%)',
        }}
      />

          {/* Floating ink curls — fewer / lighter on mobile */}
          {[
            { top: '12%', left: '4%', delay: 0, rotate: -12, hideMobile: false },
            { top: '38%', right: '3%', delay: 0.4, rotate: 18, hideMobile: true },
            { top: '68%', left: '6%', delay: 0.8, rotate: 8, hideMobile: true },
            { top: '82%', right: '8%', delay: 1.2, rotate: -20, hideMobile: false },
          ].map((pos, i) => (
            <motion.svg
              key={i}
              viewBox="0 0 60 60"
              className={`absolute w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-red/10 ${pos.hideMobile ? 'hidden sm:block' : ''}`}
              style={{ top: pos.top, left: pos.left, right: pos.right }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, rotate: pos.rotate }}
              transition={{ delay: pos.delay, duration: 1.2 }}
            >
              <path
                d="M30 4C18 12 10 24 8 38C16 32 24 26 32 22C28 16 24 10 30 4Z"
                fill="currentColor"
              />
            </motion.svg>
          ))}

      {/* Paper flecks */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-[#c4a882]/40"
          style={{
            top: `${15 + i * 14}%`,
            left: `${8 + (i % 3) * 28}%`,
          }}
          animate={{ y: [0, -8, 0], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 4 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}

      {/* Book spine hint — center gutter */}
      <div
        className="hidden lg:block absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.04) 20%, rgba(0,0,0,0.06) 50%, rgba(0,0,0,0.04) 80%, transparent)',
        }}
      />
    </div>
  );
}

import React from 'react';

/** Ornamental storybook curl — corner flourish */
export function StorybookCorner({ className = '', flip = false }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={`absolute w-16 h-16 md:w-20 md:h-20 pointer-events-none text-red/25 ${flip ? 'scale-x-[-1]' : ''} ${className}`}
      fill="none"
      aria-hidden
    >
      <path
        d="M4 4C20 8 36 24 40 44C44 24 60 8 76 4C68 20 52 36 40 52C28 36 12 20 4 4Z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M8 8C22 12 34 26 38 42M38 42C34 58 22 72 8 76M38 42C54 38 68 26 72 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Horizontal curl divider between story sections */
export function StorybookDivider({ className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-2 sm:gap-4 py-2 sm:py-3 md:py-4 px-2 ${className}`} aria-hidden>
      <div className="h-px w-8 sm:w-16 md:w-24 bg-gradient-to-r from-transparent to-red/25" />
      <svg viewBox="0 0 120 24" className="w-14 sm:w-20 md:w-28 h-5 sm:h-6 text-red/50" fill="none">
        <path
          d="M0 12C20 4 40 20 60 12C80 4 100 20 120 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="60" cy="12" r="3.5" fill="currentColor" />
      </svg>
      <svg viewBox="0 0 48 48" className="w-7 h-7 sm:w-9 sm:h-9 text-red/35" fill="currentColor">
        <path d="M24 6C14 14 10 24 6 34C14 30 22 26 30 22C26 18 22 14 24 6Z" opacity="0.7" />
        <path d="M24 42C34 34 38 24 42 14C34 18 26 22 18 26C22 30 26 34 24 42Z" opacity="0.5" />
        <circle cx="24" cy="24" r="2" className="text-red" fill="currentColor" />
      </svg>
      <svg viewBox="0 0 120 24" className="w-14 sm:w-20 md:w-28 h-5 sm:h-6 text-red/50 scale-x-[-1]" fill="none">
        <path
          d="M0 12C20 4 40 20 60 12C80 4 100 20 120 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="60" cy="12" r="3.5" fill="currentColor" />
      </svg>
      <div className="h-px w-8 sm:w-16 md:w-24 bg-gradient-to-l from-transparent to-red/25" />
    </div>
  );
}

/** Bottom-right page curl fold */
export function StorybookPageCurl({ className = '' }) {
  return (
    <div className={`absolute bottom-0 right-0 w-20 h-20 md:w-28 md:h-28 pointer-events-none overflow-hidden ${className}`} aria-hidden>
      <div
        className="absolute bottom-0 right-0 w-full h-full"
        style={{
          background: 'linear-gradient(135deg, transparent 45%, #e8dcc8 46%, #fffbf5 55%, #f5ebe0 100%)',
          boxShadow: '-4px -4px 12px rgba(0,0,0,0.08)',
        }}
      />
      <svg viewBox="0 0 80 80" className="absolute bottom-1 right-1 w-14 h-14 text-red/20" fill="none">
        <path d="M60 80 Q80 60 80 40 Q80 20 60 0" stroke="currentColor" strokeWidth="1" />
        <path d="M50 80 Q70 55 75 35" stroke="currentColor" strokeWidth="0.75" opacity="0.6" />
      </svg>
    </div>
  );
}

/** Open book spine shadow between spreads */
export function StorybookSpine({ className = '' }) {
  return (
    <div
      className={`hidden lg:block absolute left-1/2 top-0 bottom-0 w-8 -translate-x-1/2 pointer-events-none ${className}`}
      aria-hidden
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.06) 45%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.06) 55%, transparent)',
      }}
    />
  );
}

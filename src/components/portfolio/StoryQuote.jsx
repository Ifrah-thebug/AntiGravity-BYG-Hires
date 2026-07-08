import React from 'react';
import { motion } from 'framer-motion';

export default function StoryQuote({ text, attribution, size = 'md', className = '' }) {
  if (!text) return null;

  const sizeClass = size === 'lg'
    ? 'text-lg sm:text-xl md:text-2xl lg:text-3xl'
    : 'text-sm sm:text-base md:text-lg';

  return (
    <motion.blockquote
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.15 }}
      className={`relative my-4 md:my-5 ${className}`}
    >
      {/* Curl quote marks */}
      <svg
        viewBox="0 0 48 36"
        className="absolute -top-2 -left-1 w-10 h-8 text-red/30"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 28C4 22 4 14 8 8C12 14 12 20 8 28ZM28 28C24 22 24 14 28 8C32 14 32 20 28 28Z" />
      </svg>

      <div className="relative pl-6 sm:pl-8 pr-3 sm:pr-5 py-4 sm:py-5 md:py-6 border-l-[3px] sm:border-l-[4px] border-red/70 bg-gradient-to-r from-red/[0.06] via-red/[0.02] to-transparent rounded-r-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <p className={`${sizeClass} font-medium italic text-gray-800 leading-relaxed tracking-tight`}>
          &ldquo;{text}&rdquo;
        </p>
        {attribution && (
          <footer className="mt-4 flex items-center gap-2">
            <span className="h-px flex-1 max-w-[2rem] bg-red/30" />
            <cite className="not-italic text-[10px] font-black text-red uppercase tracking-[0.2em]">
              {attribution}
            </cite>
          </footer>
        )}
      </div>

      <svg
        viewBox="0 0 48 36"
        className="absolute -bottom-1 right-2 w-8 h-6 text-red/20 rotate-180"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 28C4 22 4 14 8 8C12 14 12 20 8 28ZM28 28C24 22 24 14 28 8C32 14 32 20 28 28Z" />
      </svg>
    </motion.blockquote>
  );
}

/** Build narrative quotes from profile + projects */
export function buildPortfolioStoryQuotes({ profile, firstName, displayName, projects, departmentLabel }) {
  const quotes = [];

  if (profile?.about) {
    const trimmed = profile.about.trim();
    const firstSentence = trimmed.match(/^[^.!?]+[.!?]?/)?.[0]?.trim();
    if (firstSentence && firstSentence.length > 15 && firstSentence.length < 200) {
      quotes.push({ text: firstSentence.replace(/^["']|["']$/g, ''), attribution: displayName });
    } else if (trimmed.length <= 180) {
      quotes.push({ text: trimmed, attribution: displayName });
    }
  }

  if (profile?.best_skill) {
    quotes.push({
      text: `My craft lives in ${profile.best_skill} — where precision meets creativity.`,
      attribution: firstName,
    });
  }

  if (profile?.job_title) {
    quotes.push({
      text: `I show up as a ${profile.job_title.toLowerCase()} who delivers work that speaks for itself.`,
      attribution: firstName,
    });
  }

  if (departmentLabel) {
    quotes.push({
      text: `Remote talent, real impact — building from the ${departmentLabel} lane.`,
      attribution: 'BYG Hires',
    });
  }

  if (profile?.experience_years > 0) {
    quotes.push({
      text: `${profile.experience_years} year${profile.experience_years === 1 ? '' : 's'} of learning, shipping, and getting better every chapter.`,
      attribution: firstName,
    });
  }

  projects.slice(0, 3).forEach((p) => {
    if (p.description) {
      const excerpt = p.description.length > 140 ? `${p.description.slice(0, 137)}…` : p.description;
      quotes.push({ text: excerpt, attribution: p.title });
    }
  });

  quotes.push({
    text: 'One link. Your whole story. Share your portfolio instead of another LinkedIn scroll.',
    attribution: 'BYG Hires',
  });

  return quotes;
}

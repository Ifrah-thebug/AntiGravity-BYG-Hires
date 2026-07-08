import React from 'react';
import { motion } from 'framer-motion';
import { StorybookCorner, StorybookPageCurl } from './StorybookOrnament';

const pageVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function StorybookSpread({
  chapter,
  chapterLabel,
  title,
  subtitle,
  children,
  className = '',
  id,
  variant = 'left',
}) {
  const isRight = variant === 'right';

  return (
    <motion.section
      id={id}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={pageVariants}
      className={`scroll-mt-24 sm:scroll-mt-28 ${className}`}
    >
      <div className="relative max-w-5xl mx-auto w-full px-3 sm:px-6">
        <div className="relative bg-[#fffbf5] border border-[#e8dcc8] shadow-[0_16px_56px_-18px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.95),inset_6px_0_16px_rgba(0,0,0,0.025)] rounded-sm overflow-hidden">
          {/* Chapter ribbon */}
          {chapter && (
            <div className="h-1.5 sm:h-2 bg-gradient-to-r from-red/20 via-red to-red/20 relative">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)]" />
            </div>
          )}
          {/* Inner book frame — hide nested borders on small screens */}
          <div className="absolute inset-2 sm:inset-3 md:inset-5 border border-[#e8dcc8]/70 rounded-sm pointer-events-none z-[1] hidden sm:block" />
          <div className="absolute inset-3 sm:inset-4 md:inset-6 border border-[#f5ebe0]/80 rounded-sm pointer-events-none z-[1] hidden md:block" />
          {/* Paper texture */}
          <div
            className="absolute inset-0 opacity-[0.45] pointer-events-none mix-blend-multiply"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
            }}
          />
          {/* Subtle ruled lines */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 27px, #8b7355 27px, #8b7355 28px)',
              backgroundPosition: '0 80px',
            }}
          />

          <StorybookCorner className={`top-2 ${isRight ? 'right-2' : 'left-2'} hidden sm:block`} flip={isRight} />
          <StorybookCorner className={`bottom-2 ${isRight ? 'left-2' : 'right-2'} rotate-180 hidden sm:block`} flip={!isRight} />

          <div className="relative z-10 px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10 pb-10 sm:pb-12 md:pb-14">
            {chapter && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4"
              >
                <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black text-white flex items-center justify-center font-black text-xs sm:text-sm shrink-0 shadow-md ring-2 ring-red/20 ring-offset-2 ring-offset-[#fffbf5]">
                  {chapter}
                </span>
                <span className="text-[9px] sm:text-[10px] font-black text-red uppercase tracking-[0.2em] sm:tracking-[0.3em]">
                  {chapterLabel}
                </span>
              </motion.p>
            )}

            {title && (
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-[2.35rem] font-black text-black tracking-tight leading-[1.15] mb-2 sm:mb-3 break-words">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-gray-500 font-medium text-sm md:text-base mb-4 sm:mb-6 leading-relaxed max-w-2xl">{subtitle}</p>
            )}

            {children}
          </div>

          <StorybookPageCurl />
        </div>

        {/* Page number */}
        {chapter && (
          <p className={`text-[10px] font-black text-gray-400 mt-3 ${isRight ? 'text-right' : 'text-left'}`}>
            — {chapter} —
          </p>
        )}
      </div>
    </motion.section>
  );
}

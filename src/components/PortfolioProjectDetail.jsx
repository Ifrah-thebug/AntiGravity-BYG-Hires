import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight, BookOpen } from 'lucide-react';
import { normalizeProjectUrl } from '../lib/talentPortfolio';

export default function PortfolioProjectDetail({ project, onClose }) {
  useEffect(() => {
    if (!project) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [project, onClose]);

  const link = normalizeProjectUrl(project?.project_url);
  const displayUrl = link ? link.replace(/^https?:\/\//, '') : '';

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Close project"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="portfolio-project-title"
            className="relative w-full sm:max-w-2xl lg:max-w-3xl max-h-[min(92vh,820px)] min-h-0 bg-[#fffbf5] border border-[#e8dcc8] rounded-t-[1.75rem] sm:rounded-[2rem] overflow-hidden shadow-[0_24px_80px_-20px_rgba(0,0,0,0.45)] flex flex-col"
            initial={{ y: '100%', scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: '100%', scale: 0.98 }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
          >
            {/* Storybook ribbon */}
            <div className="h-1.5 bg-gradient-to-r from-red/30 via-red to-red/30 shrink-0 relative">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-30 w-10 h-10 rounded-xl bg-black/85 hover:bg-red text-white flex items-center justify-center transition-colors shadow-lg"
              aria-label="Close chapter"
            >
              <X size={17} />
            </button>

            {/* Scrollable body — min-h-0 prevents flex children from clipping content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {project.cover_image_url ? (
                <div className="relative h-48 sm:h-56 md:h-64 bg-black overflow-hidden shrink-0">
                  <motion.img
                    src={project.cover_image_url}
                    alt=""
                    className="w-full h-full object-cover"
                    initial={{ scale: 1.08 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 pr-16">
                    <p className="text-[9px] font-black text-red uppercase tracking-[0.25em] mb-1.5 flex items-center gap-1.5">
                      <BookOpen size={10} /> A chapter in the work
                    </p>
                    <h2 id="portfolio-project-title" className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                      {project.title}
                    </h2>
                  </div>
                </div>
              ) : (
                <div className="relative pt-14 pb-6 px-5 sm:px-6 pr-16 bg-black overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-56 h-56 bg-red rounded-full blur-[100px] opacity-25 -mr-16 -mt-16" />
                  <p className="text-[9px] font-black text-red uppercase tracking-[0.25em] mb-1.5 flex items-center gap-1.5 relative z-10">
                    <BookOpen size={10} /> A chapter in the work
                  </p>
                  <h2 id="portfolio-project-title" className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight relative z-10 leading-tight">
                    {project.title}
                  </h2>
                </div>
              )}

              <div className="px-5 sm:px-6 md:px-8 py-5 sm:py-6 space-y-4 sm:space-y-5">
                {project.tags?.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className="flex flex-wrap gap-1.5"
                  >
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 bg-black/5 text-gray-600 font-bold text-[9px] uppercase tracking-wider rounded-md border border-[#e8dcc8]"
                      >
                        {tag}
                      </span>
                    ))}
                  </motion.div>
                )}

                {project.description ? (
                  <motion.blockquote
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className="text-gray-600 text-sm sm:text-base font-medium leading-relaxed italic border-l-2 border-red/30 pl-4"
                  >
                    &ldquo;{project.description}&rdquo;
                  </motion.blockquote>
                ) : (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className="text-sm text-gray-400 font-medium italic"
                  >
                    No description added for this chapter yet.
                  </motion.p>
                )}
              </div>
            </div>

            {/* Single action footer — no duplicate CTAs */}
            {link && (
              <div className="shrink-0 border-t border-[#e8dcc8] bg-white/80 backdrop-blur-sm p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate sm:flex-1 min-w-0">
                    {displayUrl}
                  </p>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-black hover:bg-red text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors shrink-0 w-full sm:w-auto"
                  >
                    View live work
                    <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
            )}

            {!link && (
              <div className="shrink-0 border-t border-[#e8dcc8] bg-white/60 px-5 py-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                  No live link for this chapter
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, BookOpen } from 'lucide-react';
import { StorybookPageCurl } from './StorybookOrnament';

export default function StorybookProjectCard({ project, chapterNum, index = 0, onOpen, variant = 'left' }) {
  const hasCover = Boolean(project.cover_image_url);
  const isRight = variant === 'right';

  return (
    <motion.article
      initial={{ opacity: 0, x: isRight ? 40 : -40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onOpen?.(project)}
      className="group cursor-pointer"
    >
      <div className={`relative flex flex-col ${isRight ? 'md:flex-row-reverse' : 'md:flex-row'} bg-[#fffbf5] border border-[#e8dcc8] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.95)] rounded-sm overflow-hidden hover:shadow-[0_18px_50px_-14px_rgba(255,61,61,0.22)] hover:border-red/30 transition-all duration-500 sm:group-hover:-translate-y-0.5`}>
        <div className="h-1.5 bg-gradient-to-r from-red/30 via-red to-red/30 shrink-0 relative">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
        </div>
        <div className={`relative flex flex-col flex-1 min-w-0 ${isRight ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
        {/* Illustration side */}
        <div className="relative w-full md:w-[42%] h-44 sm:min-h-[180px] md:min-h-[220px] bg-black overflow-hidden shrink-0">
          {hasCover ? (
            <motion.img
              src={project.cover_image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.7 }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
              <BookOpen size={40} className="text-red/30" strokeWidth={1.5} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/20" />
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-red text-white flex items-center justify-center font-black text-xs sm:text-sm shadow-lg ring-2 ring-white/30">
            {chapterNum}
          </div>
        </div>

        {/* Story text side */}
        <div className="relative flex-1 p-4 sm:p-5 md:p-7 flex flex-col justify-center">
          <p className="text-[9px] font-black text-red uppercase tracking-[0.25em] mb-2">A chapter in the work</p>
          <h3 className="text-lg sm:text-xl md:text-2xl font-black text-black tracking-tight group-hover:text-red transition-colors break-words">
            {project.title}
          </h3>

          {project.description && (
            <p className="text-gray-600 text-sm font-medium leading-relaxed mt-3 line-clamp-3 italic">
              &ldquo;{project.description}&rdquo;
            </p>
          )}

          {project.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {project.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-black/5 text-gray-600 font-bold text-[9px] uppercase tracking-wider rounded-md border border-gray-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {project.project_url && (
            <p className="mt-4 sm:mt-5 inline-flex items-center gap-1.5 text-[10px] font-black text-red uppercase tracking-widest sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              Read this chapter <ExternalLink size={11} />
            </p>
          )}

          <StorybookPageCurl className="opacity-40 sm:opacity-60" />
        </div>
        </div>
      </div>
    </motion.article>
  );
}

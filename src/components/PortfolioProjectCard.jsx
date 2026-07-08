import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ArrowUpRight, Link2 } from 'lucide-react';

const layoutByIndex = [
  { className: 'md:col-span-2 md:row-span-2 min-h-[420px]', featured: true },
  { className: 'min-h-[280px]', featured: false },
  { className: 'min-h-[280px]', featured: false },
  { className: 'md:col-span-2 min-h-[300px]', featured: false },
  { className: 'min-h-[280px]', featured: false },
  { className: 'min-h-[280px]', featured: false },
];

export default function PortfolioProjectCard({ project, index = 0, onOpen }) {
  const hasCover = Boolean(project.cover_image_url);
  const hasLink = Boolean(project.project_url);
  const layout = layoutByIndex[index % layoutByIndex.length];
  const isFeatured = layout.featured;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 40, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, delay: (index % 6) * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative cursor-pointer ${layout.className}`}
      onClick={() => onOpen?.(project)}
    >
      <div className={`relative h-full w-full overflow-hidden rounded-[1.75rem] bg-black shadow-lg hover:shadow-2xl transition-shadow duration-500 ${isFeatured ? 'ring-1 ring-black/5' : ''}`}>
        {hasCover ? (
          <>
            <motion.img
              src={project.cover_image_url}
              alt={project.title}
              className="absolute inset-0 w-full h-full object-cover"
              whileHover={{ scale: 1.08 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10 opacity-90 group-hover:opacity-95 transition-opacity duration-500" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-950">
            <motion.div
              className="absolute top-1/4 right-1/4 w-56 h-56 bg-red rounded-full blur-[100px] opacity-25"
              animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.3, 0.2] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent" />
          </div>
        )}

        {isFeatured && (
          <div className="absolute top-5 left-5 z-10">
            <span className="px-3 py-1.5 bg-red text-white font-black text-[9px] uppercase tracking-[0.2em] rounded-lg shadow-lg">
              Featured
            </span>
          </div>
        )}

        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end z-10">
          {project.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3 translate-y-2 opacity-80 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
              {project.tags.slice(0, isFeatured ? 5 : 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold text-[9px] uppercase tracking-widest rounded-lg"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h3 className={`text-white font-black tracking-tight leading-tight ${isFeatured ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl'}`}>
            {project.title}
          </h3>

          {project.description && (
            <p className={`text-gray-300 font-medium mt-2 leading-relaxed transition-all duration-500 ${isFeatured ? 'text-sm md:text-base line-clamp-3 opacity-90' : 'text-sm line-clamp-2 opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-20 overflow-hidden'}`}>
              {project.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-400">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-white uppercase tracking-widest">
              View project <ArrowUpRight size={12} className="text-red" />
            </span>
          </div>
        </div>

        <div className="absolute top-5 right-5 z-10 flex gap-2">
          {hasLink && (
            <span className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
              <Link2 size={15} />
            </span>
          )}
          <span className="w-10 h-10 rounded-xl bg-red flex items-center justify-center text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 delay-75 shadow-lg shadow-red/30">
            <ExternalLink size={15} />
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-red origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 z-20" />
      </div>
    </motion.article>
  );
}

import React from 'react';
import { motion } from 'framer-motion';
import { fadeUpInView } from '../lib/scrollMotion';

const Leadership = () => {
  return (
    <section className="py-24 bg-gray-50 border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <motion.span {...fadeUpInView} className="text-red font-bold tracking-wider uppercase text-sm mb-4 block">
            Our Founder&apos;s Philosophy
          </motion.span>
          <motion.h2
            {...fadeUpInView}
            transition={{ ...fadeUpInView.transition, delay: 0.05 }}
            className="text-4xl md:text-5xl font-extrabold text-black"
          >
            People first. <span className="text-red">Always driven.</span>
          </motion.h2>
          <motion.p
            {...fadeUpInView}
            transition={{ ...fadeUpInView.transition, delay: 0.1 }}
            className="mt-5 text-lg md:text-xl text-gray-600 font-medium leading-relaxed"
          >
            When you hire right, remote doesn&apos;t mean disconnected—it means driven.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 lg:items-stretch">
          {/* Static image — no scroll transform (large asset + motion glitches mobile Safari) */}
          <div className="rounded-[32px] overflow-hidden shadow-xl min-h-[280px] sm:min-h-[320px] lg:min-h-[480px] [contain:paint]">
            <img
              src="/BYG.png"
              alt="BYG — building driven, connected remote teams"
              loading="lazy"
              decoding="async"
              className="w-full h-full min-h-[280px] sm:min-h-[320px] lg:min-h-[480px] object-cover"
            />
          </div>

          <motion.div
            {...fadeUpInView}
            transition={{ ...fadeUpInView.transition, delay: 0.08 }}
            className="bg-black text-white p-10 md:p-12 rounded-[32px] relative overflow-hidden shadow-2xl min-h-[320px] lg:min-h-[480px] flex flex-col justify-center"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red opacity-20 rounded-bl-full pointer-events-none" />
            <div className="relative z-10">
              <div className="text-red mb-8">
                <svg width="48" height="36" viewBox="0 0 48 36" fill="currentColor" aria-hidden="true">
                  <path d="M0 36V18.6C0 12.6 1.13333 7.8 3.4 4.2C5.73333 0.533333 9.4 0 14.4 0V7.2C11.6667 7.2 9.8 8 8.8 9.6C7.86667 11.2 7.4 13.5333 7.4 16.6H14.4V36H0ZM24.4 36V18.6C24.4 12.6 25.5333 7.8 27.8 4.2C30.1333 0.533333 33.8 0 38.8 0V7.2C36.0667 7.2 34.2 8 33.2 9.6C32.2667 11.2 31.8 13.5333 31.8 16.6H38.8V36H24.4Z" />
                </svg>
              </div>
              <p className="text-xl md:text-2xl lg:text-3xl leading-snug font-medium mb-10 tracking-tight">
                &ldquo;A remote career is an interesting TV Show. We don&apos;t evaluate our team by their pilot, but by their daily episodes. We provide the environment for our &lsquo;diamonds&rsquo; to find their shine.&rdquo;
              </p>
              <div className="flex items-center">
                <div className="w-12 h-1.5 bg-red mr-4 rounded-full" />
                <p className="font-black uppercase tracking-widest text-sm md:text-base">BYG Leadership</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Leadership;

import React from 'react';
import { motion } from 'framer-motion';
// import heroVideo from '../assets/Hero BG.mov';
import LiveJobsTicker from './LiveJobsTicker';
import HeroProblemSolve from './HeroProblemSolve';

const ease = [0.22, 1, 0.36, 1];

/**
 * Hero: two flat plates stretched edge-to-edge under the nav.
 * Left jobs (~40%) | right cinematic hire journey (~60%).
 */
const Hero = () => {
  return (
    // HomePage already has pt-20 for the nav
    <div className="relative pt-1 pb-3 sm:pb-4 overflow-hidden min-h-[calc(100vh-5rem)] flex items-stretch">
      <div className="absolute inset-0 z-0 bg-[#f6f4f2]" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_15%_10%,rgba(255,61,61,0.1),transparent_48%),radial-gradient(ellipse_at_85%_30%,rgba(16,185,129,0.06),transparent_42%)]" />

      {/*
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        className="absolute top-0 left-0 w-full h-full object-cover z-0 opacity-45 md:opacity-60"
      >
        <source src={heroVideo} type="video/quicktime" />
        <source src={heroVideo} type="video/mp4" />
      </video>
      */}

      {/* Stretch plates from every direction — wider, taller, tighter gutters */}
      <div className="relative z-10 w-full px-2 sm:px-3 lg:px-4 flex flex-col flex-1 min-h-0">
        <div className="grid lg:grid-cols-10 gap-2 sm:gap-3 flex-1 min-h-0 items-stretch">
          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="lg:col-span-4 order-2 lg:order-1 flex min-h-[30rem] lg:min-h-0"
          >
            <div className="w-full h-full min-h-[30rem] lg:min-h-[calc(100vh-5.75rem)] rounded-[1.5rem] sm:rounded-[1.75rem] border border-white/10 bg-[#0a0a0a] shadow-[0_24px_70px_-28px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col p-3 sm:p-4">
              <LiveJobsTicker limit={28} fill dark />
            </div>
          </motion.aside>

          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06, ease }}
            className="lg:col-span-6 order-1 lg:order-2 flex min-h-[30rem] lg:min-h-0"
          >
            <div className="w-full h-full min-h-[30rem] lg:min-h-[calc(100vh-5.75rem)] rounded-[1.5rem] sm:rounded-[1.75rem] border border-black/10 bg-white/95 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col p-4 sm:p-5 lg:p-6">
              <HeroProblemSolve plate />
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
};

export default Hero;

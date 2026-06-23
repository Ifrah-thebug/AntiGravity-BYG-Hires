import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import heroVideo from '../assets/Hero BG.mov';

const Hero = () => {
  return (
    <div className="relative pt-28 pb-16 lg:pt-40 lg:pb-24 overflow-hidden bg-white min-h-[65vh] flex items-center">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute top-0 left-0 w-full h-full object-cover z-0 opacity-25 md:opacity-40"
      >
        <source src={heroVideo} type="video/quicktime" />
        <source src={heroVideo} type="video/mp4" />
      </video>

      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/75 via-white/60 to-white/80 z-[1]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-black tracking-tight leading-[1.1] mb-5"
          >
            Your first hire
            <br />
            shouldn&apos;t be your{' '}
            <span className="text-red">biggest risk.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-base md:text-lg text-gray-700 mb-8 max-w-2xl mx-auto font-medium leading-snug"
          >
            We find, vet, and place remote talent so founders can focus on building—not recruiting.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row justify-center items-center gap-3"
          >
            <Link
              to="/talent/signup"
              className="group w-full sm:w-auto px-7 py-3.5 bg-red text-white rounded-full font-bold text-base flex items-center justify-center gap-2 hover:bg-black transition-colors shadow-lg border-2 border-red"
            >
              Join the Talent Pool
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/talent"
              className="group w-full sm:w-auto px-7 py-3.5 bg-white/90 border-2 border-black text-black rounded-full font-bold text-base flex items-center justify-center gap-2 hover:bg-black hover:text-white transition-colors shadow-lg"
            >
              Find a Great Hire
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </div>

      <div className="hidden md:block absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-red/5 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden md:block absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-gray-100 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
};

export default Hero;

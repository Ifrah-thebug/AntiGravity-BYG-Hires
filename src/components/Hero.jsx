import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import heroVideo from '../assets/Hero BG.mov';

const Hero = () => {
  return (
    <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-white min-h-[70vh] flex items-center">
      {/* Video Background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover z-0 opacity-40"
      >
        <source src={heroVideo} type="video/quicktime" />
        <source src={heroVideo} type="video/mp4" />
      </video>

      {/* Content Overlay */}
      <div className="absolute top-0 left-0 w-full h-full bg-white/60 z-[1]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-black tracking-tight mb-6"
          >
            Scale more, <span className="text-red">with less.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl md:text-2xl text-gray-800 mb-10 max-w-2xl mx-auto font-medium"
          >
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row justify-center items-center gap-4"
          >
            <a
              href="https://forms.gle/1xSJiXkfr7kCVdAr7"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-red text-red rounded-full font-bold text-lg flex items-center justify-center gap-2 hover:bg-red hover:text-white transition-colors shadow-lg"
            >
              Find a Great Hire
            </a>
            <a
              href="https://calendly.com/recruitment-bnyahyagroup/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-red text-red rounded-full font-bold text-lg flex items-center justify-center gap-2 hover:bg-red hover:text-white transition-colors shadow-lg"
            >
              Discuss Your Requirements
            </a>
          </motion.div>
        </div>
      </div>

      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-red/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-gray-100 rounded-full blur-3xl" />
    </div>
  );
};

export default Hero;

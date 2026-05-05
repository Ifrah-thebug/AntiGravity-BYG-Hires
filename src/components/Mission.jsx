import React from 'react';
import { motion } from 'framer-motion';
import ourMissionImg from '../assets/our-mission.png';

const Mission = () => {
  return (
    <section className="py-24 bg-white text-center">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-red font-bold tracking-wider uppercase text-sm mb-4 block">Our mission</span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-black mb-12 leading-tight">
            Providing the <br />
            Best pre-vetted Remote Staff.
          </h2>
          
          <div className="flex flex-col items-center">
            <img src={ourMissionImg} alt="BYG Hires - Bringing You Great" className="h-64 object-contain" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Mission;

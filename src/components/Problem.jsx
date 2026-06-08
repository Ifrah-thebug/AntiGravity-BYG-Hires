import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, UserX, BatteryWarning } from 'lucide-react';
import problemImg from '../assets/problem_illustration_1777839869302.png';

const painPoints = [
  {
    icon: DollarSign,
    title: 'High Overheads',
    desc: 'Local hiring comes with added setup costs.',
  },
  {
    icon: UserX,
    title: 'Talent Instability',
    desc: "It's challenging to find reliable individuals who remain committed for the long term, especially when hiring locally, as their departure can be more financially damaging.",
  },
  {
    icon: BatteryWarning,
    title: 'Management Burnout',
    desc: 'Founders and senior teams spend too much time on admin tasks instead of focusing on growth and strategic priorities.',
  },
];

const Problem = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 lg:items-start">
          {/* Left — pain points */}
          <div>
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-red font-bold tracking-wider uppercase text-sm mb-4 block"
            >
              The Problem
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-extrabold text-black mb-10 leading-tight"
            >
              Local Businesses Are{' '}
              <span className="text-red">Struggling to Scale.</span>
            </motion.h2>

            <div className="space-y-4">
              {painPoints.map(({ icon: Icon, title, desc }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: index * 0.1, duration: 0.45 }}
                  whileHover={{ x: 4 }}
                  className="group bg-gray-50 border border-gray-100 rounded-2xl p-5 md:p-6 flex gap-4 items-start hover:border-red/25 hover:shadow-md transition-all duration-300"
                >
                  <div className="w-11 h-11 rounded-xl bg-red/10 text-red flex items-center justify-center shrink-0 group-hover:bg-red group-hover:text-white transition-colors duration-300">
                    <Icon size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black mb-1.5">{title}</h3>
                    <p className="text-gray-600 leading-relaxed text-[15px]">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.35 }}
              className="mt-6 bg-red/5 border border-red/10 rounded-2xl p-5 md:p-6 lg:hidden"
            >
              <p className="text-base font-medium text-black leading-relaxed">
                <span className="font-bold text-red">The Takeaway:</span> Close the gap. Build the right team. Scale with less stress.
              </p>
            </motion.div>
          </div>

          {/* Right — unified visual panel (sticky on desktop) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:sticky lg:top-28"
          >
            <div className="rounded-[32px] overflow-hidden shadow-xl border border-gray-100">
              <motion.div
                initial={{ opacity: 0, scale: 1.04 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="relative h-52 md:h-60 overflow-hidden bg-gray-100"
              >
                <img
                  src={problemImg}
                  alt="Stressed business owner overwhelmed by scaling challenges"
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </motion.div>

              <div className="bg-black p-7 md:p-8 text-white">
                <div className="space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 }}
                    className="border-b border-gray-800 pb-6"
                  >
                    <h4 className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Local Team</h4>
                    <p className="text-lg font-medium leading-snug">
                      Get busy achieving targets and generating business.{' '}
                      <span className="text-red font-bold block mt-2 text-sm tracking-wide">FOCUS ON GROWTH.</span>
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.25 }}
                  >
                    <h4 className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Remote Team</h4>
                    <p className="text-lg font-medium leading-snug">
                      Skilled remote staff who handle the back-end and admin work.{' '}
                      <span className="text-red font-bold block mt-2 text-sm tracking-wide">FOCUS ON SUPPORT.</span>
                    </p>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="hidden lg:block mt-12 bg-red/5 border-l-4 border-red p-6 md:p-7 rounded-r-2xl"
        >
          <p className="text-lg md:text-xl font-medium text-black leading-relaxed">
            <span className="font-bold text-red">The Takeaway:</span> Close the gap. Build the right team. Scale with less stress.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Problem;

import React from 'react';
import { motion } from 'framer-motion';
import problemImage from '../assets/problem_illustration_1777839869302.png';

const Problem = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16">
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
            className="text-4xl md:text-5xl font-extrabold text-black"
          >
            Local Businesses Are <br />
            <span className="text-red">Struggling to Scale.</span>
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-xl font-bold text-black mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red"></span>
                High Overheads
              </h3>
              <p className="text-gray-600 ml-4">Local hiring comes with added setup costs.</p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-black mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red"></span>
                Talent Instability
              </h3>
              <p className="text-gray-600 ml-4">It's challenging to find reliable individuals who remain committed for the long term, especially when hiring locally, as their departure can be more financially damaging.</p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-black mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red"></span>
                Management Burnout
              </h3>
              <p className="text-gray-600 ml-4">Founders and senior teams spend too much time on admin tasks instead of focusing on growth and strategic priorities.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-6"
          >
            <div className="w-full h-56 md:h-72 overflow-hidden rounded-3xl shadow-sm border border-gray-100">
              <img src={problemImg} alt="Stressed business owner" className="w-full h-full object-cover object-top" />
            </div>
            <div className="bg-black rounded-3xl p-8 text-white flex flex-col justify-center flex-grow">
              <div className="space-y-8">
                <div className="border-b border-gray-800 pb-6">
                  <h4 className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-2">Local Team</h4>
                  <p className="text-xl font-medium">Get busy achieving targets and generating business. <span className="text-red font-bold block mt-2">FOCUS ON GROWTH.</span></p>
                </div>

                <div>
                  <h4 className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-2">Remote Team</h4>
                  <p className="text-xl font-medium">Skilled remote staff who handle the back-end and admin work. <span className="text-red font-bold block mt-2">FOCUS ON SUPPORT.</span></p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-red/5 border-l-4 border-red p-6 rounded-r-lg"
        >
          <p className="text-xl font-medium text-black">
            <span className="font-bold text-red">The Takeaway:</span> Close the gap. Build the right team. Scale with less stress.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Problem;

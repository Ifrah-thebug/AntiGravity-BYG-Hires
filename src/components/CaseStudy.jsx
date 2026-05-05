import React from 'react';
import { motion } from 'framer-motion';
import caseStudyImg from '../assets/case-study-photo.jpg';
const CaseStudy = () => {
  return (
    <section className="py-24 bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-red font-bold tracking-wider uppercase text-sm mb-4 block"
          >
            Case Study
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold mb-8"
          >
            Scaling Beyond <span className="text-red">One Destination</span>
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-5 gap-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-3 space-y-8"
          >
            <div className="bg-white p-8 rounded-3xl border border-gray-200">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-black">
                <span className="text-red">Company:</span> 365 Adventures
              </h3>

              <div className="w-full h-56 rounded-2xl overflow-hidden mb-8 border border-gray-100">
                <img src={caseStudyImg} alt="Case Study" />
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-red font-bold uppercase tracking-wider text-sm mb-2">About The Company</h4>
                  <p className="text-gray-700 leading-relaxed">
                    365 Adventures is a luxury Destination Management Company offering tours, corporate experiences, and travel services across Qatar, UAE, KSA, and Oman.
                  </p>
                </div>

                <div>
                  <h4 className="text-red font-bold uppercase tracking-wider text-sm mb-2">Challenge</h4>
                  <p className="text-gray-700 leading-relaxed">
                    A 8 year old Qatar based business expanded into three new markets: KSA, UAE and Oman in 2023: creating more admin, digital and operations work.
                  </p>
                </div>

                <div>
                  <h4 className="text-red font-bold uppercase tracking-wider text-sm mb-2">Action</h4>
                  <p className="text-gray-700 leading-relaxed">
                    Hired 80% of new staff from remote working model.
                  </p>
                </div>

                <div>
                  <h4 className="text-red font-bold uppercase tracking-wider text-sm mb-2">Result</h4>
                  <p className="text-gray-900 leading-relaxed font-bold">
                    Smooth expansion unlocking significant cost savings and supporting growth across new destinations.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2"
          >
            <div className="bg-red p-8 rounded-3xl h-full">
              <h4 className="text-black font-extrabold uppercase tracking-wider text-lg mb-6">Key Takeaways</h4>
              <p className="mb-6 font-medium">Over the last two years, BYG Hires has assisted 365 Adventures in accelerating their growth by:</p>

              <ul className="space-y-4">
                <li className="flex gap-3">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-black flex-shrink-0"></div>
                  <p className="font-medium text-white/90">Embracing a new realm of remote work</p>
                </li>
                <li className="flex gap-3">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-black flex-shrink-0"></div>
                  <p className="font-medium text-white/90">Streamlining payroll and employee management</p>
                </li>
                <li className="flex gap-3">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-black flex-shrink-0"></div>
                  <p className="font-medium text-white/90">Reducing overhead costs by 80%</p>
                </li>
                <li className="flex gap-3">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-black flex-shrink-0"></div>
                  <p className="font-medium text-white/90">Hired multiple remote talents for enhanced turbo productivity</p>
                </li>
                <li className="flex gap-3">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-black flex-shrink-0"></div>
                  <p className="font-medium text-white/90">Establishing an annual hiring cycle to optimize seasonal efficiency and growth strategy.</p>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CaseStudy;

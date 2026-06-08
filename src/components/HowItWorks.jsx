import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { getDiscoveryBookingUrl } from '../lib/discoveryBooking';

const hiringSteps = [
  {
    num: '01',
    title: 'Share your role requirements',
    desc: 'Tell us about the role, skills, and personality fit you need. A quick brief is all it takes to get started.',
  },
  {
    num: '02',
    title: 'One strategy conversation',
    desc: 'We hop on a call to understand your team culture, hiring priorities, and what great looks like for the role.',
  },
  {
    num: '03',
    title: 'We source, screen & match',
    desc: 'We handle sourcing, pre-vetting, and shortlisting through our multi-step process — so you only see role-ready candidates.',
  },
  {
    num: '04',
    title: 'Interview-ready profiles in days',
    desc: 'Receive a curated shortlist with work history, skills, and video introductions. You interview and pick — we handle the rest.',
  },
];

const vettingSteps = [
  'Application screening & profile review',
  'Resume/CV and experience evaluation',
  'Skills & role-fit assessment',
  'Real-world task or scenario evaluation',
  'Communication & professionalism review',
  'Reference checks where applicable',
  'Final quality review by the BYG Hires team',
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 bg-white scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-red font-bold tracking-wider uppercase text-sm mb-4 block"
          >
            Done-for-you hiring
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold text-black mb-5"
          >
            Our <span className="text-red">Hiring Process</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 font-medium leading-relaxed"
          >
            A completely done-for-you hiring experience — from role brief to vetted, hire-ready talent.
          </motion.p>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Hiring journey */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2 text-center"
          >
            Your hiring journey
          </motion.p>

          <div className="divide-y divide-gray-100">
            {hiringSteps.map(({ num, title, desc }, index) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: index * 0.08 }}
                className="flex gap-6 md:gap-10 py-8 md:py-10 first:pt-0"
              >
                <span className="text-4xl md:text-5xl font-black text-red leading-none shrink-0 w-14 md:w-16 tabular-nums">
                  {num}
                </span>
                <div className="pt-1">
                  <h3 className="text-xl md:text-2xl font-bold text-black mb-2 leading-snug">
                    {title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-base md:text-[17px]">
                    {desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Vetting — below journey, single card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 md:mt-16 bg-gray-50 border border-gray-100 rounded-3xl p-8 md:p-10"
          >
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">
              Our vetting process
            </h3>
            <p className="text-lg md:text-xl font-bold text-black mb-8 leading-snug">
              Every candidate goes through a rigorous evaluation before they reach you.
            </p>

            <ol className="space-y-4">
              {vettingSteps.map((step, index) => (
                <motion.li
                  key={step}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.04 }}
                  className="flex items-start gap-4"
                >
                  <span className="w-7 h-7 rounded-full bg-red text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 text-[15px] md:text-base leading-relaxed pt-0.5">
                    {step}
                  </span>
                </motion.li>
              ))}
            </ol>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <p className="text-gray-500 font-medium mb-6">
              Ready to see how it works for your role?
            </p>
            <a
              href={getDiscoveryBookingUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-red hover:bg-black text-white font-bold text-base px-8 py-4 rounded-full transition-colors shadow-lg border-2 border-red"
            >
              Discuss your requirements
              <ArrowRight size={18} />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

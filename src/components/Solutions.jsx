import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import setsUsApartGif from '../assets/sets-us-apart.gif';
import { fadeUpInView } from '../lib/scrollMotion';

const Solutions = () => {
  const solutions = [
    {
      title: 'Ready-to-Work Talent',
      desc: 'We do the entire hiring process - sourcing, screening, shortlisting, onboarding. You focus on the final decision, not the process.',
    },
    {
      title: 'People First Always',
      desc: 'When talent feels supported, performance improves. We take care of our Hires same as we care for your business.',
    },
    {
      title: 'Scale Up or Down with Ease',
      desc: 'Business demands fluctuate. Remote staffing offers flexibility, allowing you to adjust without the burden of overhead that is difficult to untangle.',
    },
    {
      title: 'HR and Compliance Covered',
      desc: 'Cross-border hiring comes with payroll, labor rules, and compliance requirements. We manage the details so you can stay focused on the business.',
    },
    {
      title: 'Curated Talent, Not Bulk Lists',
      desc: "We don't overwhelm you with dozens of random profiles. Every candidate we share is carefully selected for your role, with quality always taking priority over quantity.",
    },
  ];

  return (
    <section className="py-24 bg-gray-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-red font-bold tracking-wider uppercase text-sm mb-4 block"
          >
            Our Solutions
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold text-black"
          >
            What <span className="text-red">sets us apart</span>
          </motion.h2>
        </div>

        {/* Cards scroll with the page; image sticks on the right (desktop only) */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 lg:items-start">
          <div className="space-y-6">
            {solutions.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: index * 0.06 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-start"
              >
                <div className="mt-1 flex-shrink-0">
                  <CheckCircle2 className="text-red w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-black mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            {...fadeUpInView}
            className="lg:sticky lg:top-28 lg:self-start rounded-3xl overflow-hidden shadow-xl [contain:paint]"
          >
            <img
              src={setsUsApartGif}
              alt="Remote team collaboration"
              loading="lazy"
              decoding="async"
              className="w-full h-auto object-cover"
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="mt-14 text-center"
        >
          <Link
            to="/talent"
            className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-red text-white rounded-full font-bold text-lg hover:bg-black transition-colors shadow-lg border-2 border-red"
          >
            Find Your Next Great Hire
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default Solutions;

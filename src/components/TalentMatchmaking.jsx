import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, Star, ArrowRight } from 'lucide-react';

import ahmadImg from '../assets/Ahmad K.png';
import elshaImg from '../assets/Elsha G.png';
import haadiahImg from '../assets/Haadiah S.png';
import nihalImg from '../assets/Nihal S.png';
import rachelleImg from '../assets/Rachelle R.png';

const allTalent = [
  {
    id: 1,
    name: 'Ahmad K.',
    photo: ahmadImg,
    role: 'Customer Service',
    expertise: 'Customer Success & CRM',
    fee: '$350',
    availability: '9-5',
    match: 97,
    industries: ['E-commerce', 'SaaS', 'Healthcare', 'Logistics', 'Retail'],
  },
  {
    id: 3,
    name: 'Haadiah S.',
    photo: haadiahImg,
    role: 'Finance',
    expertise: 'Bookkeeping & Financial Reporting',
    fee: '$400',
    availability: 'Flexible',
    match: 96,
    industries: ['SaaS', 'Healthcare', 'Real Estate', 'Finance'],
  },
  {
    id: 4,
    name: 'Nihal S.',
    photo: nihalImg,
    role: 'Marketing',
    expertise: 'AI & Marketing Automation',
    fee: '$750',
    availability: 'Night',
    match: 92,
    industries: ['Finance', 'E-commerce', 'Real Estate', 'SaaS', 'Logistics'],
  },
  {
    id: 5,
    name: 'Rachelle R.',
    photo: rachelleImg,
    role: 'Operations',
    expertise: 'Operations & Process Optimisation',
    fee: '$600',
    availability: '9-5',
    match: 95,
    industries: ['Logistics', 'Healthcare', 'E-commerce', 'SaaS'],
  },
  {
    id: 2,
    name: 'Zelsha G.',
    photo: elshaImg,
    role: 'Admin',
    expertise: 'Virtual Administration',
    fee: '$350',
    availability: 'Flexible',
    match: 94,
    industries: ['Real Estate', 'SaaS', 'E-commerce', 'Logistics'],
  },
];

const industries = [
  'All',
  'E-commerce',
  'SaaS',
  'Healthcare',
  'Logistics',
  'Real Estate',
  'Finance',
  'Retail',
];

const availabilityColors = {
  '9-5':     'bg-black text-white',
  'Flexible': 'bg-gray-100 text-gray-700',
  'Night':    'bg-gray-900 text-white',
};

const TalentMatchmaking = () => {
  const [selected, setSelected] = useState('All');
  const navigate = useNavigate();

  const displayed = selected === 'All'
    ? allTalent
    : allTalent.filter(t => t.industries.includes(selected));

  return (
    <section className="py-28 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black text-black tracking-tight leading-tight mb-2 uppercase"
          >
            Business & Talent Matchmaking
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-2xl md:text-3xl font-bold text-gray-500 tracking-tight mb-12"
          >
            Your next hire is already <span className="text-red">ready.</span>
          </motion.p>

          {/* Industry Selector */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-3 items-center"
          >
            <span className="text-gray-500 font-bold text-xs tracking-widest uppercase mr-2">
              Select your Industry:
            </span>
            {industries.map(ind => (
              <button
                key={ind}
                onClick={() => setSelected(ind)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all border ${
                  selected === ind
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
                }`}
              >
                {ind}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Top Recommendations Label */}
        <div className="flex items-center gap-4 mb-8">
          <Star size={14} className="text-red fill-red" />
          <span className="text-xs font-black text-gray-400 tracking-[0.2em] uppercase">
            Top Recommendations
          </span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Profile Tiles */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 mb-14"
          >
            {displayed.slice(0, 5).map((talent, i) => (
              <motion.div
                key={talent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="group bg-white border border-gray-100 rounded-3xl overflow-hidden hover:border-red/30 hover:shadow-xl hover:shadow-red/5 transition-all duration-300 flex flex-col"
              >
                {/* Photo */}
                <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-50">
                  <img
                    src={talent.photo}
                    alt={talent.name}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Match Score Badge */}
                  <div className="absolute top-3 right-3 bg-black text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="text-red">{talent.match}%</span>
                    <span>match</span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <p className="text-black font-black text-sm leading-tight">{talent.name}</p>
                    <p className="text-gray-500 text-xs font-medium mt-0.5">{talent.expertise}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-bold bg-gray-50 border border-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                      {talent.role}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${availabilityColors[talent.availability]}`}>
                      {talent.availability === '9-5' ? '⏰ 9-5' : talent.availability === 'Night' ? '🌙 Night' : '🔄 Flexible'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Monthly</p>
                      <p className="text-black font-black text-sm">{talent.fee}</p>
                    </div>
                  </div>

                  <a
                    href="https://calendly.com/recruitment-bnyahyagroup/30min"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto w-full py-3 bg-black text-white text-[10px] font-black tracking-widest uppercase rounded-xl hover:bg-red transition-all duration-200 text-center"
                  >
                    Request Intro
                  </a>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Explore CTA */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/talent-browse')}
            className="group flex items-center gap-3 px-10 py-5 border-2 border-red text-red font-black text-xl tracking-wide rounded-2xl hover:bg-red hover:text-white transition-all duration-300"
          >
            Explore the Matchmaking
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default TalentMatchmaking;

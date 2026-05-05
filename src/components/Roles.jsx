import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase } from 'lucide-react';

const DallahPouring = () => (
  <svg viewBox="0 0 200 120" className="w-24 h-18 md:w-36 md:h-24 inline-block align-middle ml-2">
    <defs>
      <clipPath id="cupFillClip">
        <path d="M15 30 C 20 30, 10 70, 35 90 L 65 90 C 90 70, 80 30, 85 30 Z" />
      </clipPath>
    </defs>

    {/* Gahva Cup */}
    <g transform="translate(140, 70) scale(0.45)">
      {/* Background/Shadow */}
      <path 
        d="M15 30 C 20 30, 10 70, 35 90 L 65 90 C 90 70, 80 30, 85 30 Z" 
        fill="#F9F9F9" 
        stroke="#333" 
        strokeWidth="3" 
      />
      
      {/* Coffee filling up with clipPath */}
      <g clipPath="url(#cupFillClip)">
        <motion.rect
          x="0"
          y="100"
          width="100"
          height="100"
          fill="#4B3621"
          animate={{ 
            y: [100, 100, 40, 40, 100]
          }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.3, 0.7, 0.8, 1], ease: "easeInOut" }}
        />
      </g>

      {/* Patterns */}
      <g transform="translate(50, 65) scale(0.9)">
        <path d="M-5 10 Q 0 -15, 5 10 Q 0 25, -5 10" fill="#8B0000" />
        <path d="M-20 5 Q -15 -10, -10 5 Q -15 20, -20 5" fill="#8B0000" />
        <path d="M10 5 Q 15 -10, 20 5 Q 15 20, 10 5" fill="#8B0000" />
        <path d="M-12 -15 L-8 -15 L-10 -5 Z" fill="#008000" />
        <path d="M8 -15 L12 -15 L10 -5 Z" fill="#008000" />
      </g>
    </g>

    {/* The Dallah */}
    <motion.g
      animate={{ 
        rotate: [0, 35, 35, 0],
        x: [0, 0, 0, 0],
        y: [0, -20, -20, 0]
      }}
      transition={{ duration: 4, repeat: Infinity, times: [0, 0.25, 0.75, 1], ease: "easeInOut" }}
      className="origin-[50px_110px]"
    >
      <path d="M30 100 L70 100 L65 60 L35 60 Z" fill="#D4AF37" stroke="black" strokeWidth="2" />
      <path d="M25 110 L75 110 L70 100 L30 100 Z" fill="#D4AF37" stroke="black" strokeWidth="2" />
      <path d="M65 70 Q 110 60, 120 25 L 115 20 Q 105 55, 65 65 Z" fill="#D4AF37" stroke="black" strokeWidth="2" />
      <path d="M35 60 L65 60 L50 40 Z" fill="#D4AF37" stroke="black" strokeWidth="2" />
      <circle cx="50" cy="35" r="3" fill="#D4AF37" stroke="black" strokeWidth="1" />
      <path d="M35 70 Q 15 85, 35 100" fill="none" stroke="black" strokeWidth="3" />
    </motion.g>

    {/* Pouring Stream (Fixed position, synced perfectly with Dallah resting state) */}
    <motion.path
      d="M155 54 Q 158 70, 162 85"
      stroke="#4B3621"
      strokeLinecap="round"
      fill="none"
      initial={{ pathLength: 0, opacity: 0, strokeWidth: 3.5 }}
      animate={{ 
        pathLength: [0, 0, 1, 1, 1, 1], 
        opacity:    [0, 0, 1, 1, 0, 0],
        strokeWidth:[3.5, 3.5, 3.5, 3.5, 0, 0]
      }}
      transition={{ duration: 4, repeat: Infinity, times: [0, 0.25, 0.3, 0.7, 0.75, 1], ease: "easeInOut" }}
    />
  </svg>
);

const Roles = () => {
  const roles = [
    "AI Automation Specialist",
    "Administrative & Operations",
    "Account Coordinators",
    "Marketing & Content Creation",
    "Virtual Assistants",
    "Customer Support & Client Success",
    "Sales & Business Development",
    "HR Coordinators",
    "IT & Technical Support",
    "Finance, Accounting & Bookkeeping"
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold text-black flex items-center justify-center flex-wrap"
          >
            <span>Remote Roles <span className="text-red">we fill</span></span>
            <DallahPouring />
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-center gap-4 hover:shadow-md transition-all hover:bg-white hover:border-red/30 cursor-default group"
            >
              <div className="w-10 h-10 bg-red/10 text-red rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-red group-hover:text-white transition-colors">
                <Briefcase size={18} />
              </div>
              <span className="font-bold text-gray-800 group-hover:text-black">{role}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Roles;

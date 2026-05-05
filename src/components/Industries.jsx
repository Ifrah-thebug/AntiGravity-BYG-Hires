import React from 'react';
import { motion } from 'framer-motion';

const GahvaCup = () => (
  <svg viewBox="0 0 100 100" className="w-12 h-12 md:w-16 md:h-16 inline-block align-middle ml-4">
    {/* Steam */}
    <motion.g
      animate={{ opacity: [0.3, 0.6, 0.3], y: [0, -3, 0] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <path d="M40 20 Q 45 10, 40 0" fill="none" stroke="#666" strokeWidth="1" />
      <path d="M50 22 Q 55 12, 50 2" fill="none" stroke="#666" strokeWidth="1" />
      <path d="M60 20 Q 65 10, 60 0" fill="none" stroke="#666" strokeWidth="1" />
    </motion.g>

    {/* Cup Body (Authentic Flared Shape) */}
    <path 
      d="M15 30 C 20 30, 10 70, 35 90 L 65 90 C 90 70, 80 30, 85 30 Z" 
      fill="#F9F9F9" 
      stroke="#333" 
      strokeWidth="1.5" 
    />
    
    {/* Coffee Surface */}
    <ellipse cx="50" cy="33" rx="32" ry="5" fill="#4B3621" />

    {/* Patterns (Petals and Flowers) */}
    <g transform="translate(50, 60) scale(0.8)">
      {/* Center Petal */}
      <path d="M-5 10 Q 0 -15, 5 10 Q 0 25, -5 10" fill="#8B0000" />
      {/* Side Petals */}
      <path d="M-20 5 Q -15 -10, -10 5 Q -15 20, -20 5" fill="#8B0000" />
      <path d="M10 5 Q 15 -10, 20 5 Q 15 20, 10 5" fill="#8B0000" />
      
      {/* Green Floral Elements */}
      <path d="M-12 -15 L-8 -15 L-10 -5 Z" fill="#008000" stroke="#008000" strokeWidth="0.5" />
      <path d="M8 -15 L12 -15 L10 -5 Z" fill="#008000" stroke="#008000" strokeWidth="0.5" />
      <path d="M-2 -18 L2 -18 L0 -8 Z" fill="#008000" stroke="#008000" strokeWidth="0.5" />
      
      {/* Vertical divider lines */}
      <line x1="-15" y1="-25" x2="-15" y2="35" stroke="#8B0000" strokeWidth="0.5" opacity="0.4" />
      <line x1="15" y1="-25" x2="15" y2="35" stroke="#8B0000" strokeWidth="0.5" opacity="0.4" />
    </g>
    
    {/* Upper Rim Line */}
    <path d="M18 45 Q 50 48, 82 45" fill="none" stroke="#333" strokeWidth="0.5" opacity="0.3" />
  </svg>
);

const Industries = () => {
  const industries = [
    "E-Commerce & Retail",
    "Real Estate & Property Management",
    "Hospitality & Tourism",
    "Construction & Engineering",
    "Finance & Fintech",
    "Healthcare Administration"
  ];

  return (
    <section className="py-24 bg-gray-50 border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold text-black flex items-center justify-center"
          >
            <span>Industries <span className="text-red">we serve</span></span>
            <GahvaCup />
          </motion.h2>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {industries.map((industry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white px-8 py-4 rounded-full shadow-sm border border-gray-200 font-bold text-black hover:border-red/30 hover:shadow-md hover:bg-white transition-all cursor-default"
            >
              {industry}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Industries;

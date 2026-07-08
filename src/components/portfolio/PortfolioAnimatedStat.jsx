import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function PortfolioAnimatedStat({ value = 0, label, icon: Icon, delay = 0, displayOverride }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (displayOverride) return undefined;
    if (!value) {
      setDisplay(0);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const duration = 1400;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    const timeout = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, delay, displayOverride]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: delay / 1000, duration: 0.5 }}
      className="relative group"
    >
      <div className="absolute inset-0 bg-red/5 rounded-2xl scale-95 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500" />
      <div className="relative px-4 sm:px-5 py-4 rounded-2xl border border-[#e8dcc8] bg-[#fffbf5] shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon size={14} className="text-red" />}
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">{label}</p>
        </div>
        <p className="font-black text-2xl sm:text-3xl text-black tabular-nums tracking-tight">
          {displayOverride ?? display}
        </p>
      </div>
    </motion.div>
  );
}

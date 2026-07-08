import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, FolderOpen, Sparkles, Award } from 'lucide-react';
import PortfolioAnimatedStat from './PortfolioAnimatedStat';

export default function PortfolioHighlightsStrip({
  experienceYears = 0,
  projectCount = 0,
  skillCount = 0,
  verified = false,
}) {
  const items = [
    experienceYears > 0 && { value: experienceYears, label: 'Years experience', icon: Briefcase },
    projectCount > 0 && { value: projectCount, label: 'Work chapters', icon: FolderOpen },
    skillCount > 0 && { value: skillCount, label: 'Core skills', icon: Sparkles },
    verified && { label: 'BYG verified', icon: Award, display: '✓' },
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6 }}
      className="max-w-5xl mx-auto px-3 sm:px-6 -mt-2 mb-2 md:mb-4"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {items.map((item, i) => (
          <PortfolioAnimatedStat
            key={item.label}
            value={item.display ? undefined : item.value}
            label={item.label}
            icon={item.icon}
            delay={i * 120}
            displayOverride={item.display}
          />
        ))}
      </div>
    </motion.div>
  );
}

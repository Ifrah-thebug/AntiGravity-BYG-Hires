import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Star, Rocket, Flag } from 'lucide-react';

const ICONS = [MapPin, Star, Rocket, Flag];

export default function PortfolioJourneyTimeline({
  firstName,
  jobTitle,
  departmentLabel,
  experienceYears = 0,
  bestSkill,
}) {
  const milestones = [
    {
      title: 'Where it started',
      text: departmentLabel
        ? `Building a career in ${departmentLabel.toLowerCase()}.`
        : 'Every story begins with curiosity and a first step forward.',
    },
    experienceYears > 0 && {
      title: `${experienceYears}+ years in the making`,
      text: `Season after season of learning, shipping, and growing as a ${jobTitle?.toLowerCase() || 'professional'}.`,
    },
    bestSkill && {
      title: 'Signature craft',
      text: `Known for strength in ${bestSkill} — the skill that shows up in every chapter.`,
    },
    {
      title: 'Writing the next page',
      text: `${firstName} is ready for the next team, project, and adventure.`,
    },
  ].filter(Boolean);

  return (
    <div className="relative pl-2 sm:pl-4">
      <div className="absolute left-[1.15rem] sm:left-5 top-2 bottom-2 w-px bg-gradient-to-b from-red/50 via-red/20 to-transparent" aria-hidden />

      <ul className="space-y-6 sm:space-y-8">
        {milestones.map((step, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex gap-4 sm:gap-5"
            >
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 + 0.1, type: 'spring', stiffness: 260 }}
                className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black text-white flex items-center justify-center shrink-0 shadow-md ring-4 ring-[#fffbf5]"
              >
                <Icon size={15} className="text-red" />
              </motion.div>
              <div className="pt-0.5 min-w-0">
                <p className="text-[9px] font-black text-red uppercase tracking-[0.25em] mb-1">
                  Milestone {i + 1}
                </p>
                <h3 className="font-black text-base sm:text-lg text-black tracking-tight">{step.title}</h3>
                <p className="text-sm text-gray-600 font-medium leading-relaxed mt-1">{step.text}</p>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

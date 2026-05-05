import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Compass, ShieldCheck, MonitorSmartphone } from 'lucide-react';

const Differentiators = () => {
  const diffs = [
    {
      icon: <Heart size={28} className="text-white" />,
      title: "Soft Skills First",
      description: "We prioritize proactive communication, initiative, and critical thinking. That’s what truly makes a difference, backed by world-class hard skills."
    },
    {
      icon: <Compass size={28} className="text-white" />,
      title: "The Right Match",
      description: "Through our proprietary matching profile, we align talent to your leadership style — ensuring the right one-to-one fit."
    },
    {
      icon: <ShieldCheck size={28} className="text-white" />,
      title: "White-Glove Support",
      description: "Every client gets a dedicated Success Team monitoring performance and growth."
    },
    {
      icon: <MonitorSmartphone size={28} className="text-white" />,
      title: "Visibility Built In",
      description: "Talent gets access to productivity tools. Clients get a dashboard with real visibility into time, tasks, and outcomes."
    }
  ];

  return (
    <section className="py-24 bg-black text-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            What Makes BYGHires Different
          </h2>
          <p className="text-xl text-gray-300">
            Meet the core principles that set us apart, from how we match talent to how we support you long after the hire.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {diffs.map((diff, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-gray-900 p-8 rounded-2xl border border-gray-800 hover:border-red/50 transition-colors"
            >
              <div className="w-14 h-14 bg-red rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-red/20">
                {diff.icon}
              </div>
              <h3 className="text-xl font-bold mb-4">{diff.title}</h3>
              <p className="text-gray-400 leading-relaxed">{diff.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Decorative */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red/5 rounded-full blur-[100px] pointer-events-none" />
    </section>
  );
};

export default Differentiators;

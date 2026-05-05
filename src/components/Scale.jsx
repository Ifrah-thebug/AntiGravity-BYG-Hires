import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Zap, Globe } from 'lucide-react';

const Scale = () => {
  const points = [
    {
      icon: <DollarSign size={24} />,
      title: "Cost Effective Scaling",
      description: "The same caliber of talent, at a fraction of the cost, because the cost of living is different, not the quality of the person."
    },
    {
      icon: <Zap size={24} />,
      title: "Frictionless Growth",
      description: "We provide ready-to-work talents that integrate into your workflow in 21 days or less. No visa issues, just pure momentum for your business."
    },
    {
      icon: <Globe size={24} />,
      title: "Global Talent Diversity",
      description: "Teams with different backgrounds see problems differently and think of different solutions."
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold text-black"
          >
            Scale more, <span className="text-red">with less.</span>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {points.map((point, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 bg-red/10 text-red rounded-xl flex items-center justify-center mb-6">
                {point.icon}
              </div>
              <h3 className="text-xl font-bold text-black mb-4">{point.title}</h3>
              <p className="text-gray-600 leading-relaxed">
                {point.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Scale;

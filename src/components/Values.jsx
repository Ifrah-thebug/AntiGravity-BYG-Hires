import React from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingDown, Users, Target } from 'lucide-react';

const Values = () => {
  const values = [
    {
      icon: <Zap size={32} className="text-red" />,
      title: "Scale Faster",
      description: "Hire top talent in as little as 10 days. We handle sourcing, vetting, and onboarding so you can expand without bottlenecks.",
    },
    {
      icon: <TrendingDown size={32} className="text-red" />,
      title: "Save Smarter",
      description: "Reduce costs by 60–70% while gaining top-tier offshore talent with both the hard and soft skills to thrive.",
    },
    {
      icon: <Target size={32} className="text-red" />,
      title: "Gain an Edge in the GCC Market",
      description: "Tap into exclusive talent pools specifically vetted for the Gulf region—professionals who understand your local business culture and objectives.",
    },
    {
      icon: <Users size={32} className="text-red" />,
      title: "Teams That Last",
      description: "Our proprietary alignment process ensures every hire is the right one-to-one match for your team's culture.",
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6 leading-tight">
              The Right Match, Every Time
            </h2>
            <p className="text-xl text-gray-800 mb-8 leading-relaxed">
              BYGHires helps you hire across departments — from day-to-day support to specialized roles. Whether you need one strategic player or an entire team, we’ll match you with talent that’s skilled, reliable, and ready to grow with your business.
            </p>
            <div className="inline-flex items-center gap-2 bg-gray-50 px-6 py-3 rounded-full border border-gray-200">
              <span className="text-2xl">💰</span>
              <span className="font-semibold text-black">Starting rate: <span className="text-red font-bold">500 USD / month</span></span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-6 bg-gray-50 rounded-2xl hover:bg-red/5 transition-colors group border border-transparent hover:border-red/10"
              >
                <div className="mb-4 bg-white w-14 h-14 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  {value.icon}
                </div>
                <h3 className="text-xl font-bold text-black mb-2">{value.title}</h3>
                <p className="text-gray-800">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Values;

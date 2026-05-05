import React from 'react';
import { motion } from 'framer-motion';
import { Target, Users, TrendingUp } from 'lucide-react';

const RemoteSalesTeamPage = () => {
  const benefits = [
    {
      icon: <Target className="text-red" size={32} />,
      title: "Hit Your Quotas",
      desc: "Our sales professionals are trained to hunt, close, and exceed targets consistently."
    },
    {
      icon: <Users className="text-red" size={32} />,
      title: "Cultural Alignment",
      desc: "Staff who understand your market and communicate effectively with your prospects."
    },
    {
      icon: <TrendingUp className="text-red" size={32} />,
      title: "Scale Fast",
      desc: "Deploy a full sales team in as little as 14 days without the local hiring overhead."
    }
  ];

  return (
    <div className="bg-white min-h-screen pt-20">
      {/* Hero */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-extrabold text-black mb-6"
          >
            Scale Your Revenue with <span className="text-red">Remote Sales Experts</span>
          </motion.h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            Build a high-performing sales engine with pre-vetted professionals who specialize in lead generation, outbound sales, and account management.
          </p>
          <a href="#contact" className="bg-red text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-red-600 transition-colors shadow-lg shadow-red/20">
            Hire Your Sales Team
          </a>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            {benefits.map((benefit, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-8 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-6 flex justify-center">{benefit.icon}</div>
                <h3 className="text-xl font-bold mb-4">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default RemoteSalesTeamPage;

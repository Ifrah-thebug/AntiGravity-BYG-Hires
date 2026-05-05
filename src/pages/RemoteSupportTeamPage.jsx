import React from 'react';
import { motion } from 'framer-motion';
import { Headphones, Heart, Clock } from 'lucide-react';

const RemoteSupportTeamPage = () => {
  const benefits = [
    {
      icon: <Headphones className="text-red" size={32} />,
      title: "24/7 Support",
      desc: "Ensure your customers are always taken care of, regardless of timezone."
    },
    {
      icon: <Heart className="text-red" size={32} />,
      title: "Empathy Driven",
      desc: "Support staff who genuinely care about solving customer problems and building loyalty."
    },
    {
      icon: <Clock className="text-red" size={32} />,
      title: "Immediate Deployment",
      desc: "Ready-to-work support professionals who can integrate into your tools instantly."
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
            Delight Your Customers with <span className="text-red">Remote Support Teams</span>
          </motion.h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            Professional customer success and technical support staff who integrate seamlessly into your workflow to provide world-class service.
          </p>
          <a href="#contact" className="bg-red text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-red-600 transition-colors shadow-lg shadow-red/20">
            Hire Your Support Team
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

export default RemoteSupportTeamPage;

import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Search, Users, Rocket } from 'lucide-react';

const HowItWorks = () => {
  const steps = [
    {
      num: "1",
      icon: <MessageSquare className="text-white" size={24} />,
      title: "Tell us what you need",
      desc: "One conversation. You outline the role, the skills, and the desired personality traits. We handle the rest."
    },
    {
      num: "2",
      icon: <Search className="text-white" size={24} />,
      title: "We pre-vet the candidate for you",
      desc: "We pre-vet every candidate so you receive only skilled, reliable, and role-ready talent that fits your business needs."
    },
    {
      num: "3",
      icon: <Users className="text-white" size={24} />,
      title: "Receive selected candidate profiles",
      desc: "You get a curated list of candidate profiles with an overview, work history, skills, and a video introduction, simplifying the hiring process, it's upto you to interview them or hire directly, rest assured."
    },
    {
      num: "4",
      icon: <Rocket className="text-white" size={24} />,
      title: "They're integrated and running in days",
      desc: "No long onboarding—our client success team gets your new hire ready fast. You brief us, we handle the rest."
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold text-black mb-6"
          >
            How <span className="text-red">it works</span>
          </motion.h2>
        </div>

        <div className="max-w-3xl mx-auto relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-12`}
            >
              {/* Timeline dot */}
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-white bg-red text-white font-bold text-lg shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                {step.icon}
              </div>

              {/* Content box */}
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-red/30 transition-all">
                <h3 className="font-bold text-black text-xl mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

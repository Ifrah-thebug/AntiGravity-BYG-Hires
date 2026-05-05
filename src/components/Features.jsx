import React from 'react';
import { motion } from 'framer-motion';
import { Search, UserCheck, Activity, FileText, Briefcase } from 'lucide-react';

const Features = () => {
  const features = [
    {
      icon: <Search className="text-red" size={24} />,
      title: "Sourcing & Vetting",
      description: "AI-powered + human screening for both skills and culture fit."
    },
    {
      icon: <UserCheck className="text-red" size={24} />,
      title: "Onboarding & Integration",
      description: "Seamless setup so Unicorns plug right into your workflows."
    },
    {
      icon: <Activity className="text-red" size={24} />,
      title: "Performance Monitoring",
      description: "Built-in accountability to keep Unicorns aligned and growing."
    },
    {
      icon: <FileText className="text-red" size={24} />,
      title: "Compliance & Payroll",
      description: "Hassle-free international hiring specifically tailored for the GCC region."
    },
    {
      icon: <Briefcase className="text-red" size={24} />,
      title: "Multi-Department Expertise",
      description: "From Admin to Ops to Marketing and beyond."
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            More Than Staffing — Your Unicorn Team, Fully Supported
          </h2>
          <p className="text-lg text-gray-800 max-w-3xl mx-auto">
            We don’t just fill roles. BYGHires provides end-to-end support — building teams with the skills, culture fit, and accountability to thrive long term.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 bg-red/10 rounded-xl flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-black mb-3">{feature.title}</h3>
              <p className="text-gray-800 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;

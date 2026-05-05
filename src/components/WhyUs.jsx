import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Users, RefreshCw, Zap, BarChart, Building, Briefcase } from 'lucide-react';

const WhyUs = () => {
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
            Why <span className="text-red">BYG Hires?</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-600 font-medium"
          >
            Your Partner in Regional Expansion and Operational Excellence
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* GCC Operational Advantage */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gray-50 p-8 md:p-10 rounded-3xl border border-gray-100"
          >
            <h3 className="text-2xl font-bold text-black mb-8 border-b-2 border-red inline-block pb-2">The GCC Operational Advantage</h3>
            
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-red/10 text-red flex items-center justify-center flex-shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-black mb-2">Localized Payments</h4>
                  <p className="text-gray-600 leading-relaxed">Pay in your own local currency within the GCC. We eliminate cross-border transaction friction by allowing you to settle invoices in Qatari Riyal, Saudi Riyal, or UAE Dirham.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-red/10 text-red flex items-center justify-center flex-shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-black mb-2">Simplified Payroll</h4>
                  <p className="text-gray-600 leading-relaxed">We handle all worldwide and local payroll complexities, ensuring your remote team is paid on time, hassle-free.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-red/10 text-red flex items-center justify-center flex-shrink-0">
                  <RefreshCw size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-black mb-2">Replacement Staffs</h4>
                  <p className="text-gray-600 leading-relaxed">The talent you hired didn't match your expectations in the probation period? Replacements guaranteed.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Expanded Service Offerings */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-8 md:p-10 rounded-3xl"
          >
            <h3 className="text-2xl font-bold mb-8 border-b-2 border-red inline-block pb-2">Expanded Service Offerings</h3>
            <p className="text-lg text-gray-300 font-bold mb-8">360-degree Business Growth System</p>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-red text-white flex items-center justify-center flex-shrink-0">
                  <Zap size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1">AI Automations</h4>
                  <p className="text-gray-400">Boost productivity with AI workflows.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-red text-white flex items-center justify-center flex-shrink-0">
                  <BarChart size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1">Social Media Marketing</h4>
                  <p className="text-gray-400">GCC-focused digital strategy.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-red text-white flex items-center justify-center flex-shrink-0">
                  <Building size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1">Company Formation</h4>
                  <p className="text-gray-400">Set up a business in Qatar, Saudi Arabia or UAE.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-red text-white flex items-center justify-center flex-shrink-0">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1">Business Consultancy</h4>
                  <p className="text-gray-400">Expert regional guidance with 50+ years of family business legacy.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default WhyUs;

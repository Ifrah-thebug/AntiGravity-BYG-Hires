import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Clock, CheckCircle2, User, Mail, Briefcase, BarChart } from 'lucide-react';

const TalentPool = () => {
  const [activeTab, setActiveTab] = useState('Operations');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    experience: ''
  });

  const steps = [
    {
      id: '01',
      label: 'DECLARE',
      title: 'Tell us what your expertise is',
      desc: 'Select your function and experience level.',
      duration: '2 minutes'
    },
    {
      id: '02',
      label: 'PROVE',
      title: 'Complete a task',
      desc: 'We give you a real client scenario. You solve it. Your output is your application.',
      duration: '15-30 minutes'
    },
    {
      id: '03',
      label: 'DEPLOY',
      title: 'Get referred',
      desc: 'Top performers are presented to active clients.',
      duration: 'Placement ready'
    }
  ];

  const assessments = {
    'Operations': {
      level: 'MID-LEVEL',
      time: '25 min',
      title: "Your client's fulfillment ops just broke. Fix it.",
      desc: "A tour operator managing 40+ daily bookings has noticed a 30% no-show rate over the past 2 weeks. Guides are reporting guests arriving at the wrong pickup point. The ops manager is on leave. You have been handed the comma inbox, a spreadsheet of bookings, and a WhatsApp group. What went wrong, and what do you right now?",
      checklist: [
        "Diagnose the root cause in 3 sentences or fewer.",
        "Draft the guest message you'd send in the next 60 minutes.",
        "Outline the SOP change you'd implement to prevent recurrence."
      ]
    },
    'Customer Success': {
      level: 'SENIOR',
      time: '30 min',
      title: "High-value client is threatening to churn. Save them.",
      desc: "A SaaS enterprise client ($50k ARR) has missed their last three onboarding calls and just sent an email saying they don't see the value. Their primary stakeholder just left the company. You have 24 hours to turn this around. What is your strategy?",
      checklist: [
        "Identify the immediate risk factors.",
        "Draft a high-stakes re-engagement email.",
        "Propose a 30-day success plan to the new stakeholder."
      ]
    },
    'Marketing': {
      level: 'MID-LEVEL',
      time: '20 min',
      title: "Ad performance just tanked. Optimize it.",
      desc: "Your primary Meta ad campaign was crushing it with a 4x ROAS. Suddenly, CPC has doubled and conversion rate dropped by 50% overnight. The budget is $500/day. You need to present a fix to the founder in 2 hours.",
      checklist: [
        "Audit the funnel for potential breaking points.",
        "Suggest 3 immediate creative or targeting pivots.",
        "Draft a brief report explaining the variance."
      ]
    },
    'Executive Assistant': {
      level: 'SENIOR',
      time: '20 min',
      title: "The Calendar Tetris: A CEO's nightmare.",
      desc: "The CEO is flying to Riyadh for a summit. Two investors just requested emergency 1:1s, the flight is delayed by 4 hours, and there's a conflicting board meeting. You need to reschedule the entire 48-hour block while maintaining 'founder presence'.",
      checklist: [
        "Prioritize the meetings based on business impact.",
        "Draft 'polite but firm' rescheduling messages.",
        "Build the updated itinerary including travel buffers."
      ]
    },
    'Data & Reporting': {
      level: 'MID-LEVEL',
      time: '35 min',
      title: "Clean the mess: Discrepancy in Q1 Sales.",
      desc: "The CRM shows $1.2M in sales, but the payment gateway only processed $1.05M. There are 200+ transactions to reconcile. You have a messy CSV export and a deadline of 'yesterday'. How do you find the gap?",
      checklist: [
        "Outline the data reconciliation workflow.",
        "Identify the most likely causes of discrepancy.",
        "Create a simple dashboard mockup to track this live."
      ]
    }
  };

  const stats = [
    { value: '14', label: 'Days avg. placement' },
    { value: '94%', label: 'Client retention rate' },
    { value: '300+', label: 'Talent placed to date' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-white text-black min-h-screen font-sans overflow-hidden">
      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6 bg-black text-white">
        <div className="max-w-7xl mx-auto">
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red font-bold tracking-[0.2em] text-[10px] mb-8 uppercase"
          >
            JOIN THE TALENT POOL
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative inline-block mb-12"
          >
            <h1 className="text-6xl md:text-8xl font-bold mb-4 leading-[1.1] text-white">
              Prove your craft.<br />
              <span className="text-red">Skip the queue.</span>
            </h1>
            <div className="w-20 h-1.5 bg-red mt-4" />
          </motion.div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-500 max-w-2xl text-xl leading-relaxed font-normal"
          >
            No resume roulette. Complete a real-world task assessment, get scored, and get referred to our active clients.
          </motion.p>
        </div>
      </section>

      {/* 3-Step Grid Section */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <div 
                key={idx}
                className="p-12 border border-gray-200 rounded-3xl bg-white flex flex-col items-center text-center shadow-sm"
              >
                <p className="text-red font-bold text-xs mb-8 tracking-widest uppercase">STEP {idx + 1}</p>
                <h3 className="text-3xl font-bold mb-6 text-black">{step.label}</h3>
                <p className="text-gray-700 text-lg mb-10 leading-relaxed">{step.desc}</p>
                <div className="mt-auto px-6 py-2 bg-black text-white text-[11px] font-bold rounded-full">
                  {step.duration}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider Section - Scrolling Marquee */}
      <section className="py-24 bg-white border-y border-gray-200 overflow-hidden relative">
        <div className="flex whitespace-nowrap">
          <motion.div 
            animate={{ x: [0, -1030] }}
            transition={{ 
              duration: 20, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="flex gap-12"
          >
            {[...Array(6)].map((_, i) => (
              <h2 key={i} className="text-[6.5vw] font-black text-red/50 tracking-tighter uppercase select-none leading-none">
                STAND OUT WITH YOUR SKILLS ★
              </h2>
            ))}
          </motion.div>
          <motion.div 
            animate={{ x: [0, -1030] }}
            transition={{ 
              duration: 20, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="flex gap-12"
          >
            {[...Array(6)].map((_, i) => (
              <h2 key={i} className="text-[6.5vw] font-black text-red/50 tracking-tighter uppercase select-none leading-none">
                STAND OUT WITH YOUR SKILLS ★
              </h2>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Sample Assessment Section */}
      <section className="py-12 bg-white text-black border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-10">
            <h2 className="text-3xl font-extrabold mb-3 text-black">Sample Assessments</h2>
            <p className="text-gray-600 font-medium text-base">See what it takes to join our elite talent pool.</p>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
            <div className="flex items-center gap-4">
              <span className="text-gray-500 font-bold text-xs tracking-widest uppercase">CHOOSE A ROLE</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(assessments).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2.5 rounded-md text-sm font-bold transition-all border ${
                    activeTab === tab 
                    ? 'bg-black border-black text-white' 
                    : 'border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl p-6 md:p-12 border border-gray-200 shadow-xl relative group overflow-hidden"
            >
              {/* Top Badges */}
              <div className="flex items-center gap-4 mb-6">
                <div className="px-4 py-1.5 bg-red text-white text-[11px] font-black rounded-lg">
                  {assessments[activeTab].time.toUpperCase()}
                </div>
                <div className="text-gray-500 font-bold text-xs tracking-widest uppercase">
                  REAL-WORLD SCENARIO
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-black mb-8">{activeTab} Lead Task</h2>

              <div className="grid lg:grid-cols-2 gap-8 items-start">
                {/* Left: The Scenario */}
                <div className="space-y-4">
                  <h3 className="text-black font-black text-xs tracking-widest uppercase opacity-60">THE SCENARIO</h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 md:p-8 relative">
                    <p className="text-gray-700 text-sm md:text-base leading-relaxed font-medium">
                      {assessments[activeTab].desc}
                    </p>
                  </div>
                </div>

                {/* Right: Deliverables */}
                <div className="flex flex-col h-full justify-between gap-8">
                  <div className="space-y-4">
                    <h3 className="text-red font-black text-xs tracking-widest uppercase">REQUIRED DELIVERABLES:</h3>
                    <div className="space-y-4">
                      {assessments[activeTab].checklist.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-4 group/item">
                          <div className="w-1.5 h-1.5 mt-2 rounded-full bg-black shrink-0" />
                          <p className="text-black text-sm md:text-base font-bold leading-tight">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={() => document.getElementById('application-form')?.scrollIntoView({ behavior: 'smooth' })}
                      className="w-full py-5 bg-black text-white font-black text-[10px] tracking-[0.1em] rounded-xl hover:bg-red transition-all duration-300 shadow-[0_10px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_20px_rgba(255,61,61,0.15)] uppercase"
                    >
                      START ASSESSMENT CHALLENGE
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>


      {/* Form Section */}
      <section id="application-form" className="py-24 bg-white text-black">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-6 text-black tracking-tight">Ready to bypass the resume pile?</h2>
            <p className="text-gray-600 font-medium text-xl">Enter your details to receive your initial assessment link.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-[2.5rem] p-8 md:p-10 shadow-[0_30px_100px_rgba(0,0,0,0.04)]">
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">FULL NAME</label>
                  <input 
                    type="text" 
                    name="firstName"
                    placeholder="John Doe"
                    className="w-full px-8 py-5 bg-gray-100/50 border border-gray-200 rounded-2xl focus:border-red focus:bg-white outline-none transition-all font-bold text-lg placeholder:text-gray-400"
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">EMAIL ADDRESS</label>
                  <input 
                    type="email" 
                    name="email"
                    placeholder="john@example.com"
                    className="w-full px-8 py-5 bg-gray-100/50 border border-gray-200 rounded-2xl focus:border-red focus:bg-white outline-none transition-all font-bold text-lg placeholder:text-gray-400"
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">PHONE NUMBER</label>
                <input 
                  type="tel" 
                  name="phone"
                  placeholder="+971 00 000 0000"
                  className="w-full px-8 py-5 bg-gray-100/50 border border-gray-200 rounded-2xl focus:border-red focus:bg-white outline-none transition-all font-bold text-lg placeholder:text-gray-400"
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">PRIMARY ROLE</label>
                <div className="relative">
                  <select 
                    name="role"
                    className="w-full px-8 py-5 bg-gray-100/50 border border-gray-200 rounded-2xl focus:border-red focus:bg-white outline-none transition-all font-bold text-lg appearance-none cursor-pointer text-gray-900"
                    onChange={handleInputChange}
                    defaultValue=""
                  >
                    <option value="" disabled>Select your expertise...</option>
                    {Object.keys(assessments).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronRight size={20} className="rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">YEARS OF EXPERIENCE</label>
                <div className="relative">
                  <select 
                    name="experience"
                    className="w-full px-8 py-5 bg-gray-100/50 border border-gray-200 rounded-2xl focus:border-red focus:bg-white outline-none transition-all font-bold text-lg appearance-none cursor-pointer text-gray-900"
                    onChange={handleInputChange}
                    defaultValue=""
                  >
                    <option value="" disabled>Select experience level...</option>
                    <option value="junior">1-3 Years</option>
                    <option value="mid">4-7 Years</option>
                    <option value="senior">8+ Years</option>
                  </select>
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronRight size={20} className="rotate-90" />
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button 
                  type="submit"
                  className={`w-full py-6 rounded-2xl font-black text-sm tracking-[0.2em] transition-all uppercase border-2 ${
                    formData.role && formData.experience 
                    ? 'border-red text-red bg-transparent hover:bg-red hover:text-white shadow-xl shadow-red/20 cursor-pointer' 
                    : 'border-red/30 text-red/30 bg-transparent cursor-not-allowed'
                  }`}
                  disabled={!formData.role || !formData.experience}
                >
                  APPLY & START ASSESSMENT
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Trust Footer Bar */}
      <div className="bg-white py-16 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-red font-black text-sm md:text-base tracking-[0.2em] uppercase mb-16">Trusted by remote-first companies in GCC</p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-24">
            <div className="flex flex-col items-center gap-4 group">
              <div className="w-14 h-14 rounded-full bg-red/5 border border-red/20 flex items-center justify-center text-red transition-transform group-hover:scale-110">
                <CheckCircle2 size={24} />
              </div>
              <span className="text-black font-bold text-sm tracking-tight text-center">Become a Skill<br/>First Hire</span>
            </div>
            <div className="flex flex-col items-center gap-4 group">
              <div className="w-14 h-14 rounded-full bg-red/5 border border-red/10 flex items-center justify-center text-red transition-transform group-hover:scale-110">
                <Briefcase size={24} />
              </div>
              <span className="text-black font-bold text-sm tracking-tight text-center">Match with<br/>Companies</span>
            </div>
            <div className="flex flex-col items-center gap-4 group">
              <div className="w-14 h-14 rounded-full bg-red/5 border border-red/10 flex items-center justify-center text-red transition-transform group-hover:scale-110">
                <Clock size={24} />
              </div>
              <span className="text-black font-bold text-sm tracking-tight text-center">Switch to a<br/>Remote Life</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TalentPool;

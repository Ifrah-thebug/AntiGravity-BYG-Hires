// src/components/TalentPool.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Briefcase, Clock, Sparkles } from 'lucide-react';

const TalentPool = () => {
  const navigate = useNavigate();

  const steps = [
    {
      id: '01',
      label: 'DECLARE',
      title: 'Define your expertise',
      desc: 'Select your primary role, upload your resume, and state your years of experience.',
      duration: '2 minutes'
    },
    {
      id: '02',
      label: 'DEMONSTRATE',
      title: 'Solve a real scenario',
      desc: 'Complete a tailored, 25-minute real-world client challenge. Your output is your application.',
      duration: '20-30 minutes'
    },
    {
      id: '03',
      label: 'DEPLOY',
      title: 'Get referred directly',
      desc: 'Qualified candidates are admitted to our pool and instantly visible to regional employers.',
      duration: 'Placed in the Talent Pool'
    }
  ];

  return (
    <div className="bg-white text-black min-h-screen font-sans overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-6 bg-black text-white overflow-hidden">
        {/* Decorative ambient lights */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-red rounded-full blur-[160px] opacity-20 -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red rounded-full blur-[140px] opacity-10 -ml-20 -mb-20"></div>

        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative z-10">
          <div className="flex-1 text-left">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-red font-black tracking-[0.2em] text-[10px] mb-8 uppercase"
            >
              <Sparkles size={12} />
              <span>JOIN THE BYG HIRES TALENT POOL</span>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative inline-block mb-8"
            >
              <h1 className="text-5xl md:text-8xl font-black mb-4 leading-[1.05] tracking-tight text-white uppercase">
                Prove your craft.<br />
                <span className="text-red">Skip the queue.</span>
              </h1>
              <div className="w-24 h-1.5 bg-red mt-6" />
            </motion.div>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-gray-400 max-w-xl text-lg md:text-xl leading-relaxed font-normal mb-12"
            >
              No resume roulette. Complete a real-world task assessment, get scored, and make your profile stronger with your score.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-4"
            >
              <button 
                onClick={() => navigate('/talent/signup')}
                className="px-10 py-5 bg-red text-white font-black text-sm tracking-[0.15em] rounded-2xl hover:bg-white hover:text-red transition-all duration-300 shadow-[0_10px_40px_rgba(255,74,74,0.35)] uppercase flex items-center gap-3"
              >
                <span>START APPLICATION</span>
                <ArrowRight size={16} />
              </button>
              <button 
                onClick={() => {
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-10 py-5 bg-transparent border-2 border-white/20 text-white hover:border-white font-black text-sm tracking-[0.15em] rounded-2xl transition-all uppercase"
              >
                How It Works
              </button>
            </motion.div>
          </div>

          {/* Right Hero Graphic: Simulated Assessment Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="flex-1 w-full max-w-lg lg:max-w-none"
          >
            <div className="bg-[#0e0e10] border border-gray-800 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="px-3 py-1 bg-red/10 border border-red/35 text-red text-[9px] font-black rounded uppercase tracking-wider">
                  25 min
                </div>
                <div className="px-3 py-1 bg-white/10 border border-white/10 text-gray-300 text-[9px] font-black rounded uppercase tracking-wider">
                  Skill-First Assessment
                </div>
              </div>
              
              <h3 className="text-xl md:text-2xl font-black text-white mb-4 uppercase tracking-wide">Fulfillment & Operations Challenge</h3>
              <p className="text-gray-400 text-xs md:text-sm leading-relaxed mb-6">
                "A tour operator managing 40+ daily bookings has noticed a 30% no-show rate over the past 2 weeks... Identify the operational bottlenecks and draft an SOP recovery plan."
              </p>

              <div className="space-y-3.5 border-t border-white/10 pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-red/15 text-red flex items-center justify-center font-bold text-[10px]">1</div>
                  <span className="text-[11px] font-bold text-gray-300">Diagnose the root bottleneck in 3 sentences</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-red/15 text-red flex items-center justify-center font-bold text-[10px]">2</div>
                  <span className="text-[11px] font-bold text-gray-300">Draft fleet coordination instructions</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-red/15 text-red flex items-center justify-center font-bold text-[10px]">3</div>
                  <span className="text-[11px] font-bold text-gray-300">Outline permanent geo-fencing SOPs</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Scrolling Marquee Divider */}
      <section className="py-16 bg-white border-y border-gray-100 overflow-hidden relative">
        <div className="flex whitespace-nowrap">
          <motion.div 
            animate={{ x: [0, -1000] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="flex gap-12"
          >
            {[...Array(6)].map((_, i) => (
              <h2 key={i} className="text-[5vw] font-black text-red/10 tracking-tighter uppercase select-none leading-none">
                DEMONSTRATE YOUR TALENT ★ WORK REMOTE ★ EARN IN USD ★ BYPASS THE Pile
              </h2>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 3-Step Grid Section */}
      <section id="how-it-works" className="py-32 px-6 bg-gray-50 text-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <p className="text-red font-bold text-xs tracking-widest uppercase mb-4">THE BYG QUALITY GATEWAY</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase">How It Works</h2>
            <p className="text-gray-500 font-medium mt-4">We replace standard recruitment forms with highly optimized skill-assessments designed to showcase your talent in action.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <div 
                key={idx}
                className="p-10 md:p-12 border border-gray-200 rounded-[2rem] bg-white flex flex-col items-center text-center shadow-sm hover:shadow-xl transition-all duration-300 relative group"
              >
                <div className="absolute top-6 left-6 font-mono text-[9px] font-black text-gray-300 group-hover:text-red transition-colors">
                  {step.id}
                </div>
                <p className="text-red font-black text-xs mb-8 tracking-[0.15em] uppercase">STEP {idx + 1}</p>
                <h3 className="text-2xl font-black mb-4 text-black uppercase">{step.label}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-8 font-medium">{step.desc}</p>
                <div className="mt-auto px-5 py-2 bg-gray-100 text-gray-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                  {step.duration}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 text-center">
            <button
              onClick={() => navigate('/talent/signup')}
              className="px-10 py-5 bg-black hover:bg-red text-white font-black text-sm tracking-[0.15em] rounded-2xl transition-all uppercase inline-flex items-center gap-3 shadow-lg shadow-black/10 hover:shadow-red/20"
            >
              <span>SUBMIT YOUR RESUME NOW</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Trust Footer Bar */}
      <div className="bg-white py-24 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-red font-black text-xs md:text-sm tracking-[0.2em] uppercase mb-16">
            A Regional Remote Staffing partner to GCC Companies
          </p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-24">
            <div className="flex flex-col items-center gap-4 group">
              <div className="w-14 h-14 rounded-2xl bg-red/5 border border-red/10 flex items-center justify-center text-red transition-all group-hover:scale-110 group-hover:bg-red group-hover:text-white">
                <CheckCircle2 size={24} />
              </div>
              <span className="text-black font-bold text-xs tracking-tight text-center leading-normal">Become a Skill First Placement</span>
            </div>
            <div className="flex flex-col items-center gap-4 group">
              <div className="w-14 h-14 rounded-2xl bg-red/5 border border-red/10 flex items-center justify-center text-red transition-all group-hover:scale-110 group-hover:bg-red group-hover:text-white">
                <Briefcase size={24} />
              </div>
              <span className="text-black font-bold text-xs tracking-tight text-center leading-normal">Match with GCC Clients</span>
            </div>
            <div className="flex flex-col items-center gap-4 group">
              <div className="w-14 h-14 rounded-2xl bg-red/5 border border-red/10 flex items-center justify-center text-red transition-all group-hover:scale-110 group-hover:bg-red group-hover:text-white">
                <Clock size={24} />
              </div>
              <span className="text-black font-bold text-xs tracking-tight text-center leading-normal">Transition to a Remote Career</span>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default TalentPool;

import React from 'react';
import { ArrowRight } from 'lucide-react';

const TalentBrowsePage = () => {
  return (
    <div className="pt-32 pb-24 min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-red font-bold tracking-[0.2em] text-[10px] mb-6 uppercase">
          Talent Browse
        </p>
        <h1 className="text-5xl md:text-7xl font-black text-black tracking-tight leading-[1.05] mb-6">
          Browse and get matched<br />
          with <span className="text-red">best-fit talent</span>
        </h1>
        <p className="text-gray-500 text-xl font-medium max-w-2xl mx-auto mb-16 leading-relaxed">
          By role, availability, and monthly fee. Instantly.
        </p>
        <div className="inline-flex items-center gap-3 px-10 py-5 bg-black text-white font-black text-sm tracking-wide rounded-2xl">
          More coming soon <ArrowRight size={18} />
        </div>
      </div>
    </div>
  );
};

export default TalentBrowsePage;

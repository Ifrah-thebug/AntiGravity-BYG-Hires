import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardCheck, ArrowLeft, Sparkles } from 'lucide-react';

export default function AssessmentComingSoonPage() {
  useEffect(() => {
    document.title = 'Skills assessment — Coming soon | BYG Hires';
    return () => {
      document.title = 'BYG Hires';
    };
  }, []);

  return (
    <div className="bg-white min-h-screen pt-28 pb-24">
      <div className="max-w-lg mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red text-white mb-6">
            <ClipboardCheck size={32} strokeWidth={2.25} />
          </div>
          <p className="text-red font-bold tracking-[0.2em] uppercase text-xs mb-3 flex items-center justify-center gap-2">
            <Sparkles size={12} />
            Phase 2
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-black tracking-tight mb-4">
            Skills assessment coming soon
          </h1>
          <p className="text-gray-600 font-medium leading-relaxed mb-10">
            We&apos;re building a real-world skills challenge so you can prove your expertise and stand out
            in client searches. You&apos;ll be notified when it&apos;s live.
          </p>
          <Link
            to="/portal"
            className="inline-flex items-center justify-center gap-2 bg-red hover:bg-black text-white font-bold px-8 py-4 rounded-full transition-colors border-2 border-red"
          >
            <ArrowLeft size={16} />
            Back to your portal
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

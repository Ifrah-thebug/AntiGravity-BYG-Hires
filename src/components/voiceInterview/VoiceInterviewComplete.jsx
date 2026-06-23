import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function VoiceInterviewComplete({ jobRole, onDone }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-8"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-600">
        <CheckCircle2 size={36} />
      </div>

      <div>
        <h2 className="text-3xl font-extrabold text-black tracking-tight">Interview complete</h2>
        <p className="text-gray-500 font-medium mt-2">
          Thank you for completing your AI voice interview
          {jobRole ? ` for ${jobRole}` : ''}.
        </p>
      </div>

      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-left max-w-md mx-auto">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
          What happens next
        </p>
        <p className="text-sm text-gray-700 font-medium leading-relaxed">
          Your responses have been recorded. Your interview score is being evaluated and will appear
          here shortly — usually within a couple of minutes.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="px-8 py-4 border-2 border-gray-200 text-gray-700 font-black text-xs uppercase tracking-widest rounded-2xl hover:border-black transition-colors"
          >
            View my score
          </button>
        )}
        <Link
          to="/portal"
          className="px-8 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-colors inline-flex items-center justify-center gap-2"
        >
          Back to portal <ArrowRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
}

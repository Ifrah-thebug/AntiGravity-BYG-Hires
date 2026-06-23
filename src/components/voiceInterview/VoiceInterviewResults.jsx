import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Mic, RefreshCw } from 'lucide-react';
import { scoreBadgeClass } from '../../lib/skillAssessmentDisplay';

const DIMENSION_LABELS = {
  experience: 'Experience & background',
  motivation: 'Motivation & role fit',
  communication: 'Communication & clarity',
  problem_solving: 'Problem solving & resilience',
  work_style_and_collaboration: 'Work style & collaboration',
};

function formatCompletedAt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function VoiceInterviewResults({
  result,
  attemptCount = 0,
  onRetake,
  onRefresh,
  refreshing = false,
  scorePending = false,
}) {
  const score = result?.interview_score;
  const dimensions = result?.dimensions || {};
  const dimensionEntries = Object.entries(dimensions).filter(([, value]) => value != null);
  const showProcessingBanner = scorePending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-black text-white">
          <Mic size={26} />
        </div>
        <p className="text-red font-bold tracking-[0.2em] uppercase text-xs">AI voice interview</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-black tracking-tight">
          Your latest interview score
        </h1>
        {result?.role_title && (
          <p className="text-gray-600 font-medium">{result.role_title}</p>
        )}
        {result?.completed_at && (
          <p className="text-[11px] text-gray-400 font-semibold">
            Completed {formatCompletedAt(result.completed_at)}
            {attemptCount > 1 ? ` · ${attemptCount} interviews on record` : ''}
          </p>
        )}
      </div>

      {showProcessingBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-3">
          <p className="text-sm font-bold text-amber-900">
            {score == null
              ? 'Your interview was recorded — score is being processed'
              : 'Your latest interview is being evaluated'}
          </p>
          <p className="text-xs text-amber-800/90 font-medium leading-relaxed">
            {score == null
              ? 'Evaluation usually takes a minute or two. Refresh to load your latest score.'
              : 'The score below is your previous result until the new evaluation is ready. Refresh in a minute or two.'}
          </p>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-red disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Checking…' : 'Refresh score'}
            </button>
          )}
        </div>
      )}

      {score != null && (
        <div className="text-center">
          <div className={`inline-block px-8 py-6 rounded-3xl border-2 ${scoreBadgeClass(score)}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">
              Interview score
            </p>
            <p className="text-5xl font-black">
              {score}
              <span className="text-2xl">/100</span>
            </p>
          </div>
        </div>
      )}

      {result?.interview_summary && (
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-left">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
            Overall feedback
          </p>
          <p className="text-gray-700 font-medium leading-relaxed">{result.interview_summary}</p>
        </div>
      )}

      {dimensionEntries.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            How you were scored
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {dimensionEntries.map(([key, value]) => (
              <div key={key} className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex justify-between items-baseline gap-2">
                  <p className="text-xs font-black text-black">
                    {DIMENSION_LABELS[key] || key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm font-black text-red">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="px-6 py-4 border-2 border-gray-200 text-gray-700 font-black text-xs uppercase tracking-widest rounded-2xl hover:border-black transition-colors inline-flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh score'}
          </button>
        )}
        {onRetake && (
          <button
            type="button"
            onClick={onRetake}
            className="px-8 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-colors inline-flex items-center justify-center gap-2"
          >
            Retake AI interview <ArrowRight size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

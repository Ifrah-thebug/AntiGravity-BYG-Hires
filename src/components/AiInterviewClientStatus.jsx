import React from 'react';
import { CheckCircle2, Clock, Loader2, Mic, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { scoreBadgeClass } from '../lib/skillAssessmentDisplay';
import { AI_INTERVIEW_VERIFIED_THRESHOLD } from '../lib/talentVerification';

export function getAiInterviewClientPhase({ requested, hasCompleted, interviewScore }) {
  if (!requested) return 'idle';
  if (!hasCompleted) return 'waiting';
  if (interviewScore == null) return 'scoring';
  return 'completed';
}

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ phase, interviewScore, aiInterviewVerified }) {
  if (phase === 'waiting') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider">
        <Clock size={11} />
        Awaiting candidate
      </span>
    );
  }
  if (phase === 'scoring') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-800 text-[10px] font-black uppercase tracking-wider">
        <Loader2 size={11} className="animate-spin" />
        Scoring
      </span>
    );
  }
  if (phase === 'completed') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${scoreBadgeClass(interviewScore)}`}
      >
        <Mic size={11} />
        {interviewScore}/100
      </span>
    );
  }
  return null;
}

/** Client-facing AI interview progress (request intro panel + dashboard). */
export default function AiInterviewClientStatus({
  requested = false,
  hasCompleted = false,
  interviewScore = null,
  completedAt = null,
  aiInterviewVerified = false,
  talentName = null,
  talentId = null,
  variant = 'panel',
  onRefresh,
  refreshing = false,
}) {
  const phase = getAiInterviewClientPhase({ requested, hasCompleted, interviewScore });

  if (phase === 'idle') return null;

  const showRefresh = (phase === 'waiting' || phase === 'scoring') && onRefresh;

  if (variant === 'inline') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">
            AI interview
          </span>
          <StatusBadge
            phase={phase}
            interviewScore={interviewScore}
            aiInterviewVerified={aiInterviewVerified}
          />
          {aiInterviewVerified && (
            <span className="text-[10px] font-black uppercase tracking-wider text-violet-700">
              Verified
            </span>
          )}
          <span className="text-xs text-gray-500 font-medium">
            {phase === 'waiting' && 'Waiting for candidate'}
            {phase === 'scoring' && 'Score processing'}
            {phase === 'completed' &&
              `Completed${completedAt ? ` ${formatWhen(completedAt)}` : ''}`}
          </span>
        </div>
        {showRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-3xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-600/20 shrink-0">
            <Mic size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              AI voice interview
            </p>
            <p className="text-lg font-black text-black truncate">
              {talentName || 'Candidate'}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <StatusBadge
                phase={phase}
                interviewScore={interviewScore}
                aiInterviewVerified={aiInterviewVerified}
              />
              {aiInterviewVerified && (
                <span className="text-[10px] font-black uppercase tracking-wider text-violet-700">
                  Verified
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs font-medium mt-2 leading-relaxed">
              {phase === 'waiting' &&
                'Waiting for the candidate to complete the interview from their portal.'}
              {phase === 'scoring' &&
                'Interview recorded — score is usually ready within a minute or two.'}
              {phase === 'completed' &&
                `Completed ${formatWhen(completedAt)}.${aiInterviewVerified ? '' : ` Score above ${AI_INTERVIEW_VERIFIED_THRESHOLD} earns the verified badge on their profile.`}`}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          {talentId && (
            <Link
              to={`/request-intro?id=${encodeURIComponent(talentId)}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red transition-colors"
            >
              View candidate
            </Link>
          )}
          {showRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-2 space-y-3">
      <CheckCircle2 size={28} className="mx-auto text-green-600" />
      <div className="space-y-2">
        <p className="font-black text-sm text-gray-900">AI interview requested</p>
        <div className="flex justify-center">
          <StatusBadge
            phase={phase}
            interviewScore={interviewScore}
            aiInterviewVerified={aiInterviewVerified}
          />
        </div>
        {aiInterviewVerified && (
          <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">
            AI interview verified on profile
          </p>
        )}
        <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-sm mx-auto">
          {phase === 'waiting' &&
            'The candidate can take the interview from their portal. You will see their score here once it is ready.'}
          {phase === 'scoring' &&
            'The interview was recorded and is being evaluated. Refresh in a minute to load the score.'}
          {phase === 'completed' &&
            `Latest score: ${interviewScore}/100${completedAt ? ` · ${formatWhen(completedAt)}` : ''}. Proceed to schedule your intro call below when ready.`}
        </p>
        {showRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:border-red hover:text-red disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh status
          </button>
        )}
      </div>
    </div>
  );
}

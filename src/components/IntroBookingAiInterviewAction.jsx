import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Mic } from 'lucide-react';
import { fetchClientAiInterviewStatus, requestAiInterview } from '../services/voiceInterviewService';
import AiInterviewClientStatus, { getAiInterviewClientPhase } from './AiInterviewClientStatus';

/** Request / status for AI interview on a client dashboard intro booking row. */
export default function IntroBookingAiInterviewAction({
  talentId,
  talentName,
  clientEmail,
  activated = false,
  initialRequest = null,
  onUpdated,
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requested, setRequested] = useState(Boolean(initialRequest));
  const [completion, setCompletion] = useState({
    hasCompleted: Boolean(initialRequest?.hasCompleted),
    interviewScore: initialRequest?.interviewScore ?? null,
    completedAt: initialRequest?.completedAt || null,
    aiInterviewVerified: Boolean(initialRequest?.aiInterviewVerified),
  });
  const [error, setError] = useState('');

  const email = String(clientEmail || '').trim();

  const loadStatus = useCallback(
    async ({ silent = false } = {}) => {
      if (!talentId || !email || !activated) {
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError('');

      try {
        const data = await fetchClientAiInterviewStatus({ talentId, email });
        setRequested(Boolean(data?.requested));
        setCompletion({
          hasCompleted: Boolean(data?.hasCompleted),
          interviewScore: data?.interviewScore ?? null,
          completedAt: data?.completedAt || null,
          aiInterviewVerified: Boolean(data?.aiInterviewVerified || data?.talentAiInterviewVerified),
        });
      } catch (err) {
        if (!silent) setError(err.message || 'Could not load AI interview status.');
      } finally {
        if (!silent) setLoading(false);
        else setRefreshing(false);
      }
    },
    [talentId, email, activated]
  );

  useEffect(() => {
    if (initialRequest) {
      setRequested(true);
      setCompletion({
        hasCompleted: Boolean(initialRequest.hasCompleted),
        interviewScore: initialRequest.interviewScore ?? null,
        completedAt: initialRequest.completedAt || null,
        aiInterviewVerified: Boolean(initialRequest.aiInterviewVerified),
      });
      setLoading(false);
      return;
    }
    loadStatus();
  }, [initialRequest, loadStatus]);

  async function handleRequest() {
    if (!talentId || !activated || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      await requestAiInterview({ talentId });
      setRequested(true);
      await loadStatus({ silent: true });
      onUpdated?.();
    } catch (err) {
      setError(err.message || 'Could not send request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!talentId) return null;

  if (!activated) {
    return (
      <p className="text-xs text-gray-500 font-medium leading-relaxed mt-4 pt-4 border-t border-gray-100">
        Activate your hiring client account to request an AI voice interview for this candidate from
        your dashboard.
      </p>
    );
  }

  const phase = getAiInterviewClientPhase({
    requested,
    hasCompleted: completion.hasCompleted,
    interviewScore: completion.interviewScore,
  });

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="h-10 rounded-xl bg-gray-50 animate-pulse" aria-hidden />
      </div>
    );
  }

  if (requested && phase !== 'idle') {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <AiInterviewClientStatus
          variant="inline"
          requested
          hasCompleted={completion.hasCompleted}
          interviewScore={completion.interviewScore}
          completedAt={completion.completedAt}
          aiInterviewVerified={completion.aiInterviewVerified}
          talentName={talentName}
          onRefresh={async () => {
            await loadStatus({ silent: true });
            onUpdated?.();
          }}
          refreshing={refreshing}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
      {error && (
        <p className="text-xs font-semibold text-red">{error}</p>
      )}
      <button
        type="button"
        onClick={handleRequest}
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red disabled:opacity-70 transition-colors"
      >
        {submitting ? (
          <>
            <Loader2 size={14} className="animate-spin shrink-0" />
            Sending…
          </>
        ) : (
          <>
            <Mic size={14} className="shrink-0" />
            Request AI interview
          </>
        )}
      </button>
    </div>
  );
}

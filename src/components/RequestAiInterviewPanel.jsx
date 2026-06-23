import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Loader2, Mic } from 'lucide-react';
import { fetchClientAiInterviewStatus, requestAiInterview } from '../services/voiceInterviewService';
import AiInterviewClientStatus from './AiInterviewClientStatus';
import AiInterviewVerifiedBadge from './AiInterviewVerifiedBadge';

export default function RequestAiInterviewPanel({
  talent,
  clientEmail,
  canRequestAiInterview,
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requested, setRequested] = useState(false);
  const [completion, setCompletion] = useState({
    hasCompleted: false,
    interviewScore: null,
    completedAt: null,
    aiInterviewVerified: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const email = String(clientEmail || '').trim();

  const loadStatus = useCallback(
    async ({ silent = false } = {}) => {
      if (!talent?.id || !email || !canRequestAiInterview) {
        setLoading(false);
        setRequested(false);
        setCompletion({
          hasCompleted: false,
          interviewScore: null,
          completedAt: null,
          aiInterviewVerified: false,
        });
        return;
      }

      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const data = await fetchClientAiInterviewStatus({ talentId: talent.id, email });
        setRequested(Boolean(data?.requested));
        setCompletion({
          hasCompleted: Boolean(data?.hasCompleted),
          interviewScore: data?.interviewScore ?? null,
          completedAt: data?.completedAt || null,
          aiInterviewVerified: Boolean(data?.aiInterviewVerified || data?.talentAiInterviewVerified),
        });
      } catch {
        if (!silent) setRequested(false);
      } finally {
        if (!silent) setLoading(false);
        else setRefreshing(false);
      }
    },
    [talent?.id, email, canRequestAiInterview]
  );

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleRequest() {
    if (!talent?.id || !canRequestAiInterview) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const data = await requestAiInterview({ talentId: talent.id });

      setRequested(true);
      setSuccess(
        data.duplicate
          ? 'You have already requested an AI interview for this candidate.'
          : 'AI interview requested. The candidate will be notified by email.'
      );
      await loadStatus({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not send request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!talent?.isReal) return null;

  const showInitialLoading = canRequestAiInterview && loading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden mb-6"
    >
      <div className={`px-4 py-4 sm:px-8 sm:py-6 ${canRequestAiInterview ? 'border-b border-gray-100' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black text-red uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
              <Mic size={12} /> Step 1
            </p>
            <h3 className="font-black text-base sm:text-lg uppercase tracking-wide text-gray-900">
              Request AI interview
            </h3>
            <p className="text-gray-500 text-sm font-medium mt-1 leading-relaxed">
              Activated hiring clients can ask the candidate to complete a voice AI interview before
              scheduling a live intro call.
            </p>
          </div>
          <AiInterviewVerifiedBadge talent={talent} variant="light" />
        </div>
      </div>

      {canRequestAiInterview && (
        <div className="p-4 sm:p-8">
          <div className="min-h-[72px] flex flex-col justify-center space-y-4">
            {showInitialLoading ? (
              <div
                className="w-full h-14 rounded-2xl bg-gray-100 animate-pulse"
                aria-label="Loading request status"
              />
            ) : (
              <>
                {error && (
                  <div className="p-4 rounded-2xl bg-red/5 border border-red/20 text-red text-sm font-semibold flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="p-4 rounded-2xl bg-green-50 border border-green-200 text-green-800 text-sm font-semibold flex items-start gap-2">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                    <span>{success}</span>
                  </div>
                )}

                {requested ? (
                  <AiInterviewClientStatus
                    requested
                    hasCompleted={completion.hasCompleted}
                    interviewScore={completion.interviewScore}
                    completedAt={completion.completedAt}
                    aiInterviewVerified={completion.aiInterviewVerified}
                    onRefresh={() => loadStatus({ silent: true })}
                    refreshing={refreshing}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={handleRequest}
                    disabled={submitting}
                    className="w-full min-h-[56px] py-4 bg-black hover:bg-red disabled:opacity-70 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin shrink-0" />
                        <span>Sending request…</span>
                      </>
                    ) : (
                      <>
                        <Mic size={16} className="shrink-0" />
                        <span>Request AI interview</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

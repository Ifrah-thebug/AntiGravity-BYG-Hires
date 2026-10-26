import { useCallback, useState } from 'react';
import { supabase } from '@/core/api/supabase';
import { isNetworkError } from '@/core/api/http';
import { fetchAssessmentStatus } from '@/features/assessment/api/assessmentApi';
import { fetchVoiceInterviewStatus } from '@/features/interview/api/voiceInterviewApi';
import { fetchIntroSlotsPublished } from '@/features/intro/api/introApi';

const EMPTY_STATUS = {
  skillScores: {},
  assessmentDone: false,
  inProgressSkill: '',
  interviewUnlocked: false,
  interviewCompleted: false,
  introSlotsPublished: false,
};

/**
 * Loads the talent profile row plus skills-test / AI-interview / intro-slot status —
 * the same parallel fetches web PortalPage does in fetchProfile().
 * `load` resolves to the row, `null` when the user has no profile yet, or `undefined`
 * when it could not be loaded (offline / server error — `error` is set).
 */
export function usePortalData(user) {
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!user?.id) return null;
      if (!silent) setLoading(true);
      setError('');

      // Status calls don't need the profile row: start them alongside it.
      const assessmentReq = fetchAssessmentStatus().catch(() => null);
      const interviewReq = fetchVoiceInterviewStatus().catch(() => null);

      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchErr) {
        setError(
          isNetworkError(fetchErr)
            ? 'You appear to be offline. Check your connection and try again.'
            : fetchErr.message || 'Could not load your profile.'
        );
        setLoading(false);
        return undefined;
      }

      if (!data) {
        setProfile(null);
        setLoading(false);
        return null;
      }

      const [assessment, introPublished, interview] = await Promise.all([
        assessmentReq,
        fetchIntroSlotsPublished(data.id).catch(() => false),
        interviewReq,
      ]);

      setProfile(data);
      setStatus({
        skillScores: assessment?.skillScores || {},
        assessmentDone: (assessment?.assessedCount || 0) > 0,
        inProgressSkill: assessment?.activeSession?.skill || '',
        interviewUnlocked: Boolean(interview?.interviewUnlocked),
        interviewCompleted: Boolean(interview?.hasCompleted),
        introSlotsPublished: introPublished,
      });
      setLoading(false);
      return data;
    },
    [user?.id]
  );

  const setIntroSlotsPublished = useCallback((value) => {
    setStatus((s) => (s.introSlotsPublished === value ? s : { ...s, introSlotsPublished: value }));
  }, []);

  return { profile, setProfile, status, loading, error, setError, load, setIntroSlotsPublished };
}

// View Public Profile — exact same modal visitors see when opening a directory card.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useIsLoggedInTalent } from '../hooks/useIsLoggedInTalent';
import { isDirectoryLive } from '../lib/profileReview';
import { mapProfileToDirectoryTalent } from '../lib/liveDirectoryTalents';
import { fetchPublicSkillScores } from '../services/assessmentService';
import { fetchPublicAiInterviewBadges } from '../services/voiceInterviewService';
import { sanitizeTalentForPublicDisplay } from '../lib/talentVerification';
import DirectoryTalentModal from '../components/DirectoryTalentModal';

const TalentProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLoggedInTalent } = useIsLoggedInTalent();
  const canRequestIntro = !isLoggedInTalent;
  const [profile, setProfile] = useState(null);
  const [scoreMap, setScoreMap] = useState({});
  const [aiBadgeMap, setAiBadgeMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (err || !data) {
      setError('Profile not found.');
      setLoading(false);
      return;
    }

    const [scores, badges] = await Promise.all([
      fetchPublicSkillScores([data.id].filter(Boolean)),
      fetchPublicAiInterviewBadges([data.id]).catch(() => ({})),
    ]);
    setScoreMap(scores);
    setAiBadgeMap(badges);
    setProfile(data);
    setLoading(false);
  };

  const isOwner = Boolean(user?.id && profile?.user_id === user.id);
  const directoryLive = isDirectoryLive(profile?.directory_status);

  const directoryTalent = useMemo(() => {
    if (!profile) return null;
    const mapped = mapProfileToDirectoryTalent(profile, scoreMap, aiBadgeMap);
    return sanitizeTalentForPublicDisplay(mapped);
  }, [profile, scoreMap, aiBadgeMap]);

  if (loading) {
    return (
      <div className="bg-[#fafafa] min-h-screen pt-28 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red/20 border-t-red rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile || !directoryTalent) {
    return (
      <div className="bg-white min-h-screen pt-28 flex flex-col items-center justify-center text-center px-4">
        <p className="font-black text-gray-400 text-sm uppercase tracking-widest">
          {error || 'Profile not found'}
        </p>
        <button
          type="button"
          onClick={() => navigate(isOwner ? '/portal' : '/talent')}
          className="mt-6 px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red transition-colors"
        >
          {isOwner ? 'Back to portal' : 'Back to Directory'}
        </button>
      </div>
    );
  }

  const handleClose = () => navigate(isOwner ? '/portal' : '/talent');

  return (
    <div className="relative">
      {isOwner && (
        <div className="absolute top-24 left-0 right-0 z-10 px-4 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
            <div
              className={`rounded-2xl px-4 py-3 text-xs font-semibold border shadow-sm ${
                directoryLive
                  ? 'bg-white/95 border-green-200 text-green-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <p className="font-black uppercase tracking-wider text-[10px] mb-0.5">
                {directoryLive ? 'Public profile preview' : 'Preview only — not live yet'}
              </p>
              <p>
                {directoryLive
                  ? 'This is exactly what visitors see when they open your card on the public directory.'
                  : 'This is how your profile will look once approved. It is not on the public directory yet.'}{' '}
                <Link to="/portal" className="text-red font-black hover:underline">
                  Open portal
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      <DirectoryTalentModal
        talent={directoryTalent}
        onClose={handleClose}
        canRequestIntro={canRequestIntro && !isOwner}
        variant="page"
        footerExtra={
          isOwner ? (
            <Link
              to={`/talent/${profile.id}/portfolio`}
              className="flex-1 min-w-[10rem] py-4 bg-white border-2 border-black text-black hover:bg-black hover:text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-colors text-center flex items-center justify-center gap-2"
            >
              <Layers size={14} /> View Portfolio
            </Link>
          ) : null
        }
      />
    </div>
  );
};

export default TalentProfilePage;

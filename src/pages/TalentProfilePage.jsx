// src/pages/TalentProfilePage.jsx
// Individual public profile page — /talent/:id
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, ArrowRight, CheckCircle2, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDisplayName, formatFirstName } from '../lib/formatDisplayName';
import { useAuth } from '../context/AuthContext';
import { useIsLoggedInTalent } from '../hooks/useIsLoggedInTalent';
import { isDirectoryLive } from '../lib/profileReview';
import { fetchPublicSkillScores, buildTalentSkillScores } from '../services/assessmentService';
import { scoreBadgeClass } from '../lib/skillAssessmentDisplay';
import ProfileVerificationBadge from '../components/ProfileVerificationBadge';
import AiInterviewVerifiedBadge from '../components/AiInterviewVerifiedBadge';
import { SHOW_ASSESSMENT_SCORE, sanitizeTalentForPublicDisplay } from '../lib/talentVerification';
import { photoUrlForDisplay } from '../lib/talentStorage';

const TalentProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLoggedInTalent } = useIsLoggedInTalent();
  const canRequestIntro = !isLoggedInTalent;
  const [profile, setProfile] = useState(null);
  const [skillScores, setSkillScores] = useState({});
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
    } else {
      const scoreMap = await fetchPublicSkillScores([data.id].filter(Boolean));
      const aiBadgeMap = await fetchPublicAiInterviewBadges([data.id]).catch(() => ({}));
      const aiMeta = aiBadgeMap[data.id] || {};
      setProfile({
        ...data,
        aiInterviewVerified: Boolean(aiMeta.aiInterviewVerified),
        aiInterviewScore: aiMeta.interviewScore ?? null,
      });
      setSkillScores(buildTalentSkillScores(scoreMap, data.id, data.skills || []));
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen pt-28 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red/20 border-t-red rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-white min-h-screen pt-28 flex flex-col items-center justify-center text-center px-4">
        <p className="font-black text-gray-400 text-sm uppercase tracking-widest">{error || 'Profile not found'}</p>
        <button onClick={() => navigate('/talent')} className="mt-6 px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red transition-colors">
          Back to Directory
        </button>
      </div>
    );
  }

  const { id: profileId, name, job_title, about, skills, experience_years, photo_url, best_skill } = profile;
  const displayPhotoUrl = photoUrlForDisplay(photo_url, profile.updated_at || profile.created_at);
  const displayTalent = sanitizeTalentForPublicDisplay({
    bestSkill: best_skill || skills?.[0],
    tags: skills || [],
    skillScores,
    aiInterviewVerified: profile.aiInterviewVerified,
    aiInterviewScore: profile.aiInterviewScore,
  });
  const displayName = formatDisplayName(name);
  const firstName = formatFirstName(name);
  const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  const hue = name ? (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360 : 200;

  const isOwner = Boolean(user?.id && profile?.user_id === user.id);
  const directoryLive = isDirectoryLive(profile?.directory_status);

  return (
    <div className="bg-white min-h-screen pt-24 pb-24 font-sans">
      {/* Back button */}
      <div className="max-w-4xl mx-auto px-6 mb-8">
        <button
          onClick={() => navigate('/talent')}
          className="inline-flex items-center gap-2 text-xs font-black text-gray-400 hover:text-black uppercase tracking-widest transition-colors"
        >
          <ArrowLeft size={13} /> Back to Directory
        </button>
      </div>

      {isOwner && !directoryLive && (
        <div className="max-w-4xl mx-auto px-6 mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-semibold text-amber-900">
            <p className="font-black uppercase tracking-wider text-[10px] mb-1">Preview only</p>
            <p>
              This is how your profile will look once approved. It is not visible on the public directory yet.{' '}
              <Link to="/portal" className="text-red font-black hover:underline">Open portal</Link>
            </p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 space-y-8">
        {/* ── Profile Header Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="bg-black text-white rounded-[2.5rem] overflow-hidden relative"
        >
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-red rounded-full blur-[160px] opacity-20 -mr-32 -mt-32 pointer-events-none" />

          <div className="relative z-10 p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-start gap-8">
              {/* Photo */}
              <div className="shrink-0">
                {displayPhotoUrl ? (
                  <img
                    src={displayPhotoUrl} alt={name}
                    className="w-40 h-40 md:w-48 md:h-48 rounded-3xl object-cover object-top border-2 border-white/10 shadow-2xl"
                  />
                ) : (
                  <div
                    className="w-40 h-40 md:w-48 md:h-48 rounded-3xl flex items-center justify-center text-white font-black text-5xl border-2 border-white/10 shadow-2xl"
                    style={{ background: `linear-gradient(135deg, hsl(${hue},55%,42%), hsl(${hue + 40},60%,32%))` }}
                  >
                    {initials}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 space-y-4">
                <ProfileVerificationBadge talent={displayTalent} variant="dark" />
                <AiInterviewVerifiedBadge talent={displayTalent} variant="dark" />
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight" title={name}>{displayName}</h1>
                  <p className="text-red font-bold text-base uppercase tracking-wider mt-1">{job_title}</p>
                </div>
                {experience_years > 0 && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm font-semibold">
                    <Briefcase size={14} />
                    <span>{experience_years} years of experience</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Body Grid ── */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* About */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="md:col-span-2 bg-white border border-gray-100 rounded-3xl p-8 space-y-4"
          >
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">About</p>
            <p className="text-gray-700 text-base font-medium leading-relaxed">
              {about || 'No bio provided yet.'}
            </p>
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="space-y-4"
          >
            {/* Experience */}
            <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Experience</p>
              <p className="font-black text-gray-900 text-2xl">{experience_years}<span className="text-base font-bold text-gray-400 ml-1">yrs</span></p>
            </div>

            {canRequestIntro && (
              <div className="bg-black rounded-3xl p-6 space-y-4">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Interested?</p>
                <p className="text-white font-bold text-sm leading-snug">Request a personal intro to this talent.</p>
                <Link
                  to={`/request-intro?id=${profileId}`}
                  className="block w-full py-3 bg-red hover:bg-white hover:text-black text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all text-center flex items-center justify-center gap-2"
                >
                  Request Intro <ArrowRight size={11} />
                </Link>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Skills ── */}
        {skills && skills.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white border border-gray-100 rounded-3xl p-8 space-y-4"
          >
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Skills & Expertise</p>
            <div className="flex flex-wrap gap-2">
              {skills.map(skill => {
                const score = skillScores[skill];
                return (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red/5 border border-red/10 text-red font-bold text-[11px] uppercase tracking-wide rounded-xl"
                  >
                    {skill}
                    {SHOW_ASSESSMENT_SCORE && score != null && (
                      <span className={`px-2 py-0.5 rounded-lg border text-[10px] ${scoreBadgeClass(score)}`}>
                        {score}/100
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Bottom CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="text-left">
            <p className="font-black text-black text-lg">Ready to bring {firstName} on board?</p>
            <p className="text-gray-500 text-sm font-medium mt-1">Let us make the introduction — we handle the matching process.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            {canRequestIntro && (
              <Link
                to={`/request-intro?id=${profileId}`}
                className="px-6 py-3.5 bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red transition-colors flex items-center gap-2"
              >
                Request Intro <ArrowRight size={12} />
              </Link>
            )}
            <button
              onClick={() => navigate('/talent')}
              className="px-6 py-3.5 bg-white border border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest rounded-xl hover:border-gray-400 transition-colors"
            >
              Browse More
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TalentProfilePage;

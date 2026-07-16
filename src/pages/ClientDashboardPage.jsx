import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight, Building2, Link as LinkIcon, AlertTriangle, Mic, Layers, CheckCircle2, Clock } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClientSchedulingTimezone } from '../hooks/useClientSchedulingTimezone';
import { formatIntroSlotSummary } from '../lib/clientSchedulingTimezone';
import IntroBookingAiInterviewAction from '../components/IntroBookingAiInterviewAction';
import AiInterviewClientStatus from '../components/AiInterviewClientStatus';
const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

async function parseApiJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Invalid response from server.');
  }
}

export default function ClientDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { timeZone, timeZoneLabel } = useClientSchedulingTimezone();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [aiInterviewRequests, setAiInterviewRequests] = useState([]);
  const [portfolioAccessRequests, setPortfolioAccessRequests] = useState([]);

  const [companyDraft, setCompanyDraft] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  const canSave = useMemo(() => {
    if (!profile) return false;
    const current = String(profile.company || '').trim();
    const next = String(companyDraft || '').trim();
    return current !== next;
  }, [profile, companyDraft]);

  const aiRequestByTalentId = useMemo(() => {
    const map = {};
    for (const req of aiInterviewRequests) {
      if (req.talentId && !map[req.talentId]) {
        map[req.talentId] = req;
      }
    }
    return map;
  }, [aiInterviewRequests]);

  useEffect(() => {
    if (!authLoading && !user?.id) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user?.id, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const resp = await fetch(
          `${API_BASE}/api/client/dashboard/overview?userId=${encodeURIComponent(user.id)}`
        );
        const data = await parseApiJson(resp);
        if (!resp.ok || !data?.ok) {
          throw new Error(data?.error || 'Failed to load dashboard.');
        }

        if (cancelled) return;
        setProfile(data.profile || null);
        setBookings(data.bookings || []);
        setAiInterviewRequests(data.aiInterviewRequests || []);
        setPortfolioAccessRequests(data.portfolioAccessRequests || []);
        setCompanyDraft(data.profile?.company || '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  const reloadDashboard = useCallback(async () => {
    if (!user?.id) return;
    try {
      const resp = await fetch(
        `${API_BASE}/api/client/dashboard/overview?userId=${encodeURIComponent(user.id)}`
      );
      const data = await parseApiJson(resp);
      if (resp.ok && data?.ok) {
        setProfile(data.profile || null);
        setBookings(data.bookings || []);
        setAiInterviewRequests(data.aiInterviewRequests || []);
        setPortfolioAccessRequests(data.portfolioAccessRequests || []);
      }
    } catch {
      // keep existing data on refresh failure
    }
  }, [user?.id]);

  // Auto-refresh while any portfolio request is still pending.
  useEffect(() => {
    const hasPending = portfolioAccessRequests.some((r) => r.pending || r.status === 'pending');
    if (!hasPending || !user?.id) return undefined;
    const timer = setInterval(() => {
      reloadDashboard();
    }, 8000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') reloadDashboard();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [portfolioAccessRequests, user?.id, reloadDashboard]);

  async function saveCompany() {
    if (!user?.id) return;
    setSavingCompany(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/client/dashboard/company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          company: companyDraft.trim() || null,
        }),
      });

      const data = await parseApiJson(resp);
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || 'Could not update company.');
      }

      setProfile((p) => (p ? { ...p, company: data.company } : p));
    } catch (err) {
      setError(err.message || 'Could not update company.');
    } finally {
      setSavingCompany(false);
    }
  }

  if (!user && !loading) {
    return (
      <div className="bg-white min-h-screen pt-20 pb-24 px-4 font-sans flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-3">
            Client Portal
          </p>
          <h1 className="text-3xl font-black text-black tracking-tight mb-3">Log in to continue</h1>
          <p className="text-gray-500 text-sm font-medium mb-6">
            Your client dashboard appears here after you activate your account.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-7 py-3.5 text-white font-black text-xs uppercase tracking-widest hover:bg-red transition-colors"
          >
            Client Login <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pt-20 pb-24 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-3">
            Client Portal
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight">
            Your upcoming calls
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-2">
            Discovery calls and talent intros — times in your local timezone ({timeZoneLabel})
          </p>
        </motion.div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-14 h-14 border-4 border-red/20 border-t-red rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold mb-6">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-6 md:p-8 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-red/5 border border-red/10 flex items-center justify-center text-red">
                  <Building2 size={18} />
                </div>

                <div className="flex-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Company name
                  </p>
                  <p className="text-sm text-gray-600 font-medium mb-3">
                    Edit your company name used for intro scheduling.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                    <input
                      type="text"
                      value={companyDraft}
                      onChange={(e) => setCompanyDraft(e.target.value)}
                      placeholder="e.g. BYG Ventures"
                      className="flex-1 px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red outline-none"
                    />
                    <button
                      type="button"
                      onClick={saveCompany}
                      disabled={!canSave || savingCompany}
                      className={`px-7 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                        canSave && !savingCompany
                          ? 'bg-black text-white hover:bg-red cursor-pointer'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {savingCompany ? 'Saving…' : 'Save'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div id="portfolio-requests" className="mb-8 scroll-mt-28">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-red" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">
                    Portfolio requests
                  </h2>
                </div>
                {portfolioAccessRequests.some((r) => r.pending || r.status === 'pending') && (
                  <button
                    type="button"
                    onClick={reloadDashboard}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
                  >
                    Refresh
                  </button>
                )}
              </div>

              {portfolioAccessRequests.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-200 rounded-[2rem] p-8 text-center">
                  <Layers size={22} className="mx-auto text-gray-300 mb-3" />
                  <p className="font-black text-gray-700 text-sm">No portfolio requests yet</p>
                  <p className="text-gray-500 text-sm font-medium mt-2 max-w-md mx-auto">
                    When you request a talent&apos;s portfolio from their profile or intro page, it will appear here. After they approve, you can open it from this section.
                  </p>
                  <Link
                    to="/talent"
                    className="inline-flex items-center gap-2 mt-5 text-[10px] font-black uppercase tracking-widest text-red hover:text-black transition-colors"
                  >
                    Browse talent directory <ArrowRight size={12} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {portfolioAccessRequests.map((req) => {
                    const approved = req.approved || req.status === 'approved';
                    return (
                      <div
                        key={req.requestId}
                        className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-6 md:p-8"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                              {approved ? 'Access granted' : 'Waiting for talent'}
                            </p>
                            <p className="text-lg font-black text-black truncate">
                              {req.talentName || 'Talent portfolio'}
                            </p>
                            {req.talentRole && (
                              <p className="text-sm text-gray-500 font-medium mt-1 truncate">{req.talentRole}</p>
                            )}
                            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold">
                              {approved ? (
                                <span className="text-green-700 inline-flex items-center gap-1.5">
                                  <CheckCircle2 size={14} /> Approved — open from here anytime
                                </span>
                              ) : (
                                <span className="text-amber-700 inline-flex items-center gap-1.5">
                                  <Clock size={14} /> Pending approval (this list updates automatically)
                                </span>
                              )}
                            </p>
                          </div>
                          {approved && req.talentId ? (
                            <Link
                              to={`/talent/${req.talentId}/portfolio`}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red px-6 py-3.5 text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-colors shrink-0"
                            >
                              Open portfolio <ArrowRight size={14} />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={reloadDashboard}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-gray-700 font-black text-xs uppercase tracking-widest hover:border-black transition-colors shrink-0"
                            >
                              Check status
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {aiInterviewRequests.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Mic size={16} className="text-violet-600" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">
                    AI interview requests
                  </h2>
                </div>
                <div className="space-y-3">
                  {aiInterviewRequests.map((req) => (
                    <div
                      key={req.requestId}
                      className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-6 md:p-8"
                    >
                      <AiInterviewClientStatus
                        variant="card"
                        requested
                        hasCompleted={req.hasCompleted}
                        interviewScore={req.interviewScore}
                        completedAt={req.completedAt}
                        aiInterviewVerified={req.aiInterviewVerified}
                        talentName={req.talentName}
                        talentId={req.talentId}
                        onRefresh={reloadDashboard}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {bookings.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-14 h-14 mx-auto rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <Calendar size={22} className="text-red" />
                  </div>
                  <p className="mt-4 text-gray-700 font-black">No upcoming calls</p>
                  <p className="text-gray-500 text-sm font-medium mt-2">
                    Discovery calls and talent intros will appear here after you book.
                  </p>
                </div>
              )}

              {bookings.map((b) => {
                const summary = formatIntroSlotSummary(b.start, timeZone);
                const isDiscovery = b.type === 'discovery';
                return (
                  <div
                    key={`${b.type}-${b.id}`}
                    className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-6 md:p-8"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-12 h-12 rounded-3xl flex items-center justify-center shadow-md ${
                            isDiscovery
                              ? 'bg-red text-white shadow-red/20'
                              : 'bg-black text-white shadow-black/10'
                          }`}
                        >
                          <span className="font-black text-[10px]">
                            {isDiscovery ? 'DISC' : 'INT'}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                            {isDiscovery ? 'Discovery call' : b.title || 'Intro Interview'}
                          </p>
                          <p className="text-lg font-black text-black">
                            {isDiscovery
                              ? 'With BYG Hires'
                              : b.talentName
                                ? `With ${b.talentName}`
                                : 'With your talent'}
                          </p>
                          <p className="text-red font-black text-sm mt-1">{summary.dayLine}</p>
                          <p className="text-gray-600 text-sm font-semibold mt-2">
                            {summary.timeLine}
                          </p>
                        </div>
                      </div>

                      {b.meetingUrl && (
                        <a
                          href={b.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-red px-6 py-3.5 text-white font-black text-xs uppercase tracking-widest hover:bg-[#c41e1e] transition-colors"
                        >
                          Open meeting
                          <LinkIcon size={16} />
                        </a>
                      )}
                    </div>

                    {!isDiscovery && b.talentId && (
                      <IntroBookingAiInterviewAction
                        talentId={b.talentId}
                        talentName={b.talentName}
                        clientEmail={profile?.email}
                        activated={Boolean(profile?.activated)}
                        initialRequest={aiRequestByTalentId[b.talentId] || null}
                        onUpdated={reloadDashboard}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


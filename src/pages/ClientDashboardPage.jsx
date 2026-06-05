import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight, Building2, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClientSchedulingTimezone } from '../hooks/useClientSchedulingTimezone';
import { formatIntroSlotSummary } from '../lib/clientSchedulingTimezone';
import logo from '../assets/BYG Hires Logo.png';

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

  const [companyDraft, setCompanyDraft] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  const canSave = useMemo(() => {
    if (!profile) return false;
    const current = String(profile.company || '').trim();
    const next = String(companyDraft || '').trim();
    return current !== next;
  }, [profile, companyDraft]);

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
          <img src={logo} alt="BYG Hires" className="h-10 w-auto mx-auto mb-6" />
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
            Your upcoming interviews
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-2">
            Times shown in your local timezone ({timeZoneLabel})
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

            <div className="space-y-3">
              {bookings.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-14 h-14 mx-auto rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <Calendar size={22} className="text-red" />
                  </div>
                  <p className="mt-4 text-gray-700 font-black">No upcoming interviews</p>
                  <p className="text-gray-500 text-sm font-medium mt-2">
                    When you book an intro, it will appear here.
                  </p>
                </div>
              )}

              {bookings.map((b) => {
                const summary = formatIntroSlotSummary(b.start, timeZone);
                return (
                  <div
                    key={b.id}
                    className="bg-white border border-gray-200 rounded-[2rem] shadow-xl p-6 md:p-8"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-3xl bg-black text-white flex items-center justify-center shadow-md shadow-black/10">
                          <span className="font-black text-sm">INT</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                            {b.title || 'Intro Interview'}
                          </p>
                          <p className="text-lg font-black text-black">
                            {b.talentName ? `With ${b.talentName}` : 'With your talent'}
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


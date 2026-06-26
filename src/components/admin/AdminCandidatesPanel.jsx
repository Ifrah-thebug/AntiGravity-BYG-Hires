import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search,
  Download,
  FileText,
  X,
  Briefcase,
  Mail,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { fetchAllTalentsForAdmin, downloadTalentResume } from '../../lib/adminTalent';
import { STATUS_BADGE_CLASS, STATUS_LABELS } from '../../lib/profileReview';

const TalentDetailModal = ({ talent, onClose, onDownload }) => {
  if (!talent) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white rounded-[2.5rem] max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-black text-white p-8 relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-red rounded-full blur-[100px] opacity-20 -mr-16 -mt-16 pointer-events-none" />
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center"
            >
              <X size={16} />
            </button>
            <div className="flex gap-6 relative z-10">
              {talent.photo ? (
                <img
                  src={talent.photo}
                  alt=""
                  className="w-28 h-36 rounded-2xl object-cover border-2 border-white/20"
                />
              ) : (
                <div className="w-28 h-36 rounded-2xl bg-white/10 flex items-center justify-center text-3xl font-black">
                  {talent.displayName.charAt(0)}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-black tracking-tight">{talent.displayName}</h2>
                <p className="text-red font-bold text-sm mt-1">{talent.role}</p>
                <p className="text-gray-400 text-xs font-semibold mt-2 flex items-center gap-1">
                  <Mail size={10} /> {talent.email || '—'}
                </p>
                <p className="text-gray-400 text-xs font-semibold mt-1 flex items-center gap-1">
                  <Briefcase size={10} /> {talent.experience}
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">About</p>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">{talent.bio}</p>
            </div>
            {talent.tags.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {talent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 bg-red/5 border border-red/10 text-red font-bold text-[10px] uppercase rounded-xl"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/request-intro?id=${talent.id}`}
                className="flex-1 min-w-[160px] py-4 bg-red text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-black flex items-center justify-center gap-2"
              >
                Request intro <ArrowRight size={14} />
              </Link>
              <button
                type="button"
                onClick={() => onDownload(talent)}
                disabled={!talent.hasResume}
                className="flex-1 min-w-[140px] py-4 bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Download size={14} /> Download CV
              </button>
              {talent.photo && (
                <a
                  href={talent.photo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2"
                >
                  Photo <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const AdminCandidatesPanel = () => {
  const [talents, setTalents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setTalents(await fetchAllTalentsForAdmin());
    } catch (err) {
      setError(err.message || 'Failed to load candidates.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (talent) => {
    if (!downloadTalentResume(talent)) {
      setNotice('No CV on file for this candidate.');
      setTimeout(() => setNotice(''), 4000);
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return talents;
    return talents.filter((t) =>
      [t.displayName, t.email, t.role, t.bio, ...t.tags].join(' ').toLowerCase().includes(q)
    );
  }, [talents, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Browse candidates</h1>
        <p className="text-gray-500 text-sm font-medium mt-2">
          Full talent profiles, photos, and CVs from Supabase.{' '}
          <Link to="/admin/profile-reviews" className="text-red font-black hover:underline">
            Open profile reviews →
          </Link>
        </p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, role, skills…"
          className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold focus:border-red outline-none"
        />
      </div>

      {notice && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-sm font-semibold flex items-center gap-2">
          <AlertTriangle size={16} /> {notice}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl text-sm font-semibold">
          <p>{error}</p>
          <p className="text-xs mt-2 opacity-80">
            If this is a permission error, run <code className="font-mono">supabase/admins_complete_fix.sql</code> in
            Supabase.
          </p>
          <button type="button" onClick={load} className="mt-3 text-xs font-black uppercase underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-red/20 border-t-red rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
            {visible.length} candidate{visible.length !== 1 ? 's' : ''}
          </p>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {visible.map((talent) => (
              <div
                key={talent.id}
                className="bg-white border border-gray-100 rounded-3xl overflow-hidden hover:border-red/30 hover:shadow-lg transition-all"
              >
                <div
                  className="aspect-[4/5] bg-gray-50 relative cursor-pointer"
                  onClick={() => setSelected(talent)}
                >
                  {talent.photo ? (
                    <img src={talent.photo} alt="" className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-300">
                      {talent.displayName.charAt(0)}
                    </div>
                  )}
                  {talent.hasResume && (
                    <span className="absolute top-3 left-3 bg-white/95 text-[9px] font-black uppercase px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <FileText size={10} className="text-red" /> CV
                    </span>
                  )}
                  <span
                    className={`absolute top-3 right-3 text-[9px] font-black uppercase px-2 py-1 rounded-full border shadow-sm ${
                      STATUS_BADGE_CLASS[talent.directoryStatus] || STATUS_BADGE_CLASS.draft
                    }`}
                  >
                    {STATUS_LABELS[talent.directoryStatus] || talent.directoryStatus}
                  </span>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <p className="font-black text-sm">{talent.displayName}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-1">{talent.role}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-1">{talent.email}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      to={`/request-intro?id=${talent.id}`}
                      className="w-full py-2.5 bg-red text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-colors text-center flex items-center justify-center gap-1"
                    >
                      Request intro <ArrowRight size={12} />
                    </Link>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelected(talent)}
                        className="flex-1 py-2.5 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(talent)}
                        disabled={!talent.hasResume}
                        className="px-3 py-2.5 border border-gray-200 rounded-xl hover:border-red disabled:opacity-40"
                        title="Download CV"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {visible.length === 0 && !error && (
            <p className="text-center text-gray-400 font-bold py-16 uppercase text-xs tracking-widest">
              No candidates yet
            </p>
          )}
        </>
      )}

      <AnimatePresence>
        {selected && (
          <TalentDetailModal
            talent={selected}
            onClose={() => setSelected(null)}
            onDownload={handleDownload}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCandidatesPanel;

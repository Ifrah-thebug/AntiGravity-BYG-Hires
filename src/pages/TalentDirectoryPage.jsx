// src/pages/TalentDirectoryPage.jsx
// Public talent directory — fetches all profiles from Supabase
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import TalentProfileCard from '../components/TalentProfileCard';

const TalentDirectoryPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, name, job_title, skills, about, experience_years, photo_url')
      .order('created_at', { ascending: false });

    if (err) {
      setError('Failed to load talent profiles. Please try again.');
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  };

  const visible = profiles.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.job_title?.toLowerCase().includes(q) ||
      p.skills?.some(s => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-white min-h-screen pt-28 pb-24 font-sans text-black">
      {/* ── Hero Header ── */}
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-4">Talent Directory</p>
          <h1 className="text-5xl md:text-7xl font-black text-black tracking-tight leading-[1.05] mb-5">
            Meet the<br /><span className="text-red">talent pool.</span>
          </h1>
          <p className="text-gray-500 text-lg font-medium max-w-xl mx-auto leading-relaxed">
            Every profile here is a real, assessment-ready remote professional. Browse, find your match, and request an intro.
          </p>
        </motion.div>

        {/* Search */}
        <div className="max-w-xl mx-auto">
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, title, or skill…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-10 py-3.5 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-black transition-colors bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="max-w-7xl mx-auto px-6">
        {/* Count bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
            {loading ? 'Loading…' : `${visible.length} talent${visible.length !== 1 ? 's' : ''} found`}
          </p>
          <div className="flex items-center gap-2">
            <Users size={12} className="text-red" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Supabase-backed live directory</p>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-3xl overflow-hidden animate-pulse">
                <div className="w-full aspect-[4/5] bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                  <div className="h-2 bg-gray-100 rounded-full w-1/2" />
                  <div className="flex gap-1">
                    <div className="h-5 w-14 bg-gray-100 rounded-lg" />
                    <div className="h-5 w-14 bg-gray-100 rounded-lg" />
                  </div>
                  <div className="h-10 bg-gray-100 rounded-xl w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <p className="font-black text-red text-sm uppercase tracking-widest">{error}</p>
            <button onClick={fetchProfiles} className="mt-4 px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red transition-colors">
              Retry
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-24">
            <Search size={40} className="text-gray-200 mx-auto mb-4" />
            <p className="font-black text-gray-400 uppercase tracking-widest text-sm">No talent found</p>
            <p className="text-gray-400 text-xs font-medium mt-2">
              {search ? 'Try a different search.' : 'The talent directory is empty right now — be the first to join!'}
            </p>
            {!search && (
              <a href="/talent/signup" className="inline-block mt-6 px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red transition-colors">
                Join the Talent Pool
              </a>
            )}
            {search && (
              <button onClick={() => setSearch('')} className="mt-6 px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red transition-colors">
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
              {visible.map(profile => (
                <TalentProfileCard key={profile.id} profile={profile} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default TalentDirectoryPage;

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ChevronDown, ChevronUp, Loader2, Radio, X } from 'lucide-react';
import { fetchLiveJobs } from '../lib/liveJobsApi';

const ADVANCE_MS = 4800;
const WHEEL_COOLDOWN_MS = 420;
const ease = [0.22, 1, 0.36, 1];
/** How many peek cards above/below the focused job when filling the plate. */
const PEEK = 2;

function JobCard({ job, onSelect, onApply, compact = false, depth = 0, dark = false }) {
  const faded = compact ? Math.min(0.42 + depth * 0.12, 0.72) : 1;
  const scale = compact ? 0.94 - depth * 0.02 : 1;

  return (
    <motion.div
      layout
      whileHover={{ y: compact ? -1 : -2 }}
      onClick={compact ? () => onSelect?.(job) : undefined}
      role={compact ? 'button' : undefined}
      tabIndex={compact ? 0 : undefined}
      onKeyDown={
        compact
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(job);
              }
            }
          : undefined
      }
      style={{ opacity: faded, scale }}
      className={`relative w-full text-left rounded-2xl border overflow-hidden transition-[box-shadow] ${
        dark
          ? compact
            ? 'bg-white/[0.06] border-white/10 shadow-none px-3 py-2.5 cursor-pointer'
            : 'bg-white/[0.09] border-red shadow-xl shadow-red/25 ring-2 ring-red/30 px-4 py-3.5'
          : compact
            ? 'bg-white border-black/10 shadow-sm px-3 py-2.5 cursor-pointer'
            : 'bg-white border-red shadow-xl shadow-red/15 ring-2 ring-red/20 px-4 py-3.5'
      }`}
    >
      {!compact ? <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-red" /> : null}
      <div
        className={`relative w-full text-left ${compact ? '' : 'cursor-pointer'}`}
        onClick={!compact ? () => onSelect?.(job) : undefined}
      >
        <div className={`flex items-center gap-1.5 mb-0.5 ${compact ? '' : 'pl-2'}`}>
          <Radio size={compact ? 8 : 10} className="text-red" />
          <span className={`font-black uppercase tracking-[0.16em] text-red ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
            Live
          </span>
        </div>
        <p
          className={`font-black leading-snug line-clamp-2 ${
            dark ? 'text-white' : 'text-black'
          } ${compact ? 'text-[11px]' : 'text-[15px] pl-2'}`}
        >
          {job.title}
        </p>
        <p
          className={`font-semibold truncate mt-0.5 ${
            dark ? 'text-white/55' : 'text-gray-600'
          } ${compact ? 'text-[10px]' : 'text-[11px] pl-2'}`}
        >
          {job.company}
        </p>
      </div>
      {!compact ? (
        <div className="relative mt-2.5 pl-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelect(job)}
            className="text-[9px] font-bold uppercase tracking-wider text-red/85 hover:text-red"
          >
            Details →
          </button>
          {job.url ? (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red text-white text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
            >
              Apply <ArrowUpRight size={11} />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onApply?.(job)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red text-white text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
            >
              Apply <ArrowUpRight size={11} />
            </button>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}

/** Vertical top→bottom job spotlight — denser stack when `fill`. */
export default function LiveJobsTicker({ limit = 28, fill = false, dark = false }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState(0);
  const [direction, setDirection] = useState('down');
  const [selected, setSelected] = useState(null);
  const [paused, setPaused] = useState(false);
  const wheelLock = useRef(0);
  const resumeTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchLiveJobs({ limit });
        if (!cancelled) {
          setJobs(data.jobs || []);
          setFocus(0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load jobs.');
          setJobs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  useEffect(() => {
    if (jobs.length < 2 || paused || selected) return undefined;
    const id = setInterval(() => {
      setDirection('down');
      setFocus((i) => (i + 1) % jobs.length);
    }, ADVANCE_MS);
    return () => clearInterval(id);
  }, [jobs.length, paused, selected]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    []
  );

  const n = jobs.length;
  const at = (i) => jobs[((i % n) + n) % n];
  const peekCount = fill && n >= 5 ? PEEK : n >= 3 ? 1 : 0;

  const above = [];
  const below = [];
  if (n > 1 && peekCount > 0) {
    for (let d = peekCount; d >= 1; d -= 1) {
      above.push({ job: at(focus - d), depth: d - 1, offset: -d });
    }
    for (let d = 1; d <= peekCount; d += 1) {
      const job = at(focus + d);
      // Avoid duplicate when list is tiny
      if (above.some((a) => a.job.id === job.id) || job.id === at(focus)?.id) continue;
      below.push({ job, depth: d - 1, offset: d });
    }
  }

  const current = n > 0 ? at(focus) : null;

  const bumpPause = () => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 5000);
  };

  const goPrev = () => {
    if (n < 2) return;
    setDirection('up');
    bumpPause();
    setFocus((i) => (i - 1 + n) % n);
  };

  const goNext = () => {
    if (n < 2) return;
    setDirection('down');
    bumpPause();
    setFocus((i) => (i + 1) % n);
  };

  const jumpTo = (offset) => {
    if (n < 2) return;
    setDirection(offset > 0 ? 'down' : 'up');
    bumpPause();
    setFocus((i) => ((i + offset) % n + n) % n);
  };

  const onWheel = (e) => {
    if (n < 2 || selected) return;
    const now = Date.now();
    if (now - wheelLock.current < WHEEL_COOLDOWN_MS) return;
    if (Math.abs(e.deltaY) < 6) return;
    wheelLock.current = now;
    if (e.deltaY > 0) goNext();
    else goPrev();
  };

  return (
    <div
      className={`relative flex flex-col ${
        fill ? 'h-full min-h-0' : 'h-full min-h-[20rem] lg:min-h-[26rem]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-red opacity-60"
              animate={{ scale: [1, 2.1, 1], opacity: [0.55, 0, 0.55] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red" />
          </span>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red">Live remote roles</p>
        </div>
        {n > 0 ? (
          <span className={`text-[10px] font-extrabold tabular-nums ${dark ? 'text-white/50' : 'text-gray-700'}`}>
            {focus + 1}/{n}
          </span>
        ) : null}
      </div>

      <div
        className="relative flex-1 flex gap-2 min-h-0"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onWheel={onWheel}
      >
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {loading ? (
            <div className={`flex-1 flex items-center justify-center ${dark ? 'text-white/40' : 'text-gray-500'}`}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : error && !jobs.length ? (
            <div className="flex-1 flex items-center justify-center px-2 text-center">
              <p className={`text-xs font-medium ${dark ? 'text-white/60' : 'text-gray-600'}`}>{error}</p>
            </div>
          ) : current ? (
            <div
              className={`flex flex-col items-stretch min-h-0 flex-1 ${
                fill ? 'justify-between gap-1.5' : 'justify-center gap-2'
              }`}
            >
              {n > 1 ? (
                <div className="flex justify-center shrink-0">
                  <button
                    type="button"
                    onClick={goPrev}
                    className={`w-7 h-7 rounded-full border shadow-sm flex items-center justify-center hover:text-red hover:border-red/40 ${
                      dark
                        ? 'bg-white/10 border-white/15 text-white/70'
                        : 'bg-white border-black/10 text-gray-700'
                    }`}
                    aria-label="Previous job"
                  >
                    <ChevronUp size={15} />
                  </button>
                </div>
              ) : null}

              <div className={`flex flex-col min-h-0 ${fill ? 'flex-1 justify-evenly gap-1.5' : 'gap-2'}`}>
                {above.map(({ job, depth, offset }) => (
                  <JobCard
                    key={`a-${job.id}-${offset}`}
                    job={job}
                    compact
                    depth={depth}
                    dark={dark}
                    onSelect={() => jumpTo(offset)}
                  />
                ))}

                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={current.id}
                    layout
                    initial={{ opacity: 0, y: direction === 'up' ? -14 : 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: direction === 'up' ? 8 : -8 }}
                    transition={{ duration: 0.24, ease }}
                    className="shrink-0"
                  >
                    <JobCard
                      job={current}
                      dark={dark}
                      onSelect={setSelected}
                      onApply={(job) => job.url && window.open(job.url, '_blank', 'noopener,noreferrer')}
                    />
                  </motion.div>
                </AnimatePresence>

                {below.map(({ job, depth, offset }) => (
                  <JobCard
                    key={`b-${job.id}-${offset}`}
                    job={job}
                    compact
                    depth={depth}
                    dark={dark}
                    onSelect={() => jumpTo(offset)}
                  />
                ))}
              </div>

              {n > 1 ? (
                <div className="flex justify-center shrink-0">
                  <motion.button
                    type="button"
                    onClick={goNext}
                    animate={{ y: [0, 3, 0] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                    className={`w-7 h-7 rounded-full border shadow-sm flex items-center justify-center hover:text-red hover:border-red/40 ${
                      dark
                        ? 'bg-white/10 border-white/15 text-white/70'
                        : 'bg-white border-black/10 text-gray-700'
                    }`}
                    aria-label="Next job"
                  >
                    <ChevronDown size={15} />
                  </motion.button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {n > 1 && !loading ? (
          <div className="hidden sm:flex flex-col items-center py-6 shrink-0 w-2">
            <div
              className={`relative flex-1 w-1 rounded-full overflow-hidden min-h-[10rem] ${
                dark ? 'bg-white/10' : 'bg-black/10'
              }`}
            >
              <motion.div
                className="absolute left-0 right-0 bg-red rounded-full"
                animate={{
                  top: `${(focus / Math.max(n - 1, 1)) * 85}%`,
                  height: '15%',
                }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              />
            </div>
            {n > 1 && !paused && !selected ? (
              <motion.div
                key={focus}
                className={`mt-2 w-1 h-8 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-black/10'}`}
              >
                <motion.div
                  className="w-full bg-red origin-top"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: ADVANCE_MS / 1000, ease: 'linear' }}
                />
              </motion.div>
            ) : null}
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {selected ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={`absolute inset-0 z-20 rounded-2xl shadow-2xl p-4 flex flex-col ${
              dark ? 'border border-white/10 bg-[#141414]' : 'border border-black/10 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className={`font-black text-sm leading-snug ${dark ? 'text-white' : 'text-black'}`}>
                  {selected.title}
                </p>
                <p className={`text-[11px] font-semibold mt-0.5 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                  {selected.company}
                  {selected.category ? ` · ${selected.category}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center hover:text-red ${
                  dark
                    ? 'bg-white/5 border-white/10 text-white/50'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <p
              className={`text-[12px] font-medium leading-relaxed flex-1 overflow-y-auto ${
                dark ? 'text-white/65' : 'text-gray-600'
              }`}
            >
              {selected.description ||
                'Open the listing for the full description, or join BYG to get placed with vetted remote roles.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selected.url ? (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black"
                >
                  Apply <ArrowUpRight size={12} />
                </a>
              ) : null}
              <Link
                to="/talent/signup"
                className={`inline-flex items-center px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest hover:border-red hover:text-red ${
                  dark
                    ? 'border-white/15 text-white/60'
                    : 'border-black/15 text-gray-600'
                }`}
              >
                Join BYG
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

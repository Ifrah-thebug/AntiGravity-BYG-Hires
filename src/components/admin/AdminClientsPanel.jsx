import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Building2,
  Mail,
  User,
  Calendar,
  X,
  ExternalLink,
  Video,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { fetchAdminClients, fetchAdminClientDetail } from '../../lib/adminClients';

const INTRO_STATUS_CLASS = {
  accepted: 'bg-green-50 text-green-700 border-green-100',
  confirmed: 'bg-green-50 text-green-700 border-green-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  canceled: 'bg-gray-100 text-gray-500 border-gray-200',
  rejected: 'bg-red/5 text-red border-red/10',
};

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatShortDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function introStatusClass(status) {
  const key = String(status || '').toLowerCase();
  return INTRO_STATUS_CLASS[key] || 'bg-gray-50 text-gray-600 border-gray-200';
}

function isUpcoming(intro) {
  const inactive = new Set(['cancelled', 'rejected', 'canceled']);
  if (inactive.has(String(intro.status || '').toLowerCase())) return false;
  return intro.startAt && new Date(intro.startAt).getTime() >= Date.now();
}

const ClientDetailModal = ({ clientId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [client, setClient] = useState(null);
  const [intros, setIntros] = useState([]);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchAdminClientDetail(clientId);
        if (cancelled) return;
        setClient(data.client);
        setIntros(data.intros || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load client.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [clientId]);

  if (!clientId) return null;

  const upcoming = intros.filter(isUpcoming);
  const past = intros.filter((i) => !isUpcoming(i));

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
          className="bg-white rounded-[2.5rem] max-w-3xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-black text-white p-8 relative shrink-0">
            <div className="absolute top-0 right-0 w-48 h-48 bg-red rounded-full blur-[100px] opacity-20 -mr-16 -mt-16 pointer-events-none" />
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center"
            >
              <X size={16} />
            </button>
            {loading ? (
              <div className="py-6 flex justify-center">
                <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : client ? (
              <div className="relative z-10 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                    client.activated
                      ? 'bg-green-500/20 text-green-300 border-green-400/30'
                      : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                  }`}>
                    {client.activated ? 'Activated' : 'Pending activation'}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border bg-white/10 text-white/80 border-white/20">
                    {client.introCount} intro{client.introCount === 1 ? '' : 's'}
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight">{client.name || 'Unnamed client'}</h2>
                <p className="text-red font-bold text-sm flex items-center gap-1.5">
                  <Building2 size={13} /> {client.company || 'No company set'}
                </p>
                <p className="text-gray-400 text-xs font-semibold flex items-center gap-1.5">
                  <Mail size={11} /> {client.email}
                </p>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                  Joined {formatShortDate(client.createdAt)}
                  {client.activatedAt ? ` · Activated ${formatShortDate(client.activatedAt)}` : ''}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 space-y-6">
            {error && (
              <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl text-sm font-semibold">
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                <section>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Clock size={11} /> Upcoming intros ({upcoming.length})
                  </p>
                  {upcoming.length === 0 ? (
                    <p className="text-sm text-gray-400 font-medium italic">No upcoming intros.</p>
                  ) : (
                    <ul className="space-y-3">
                      {upcoming.map((intro) => (
                        <IntroRow key={intro.id} intro={intro} />
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Calendar size={11} /> Past & other ({past.length})
                  </p>
                  {past.length === 0 ? (
                    <p className="text-sm text-gray-400 font-medium italic">No past intros yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {past.map((intro) => (
                        <IntroRow key={intro.id} intro={intro} />
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

function IntroRow({ intro }) {
  return (
    <li className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-sm text-gray-900">{intro.title}</p>
          <p className="text-xs text-gray-500 font-semibold mt-0.5 flex items-center gap-1">
            <User size={10} />
            {intro.talentName || 'Unknown talent'}
          </p>
        </div>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border shrink-0 ${introStatusClass(intro.status)}`}>
          {intro.status || 'unknown'}
        </span>
      </div>
      <p className="text-[11px] text-gray-500 font-medium">{formatDateTime(intro.startAt)}</p>
      {intro.meetingUrl && (
        <a
          href={intro.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[10px] font-black text-red uppercase tracking-widest hover:text-black transition-colors"
        >
          <Video size={11} /> Join meeting <ExternalLink size={10} />
        </a>
      )}
    </li>
  );
}

const AdminClientsPanel = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setClients(await fetchAdminClients());
    } catch (err) {
      setError(err.message || 'Failed to load clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.email, c.company].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [clients, search]);

  const stats = useMemo(() => ({
    total: clients.length,
    activated: clients.filter((c) => c.activated).length,
    withIntros: clients.filter((c) => c.introCount > 0).length,
  }), [clients]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Browse clients</h1>
        <p className="text-gray-500 text-sm font-medium mt-2">
          Hiring partners who booked intros — contact details and interview history.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[10px] font-black text-gray-600 uppercase tracking-widest">
          {stats.total} client{stats.total !== 1 ? 's' : ''}
        </span>
        <span className="px-3 py-1.5 bg-green-50 border border-green-100 rounded-full text-[10px] font-black text-green-700 uppercase tracking-widest flex items-center gap-1">
          <CheckCircle2 size={11} /> {stats.activated} activated
        </span>
        <span className="px-3 py-1.5 bg-red/5 border border-red/10 rounded-full text-[10px] font-black text-red uppercase tracking-widest">
          {stats.withIntros} with intros
        </span>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, company…"
          className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold focus:border-red outline-none"
        />
      </div>

      {error && (
        <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl text-sm font-semibold">
          <p className="flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </p>
          <p className="text-xs mt-2 opacity-80">
            Ensure the backend is running and you are signed in as super admin.
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
      ) : visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-[2rem] p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 size={28} className="text-gray-300" />
          </div>
          <p className="font-black text-gray-800 uppercase tracking-widest text-sm mb-2">No clients yet</p>
          <p className="text-gray-500 text-sm font-medium max-w-md mx-auto leading-relaxed">
            Clients appear here when someone books a talent intro through the request flow.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  {['Client', 'Company', 'Status', 'Intros', 'Last intro', ''].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-5 py-4"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-gray-50 hover:bg-red/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="font-black text-sm text-gray-900">{client.name || '—'}</p>
                      <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{client.email}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                      {client.company || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${
                        client.activated
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {client.activated ? 'Active' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-black text-sm">{client.introCount}</p>
                      {client.upcomingIntroCount > 0 && (
                        <p className="text-[10px] text-red font-bold">{client.upcomingIntroCount} upcoming</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-gray-500">
                      {formatShortDate(client.lastIntroAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(client.id)}
                        className="px-4 py-2 bg-black hover:bg-red text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors"
                      >
                        View intros
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedId && (
        <ClientDetailModal clientId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
};

export default AdminClientsPanel;

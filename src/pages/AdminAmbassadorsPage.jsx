// Admin: ambassador codes + mark successful hires (reward attribution)
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Plus, Sparkles, Copy, Check, Briefcase, Pencil, Trash2 } from 'lucide-react';
import AdminPageShell from '../components/AdminPageShell';

const BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001').replace(/\/$/, '');

function money(n) {
  const v = Number(n) || 0;
  return `$${v.toFixed(v % 1 ? 2 : 0)}`;
}

async function authHeaders() {
  const { supabase } = await import('../lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  };
}

export default function AdminAmbassadorsPage() {
  const [list, setList] = useState([]);
  const [hires, setHires] = useState([]);
  const [hireable, setHireable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [error, setError] = useState('');
  const [hireMsg, setHireMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const [editKind, setEditKind] = useState('circle');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [form, setForm] = useState({
    code: '',
    name: '',
    kind: 'circle',
    promoTitle: 'Founding Ambassador perk',
    promoDescription: 'When talent you invite activate, you unlock this perk — plus decaying cash rewards on placements.',
    promoReward: 'Up to $50 on 1st placement · lifetime residual floor $10',
  });
  const [hireForm, setHireForm] = useState({
    talentEmail: '',
    clientName: '',
    notes: '',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const [ambRes, hireRes, talentRes] = await Promise.all([
        fetch(`${BASE}/api/admin/ambassadors`, { headers }),
        fetch(`${BASE}/api/admin/ambassadors/hires`, { headers }),
        fetch(`${BASE}/api/admin/ambassadors/hireable-talent`, { headers }),
      ]);
      const ambData = await ambRes.json();
      const hireData = await hireRes.json();
      const talentData = await talentRes.json();
      if (!ambRes.ok) throw new Error(ambData.error || 'Failed to load ambassadors');
      if (!hireRes.ok) throw new Error(hireData.error || 'Failed to load hires');
      if (!talentRes.ok) throw new Error(talentData.error || 'Failed to load talent');
      setList(ambData.ambassadors || []);
      setHires(hireData.hires || []);
      setHireable(talentData.talent || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/admin/ambassadors`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setForm((f) => ({ ...f, code: '', name: '' }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const recordHire = async (e) => {
    e.preventDefault();
    setHiring(true);
    setHireMsg('');
    setError('');
    try {
      const res = await fetch(`${BASE}/api/admin/ambassadors/hires`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(hireForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not record hire');
      setHireForm({ talentEmail: '', clientName: '', notes: '' });
      setHireMsg(
        `Hire recorded · ${data.ambassador?.code || 'ambassador'} · cycle ${data.placementCycle} · ${money(data.rewardUsd)} pending`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setHiring(false);
    }
  };

  const copy = async (code) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 1500);
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setEditName(a.name || '');
    setEditKind(a.kind === 'internal' ? 'internal' : 'circle');
    setError('');
  };

  const saveEdit = async (id) => {
    setSavingEdit(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/admin/ambassadors/${id}`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ name: editName, kind: editKind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update ambassador');
      setEditingId('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteAmbassador = async (a) => {
    const ok = window.confirm(
      `Delete ambassador ${a.code} (${a.name || 'unnamed'})?\n\nThis removes the code. Linked talent keep their accounts, but ambassador attribution and hire rewards for this code are cleared.`
    );
    if (!ok) return;

    setDeletingId(a.id);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/admin/ambassadors/${a.id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete ambassador');
      if (editingId === a.id) setEditingId('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId('');
    }
  };

  return (
    <AdminPageShell>
      <div className="mb-8">
        <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-2">Growth</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Ambassadors</h1>
        <p className="text-sm text-gray-500 font-medium mt-2 max-w-2xl">
          Create codes, then mark successful hires here. Rewards are attributed automatically to the linked ambassador ($50 → $30 → $15 → $10).
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm font-semibold text-red bg-red/5 border border-red/15 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={recordHire}
          className="bg-white border border-gray-200 rounded-[2rem] p-6 space-y-3 shadow-sm"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-red flex items-center gap-1.5">
            <Briefcase size={12} /> Mark successfully hired
          </p>
          <p className="text-xs text-gray-500 font-medium leading-relaxed">
            Select an approved talent who was invited/attributed by an ambassador.
          </p>
          <select
            value={hireForm.talentEmail}
            onChange={(e) => setHireForm((f) => ({ ...f, talentEmail: e.target.value }))}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-red bg-white"
          >
            <option value="">
              {loading
                ? 'Loading talent…'
                : hireable.length
                  ? 'Select talent…'
                  : 'No approved ambassador talent yet'}
            </option>
            {hireable.map((t) => (
              <option key={t.userId || t.email} value={t.email}>
                {(t.name || 'Talent') +
                  (t.jobTitle ? ` · ${t.jobTitle}` : '') +
                  ` · ${t.email}` +
                  (t.ambassadorCode ? ` · via ${t.ambassadorCode}` : '')}
              </option>
            ))}
          </select>
          {hireForm.talentEmail ? (
            <p className="text-[11px] text-gray-400 font-medium">
              {(() => {
                const t = hireable.find((x) => x.email === hireForm.talentEmail);
                if (!t) return null;
                return `Ambassador: ${t.ambassadorName || '—'} (${t.ambassadorCode || '—'})`;
              })()}
            </p>
          ) : null}
          <input
            value={hireForm.clientName}
            onChange={(e) => setHireForm((f) => ({ ...f, clientName: e.target.value }))}
            placeholder="Client / company (optional)"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-red"
          />
          <input
            value={hireForm.notes}
            onChange={(e) => setHireForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-red"
          />
          <button
            type="submit"
            disabled={hiring || !hireForm.talentEmail.trim() || !hireable.length}
            className="w-full py-3.5 rounded-xl bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest transition-colors disabled:opacity-40"
          >
            {hiring ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Record hire + reward'}
          </button>
          {hireMsg && (
            <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              {hireMsg}
            </p>
          )}
        </motion.form>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onSubmit={create}
          className="bg-white border border-gray-200 rounded-[2rem] p-6 space-y-3 shadow-sm"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-red flex items-center gap-1.5">
            <Plus size={12} /> New ambassador code
          </p>
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="CODE e.g. BYG-STAR-01"
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-black tracking-widest uppercase outline-none focus:border-red"
          />
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Display name"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-red"
          />
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Role</span>
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-red bg-white"
            >
              <option value="circle">Circle — invite &amp; rewards only</option>
              <option value="internal">Internal — BYG HR (review + screens, own talent only)</option>
            </select>
          </label>
          <input
            value={form.promoTitle}
            onChange={(e) => setForm((f) => ({ ...f, promoTitle: e.target.value }))}
            placeholder="Promo title"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-red"
          />
          <textarea
            value={form.promoDescription}
            onChange={(e) => setForm((f) => ({ ...f, promoDescription: e.target.value }))}
            placeholder="Promo description"
            rows={2}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium outline-none focus:border-red resize-none"
          />
          <input
            value={form.promoReward}
            onChange={(e) => setForm((f) => ({ ...f, promoReward: e.target.value }))}
            placeholder="Reward text"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-red"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Create code'}
          </button>
        </motion.form>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-1.5">
            <Sparkles size={12} className="text-red" /> Active codes
          </p>
          {loading ? (
            <Loader2 className="animate-spin text-gray-300" size={22} />
          ) : !list.length ? (
            <p className="text-sm text-gray-400 font-medium">No ambassadors yet.</p>
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {list.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-2xl border border-gray-100 bg-gray-50 space-y-2"
                >
                  {editingId === a.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-red"
                          placeholder="Display name"
                          autoFocus
                        />
                      </div>
                      <select
                        value={editKind}
                        onChange={(e) => setEditKind(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold outline-none focus:border-red bg-white"
                      >
                        <option value="circle">Circle</option>
                        <option value="internal">Internal (BYG HR)</option>
                      </select>
                      <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingEdit || !editName.trim()}
                        onClick={() => saveEdit(a.id)}
                        className="px-3 py-2 rounded-xl bg-black text-white text-[9px] font-black uppercase tracking-widest hover:bg-red disabled:opacity-40"
                      >
                        {savingEdit ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId('')}
                        className="px-3 py-2 rounded-xl border border-gray-200 text-[9px] font-black uppercase tracking-widest text-gray-500"
                      >
                        Cancel
                      </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-sm text-black truncate">{a.name || 'Ambassador'}</p>
                        <p className="text-[11px] text-gray-400 font-medium">
                          {a.code} · {a.userId ? 'claimed' : 'unclaimed'}
                        </p>
                        <span
                          className={`mt-1 inline-flex px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider ${
                            a.kind === 'internal'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {a.kind === 'internal' ? 'Internal' : 'Circle'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(a)}
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-gray-200 text-[9px] font-black uppercase tracking-widest text-gray-600 hover:border-red hover:text-red"
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === a.id}
                          onClick={() => deleteAmbassador(a)}
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-red/20 text-[9px] font-black uppercase tracking-widest text-red hover:bg-red hover:text-white disabled:opacity-40"
                        >
                          {deletingId === a.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Trash2 size={11} />
                          )}
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => copy(a.code)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-black text-white text-[9px] font-black uppercase tracking-widest hover:bg-red"
                        >
                          {copied === a.code ? <Check size={11} /> : <Copy size={11} />}
                          {a.code}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">
            Recent hires / rewards
          </p>
          {loading ? (
            <Loader2 className="animate-spin text-gray-300" size={22} />
          ) : !hires.length ? (
            <p className="text-sm text-gray-400 font-medium">
              No hires recorded yet. Use “Mark successfully hired” above.
            </p>
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {hires.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-gray-100 bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-black text-sm text-black truncate">
                      {h.talentName || h.talentEmail || 'Talent'}
                    </p>
                    <p className="text-[11px] text-gray-400 font-medium truncate">
                      {h.ambassadorCode || '—'} · cycle {h.placementCycle} · {h.status}
                      {h.notes ? ` · ${h.notes}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 font-black tabular-nums text-black">{money(h.rewardUsd)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}

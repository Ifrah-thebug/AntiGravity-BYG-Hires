import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

/** Shared building blocks for the client / talent / admin Workforce screens. */

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-red disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400',
  accent:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-red px-5 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40',
  small:
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-700 transition-colors hover:border-black disabled:cursor-not-allowed disabled:opacity-40',
  smallDark:
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-red disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400',
};

export const inputClass =
  'mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-black outline-none transition-colors placeholder:font-medium placeholder:text-gray-400 focus:border-red focus:bg-white';

export function Money({ value, currency = 'USD' }) {
  const n = Number(value || 0);
  let text;
  try {
    text = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    text = `${currency} ${n.toFixed(2)}`;
  }
  return <span className="tabular-nums">{text}</span>;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const BADGE_TONES = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red/5 text-red border-red/20',
  gray: 'bg-gray-50 text-gray-500 border-gray-200',
  black: 'bg-black text-white border-black',
};

const STATUS_TONE = {
  active: 'green',
  paid: 'green',
  signed: 'green',
  sent: 'amber',
  hired: 'green',
  verified: 'green',
  open: 'green',
  ready_to_sign: 'amber',
  partially_signed: 'amber',
  contracted: 'amber',
  offered: 'amber',
  pending: 'amber',
  offer: 'amber',
  interview: 'amber',
  intro: 'amber',
  on_hold: 'gray',
  shortlisted: 'gray',
  paused: 'gray',
  draft: 'gray',
  filled: 'black',
  ended: 'gray',
  closed: 'gray',
  void: 'gray',
  rejected: 'red',
  withdrawn: 'gray',
  needs_fixes: 'red',
  overdue: 'red',
  failed: 'red',
};

const STATUS_LABEL = {
  sent: 'Unpaid',
  ready_to_sign: 'Ready to sign',
  partially_signed: 'Signing',
  contracted: 'Contract out',
  needs_fixes: 'Needs fixes',
  on_hold: 'On hold',
  pending: 'Pending',
};

export function StatusBadge({ status, label, tone }) {
  const t = tone || STATUS_TONE[status] || 'gray';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${BADGE_TONES[t]}`}
    >
      {label || STATUS_LABEL[status] || String(status || '').replace(/_/g, ' ')}
    </span>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-red">{eyebrow}</p>
        <h1 className="text-3xl font-black tracking-tight text-black md:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm font-medium text-gray-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return <section className={`rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8 ${className}`}>{children}</section>;
}

export function SectionTitle({ icon: Icon, title, hint, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          {Icon ? <Icon size={16} className="text-red" /> : null}
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">{title}</h2>
        </div>
        {hint ? <p className="mt-1.5 text-xs font-medium text-gray-500">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="-mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex w-max gap-2 md:w-auto md:flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
              active === t.id ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-black hover:text-black'
            }`}
          >
            {t.icon ? <t.icon size={13} /> : null}
            {t.label}
            {t.count > 0 ? (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active === t.id ? 'bg-red text-white' : 'bg-red/10 text-red'}`}>
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Notice({ kind = 'error', children, onDismiss }) {
  if (!children) return null;
  const isError = kind === 'error';
  const Icon = isError ? AlertTriangle : CheckCircle2;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${
        isError ? 'border-red/20 bg-red/5 text-red' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{children}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100">
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center">
      {Icon ? <Icon size={22} className="mx-auto mb-3 text-gray-300" /> : null}
      <p className="text-sm font-black text-gray-700">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-md text-sm font-medium text-gray-500">{children}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function StatTile({ label, value, hint, icon: Icon, tone = 'default', onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition-colors ${
        tone === 'alert' ? 'border-red/20 bg-red/5 hover:border-red/40' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
        {Icon ? <Icon size={15} className={tone === 'alert' ? 'text-red' : 'text-gray-300'} /> : null}
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight text-black">{value}</p>
      {hint ? <p className="mt-1 text-[11px] font-medium text-gray-500">{hint}</p> : null}
    </Comp>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block text-[10px] font-black uppercase tracking-widest text-gray-500 ${className}`}>
      {label}
      {children}
      {hint ? <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-gray-400">{hint}</span> : null}
    </label>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-16" aria-label={label}>
      <div className="h-14 w-14 animate-spin rounded-full border-4 border-red/20 border-t-red" />
    </div>
  );
}

export function BusyLabel({ busy, children, busyText = 'Working…' }) {
  return busy ? (
    <>
      <Loader2 size={13} className="animate-spin" /> {busyText}
    </>
  ) : (
    children
  );
}

/** Client / Talent / BYG signature progress chips. */
export function SignatureSteps({ signatures = [] }) {
  const has = (role) => signatures.some((s) => s.role === role && s.signedAt);
  return (
    <div className="flex flex-wrap gap-2">
      {[
        ['client', 'Client'],
        ['talent', 'Talent'],
        ['byg', 'BYG Hires'],
      ].map(([role, label]) => (
        <span
          key={role}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
            has(role) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-400'
          }`}
        >
          {has(role) ? <CheckCircle2 size={11} /> : <span className="h-2 w-2 rounded-full border border-gray-300" />}
          {label}
        </span>
      ))}
    </div>
  );
}

/** Safely shows server-rendered (escaped) contract / invoice HTML in a scroll box. */
export function DocumentPreview({ html, maxHeight = 'max-h-80' }) {
  if (!html) return null;
  return (
    <div
      className={`${maxHeight} overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm`}
      // Rendered by the backend with every field HTML-escaped.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function useAsyncRunner({ onError, onSuccess, reload }) {
  const [busy, setBusy] = React.useState(null);
  const run = React.useCallback(
    async (key, fn, successMessage) => {
      setBusy(key);
      onError('');
      onSuccess('');
      try {
        const result = await fn();
        if (successMessage) onSuccess(typeof successMessage === 'function' ? successMessage(result) : successMessage);
        if (reload) await reload();
        return result;
      } catch (err) {
        onError(err.message || 'Something went wrong');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [onError, onSuccess, reload]
  );
  return { busy, run };
}

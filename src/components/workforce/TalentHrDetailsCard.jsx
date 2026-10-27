import React, { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  Calendar,
  Flag,
  Loader2,
  MapPin,
  Phone,
  Shield,
  User,
  X,
} from 'lucide-react';
import { fetchAdminHrDetailsByEmail, fetchAdminTalentHrDetails, fetchMyTalentHrDetails } from '../../lib/workforceApi';

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function initialsFrom(name) {
  return String(name || 'T')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function DetailTile({ icon: Icon, label, value }) {
  const display = value && String(value).trim() ? String(value).trim() : null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-[#faf9f8] p-4 transition-colors hover:border-gray-200">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-gray-100 text-red shadow-sm">
          <Icon size={14} strokeWidth={2.25} />
        </span>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{label}</p>
      </div>
      <p
        className={`text-[15px] font-bold leading-snug break-words ${
          display ? 'text-gray-900' : 'text-gray-300 font-semibold'
        }`}
      >
        {display || 'Not on file'}
      </p>
    </div>
  );
}

function HrDetailsBody({ variant, talentId, talentEmail, talentName, onMeta }) {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!talentId && !talentEmail) {
      setPayload(null);
      setError('');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setPayload(null);
      try {
        let data;
        if (variant === 'admin' && talentId) data = await fetchAdminTalentHrDetails(talentId);
        else if (variant === 'admin' && talentEmail) data = await fetchAdminHrDetailsByEmail(talentEmail);
        else if (talentId) data = await fetchMyTalentHrDetails(talentId);
        else throw new Error('Talent id required');
        if (!cancelled) {
          setPayload(data);
          onMeta?.(data?.details || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load HR details.');
          onMeta?.(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [variant, talentId, talentEmail, onMeta]);

  const d = payload?.details;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red/5 text-red">
          <Loader2 size={22} className="animate-spin" />
        </div>
        <p className="text-sm font-bold text-gray-800">Fetching verified HR record…</p>
        <p className="text-[11px] font-medium text-gray-400">Matched securely from your company directory</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-center">
        <p className="text-sm font-bold text-amber-950">{error}</p>
        <p className="mt-1 text-[11px] font-medium text-amber-800/80">Try again in a moment, or continue with the BYG profile.</p>
      </div>
    );
  }

  if (payload && !payload.found) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
        <Shield size={22} className="mx-auto text-gray-300" />
        <p className="mt-3 text-sm font-black text-gray-800">No HR match yet</p>
        <p className="mt-1 text-[12px] font-medium leading-relaxed text-gray-500">
          {payload.reason === 'unconfigured'
            ? 'HR directory is not connected on the server yet.'
            : 'This talent’s email is not linked to an employee record in HR. You can still hire using their BYG profile.'}
        </p>
      </div>
    );
  }

  if (!d) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailTile icon={User} label="Full name" value={d.fullName || talentName} />
        <DetailTile icon={Phone} label="Phone" value={d.phone} />
        <DetailTile icon={Calendar} label="Date of birth" value={formatDate(d.dateOfBirth)} />
        <DetailTile icon={Flag} label="Nationality" value={d.nationality} />
        <DetailTile icon={BadgeCheck} label="CNIC / National ID" value={d.nationalId} />
        <div className="sm:col-span-2">
          <DetailTile icon={MapPin} label="Address" value={d.address} />
        </div>
      </div>

      {(d.designation || d.department || d.employeeCode) && (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {d.employeeCode ? (
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-600">
              {d.employeeCode}
            </span>
          ) : null}
          {d.designation ? (
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-bold text-gray-600">
              {d.designation}
            </span>
          ) : null}
          {d.department ? (
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-bold text-gray-600">
              {d.department}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * “Additional details” → polished HR dossier modal.
 * Client + admin only — never for anonymous public directory visitors.
 */
export default function TalentHrDetailsButton({
  variant = 'client',
  talentId = null,
  talentEmail = null,
  talentName = null,
  className = '',
  buttonClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!talentId && !talentEmail) return null;

  const displayName = meta?.fullName || talentName || 'Talent';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          buttonClassName ||
          `inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-800 shadow-sm transition-colors hover:border-black hover:bg-gray-50 ${className}`
        }
      >
        <Shield size={14} className="shrink-0 text-red" strokeWidth={2.25} />
        <span>HR details</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <button
              type="button"
              aria-label="Close dialog backdrop"
              className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[2rem]"
            >
              {/* Header */}
              <div className="relative shrink-0 overflow-hidden bg-black px-6 pb-6 pt-6 text-white sm:px-8 sm:pt-7">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-red/30 blur-3xl" />
                <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-white/5 blur-2xl" />

                <div className="relative flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-lg font-black tracking-wide">
                    {initialsFrom(displayName)}
                  </div>
                  <div className="min-w-0 flex-1 pr-8">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red">Additional details</p>
                    <h3 id={titleId} className="mt-1 truncate text-2xl font-black tracking-tight">
                      {displayName}
                    </h3>
                    <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-white/55">
                      Verified personal information from HR — visible to hiring clients and BYG admin only.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
                <HrDetailsBody
                  variant={variant}
                  talentId={talentId}
                  talentEmail={talentEmail}
                  talentName={talentName}
                  onMeta={setMeta}
                />
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-gray-100 bg-[#faf9f8] px-6 py-4 sm:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-start gap-2 text-[11px] font-medium leading-relaxed text-gray-500">
                    <Shield size={13} className="mt-0.5 shrink-0 text-red" />
                    Not shown on the public talent directory.
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl bg-black px-5 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-red"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export { TalentHrDetailsButton as TalentHrDetailsCard };

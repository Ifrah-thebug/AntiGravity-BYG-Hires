import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Loader2, User } from 'lucide-react';
import {
  formatIntroWeekday,
  formatIntroDate,
  formatIntroTime,
  formatIntroSlotSummary,
} from '../lib/clientSchedulingTimezone';
import { useClientSchedulingTimezone } from '../hooks/useClientSchedulingTimezone';

const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

async function parseApiJson(resp) {
  const text = await resp.text();
  if (text.trim().startsWith('<')) {
    throw new Error('Scheduling server is unavailable. Restart the backend and try again.');
  }
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Invalid response from scheduling server.');
  }
}

/** Turn API errors into plain English (no JSON blobs). */
function messageFromApi(data, fallback) {
  if (!data) return fallback;
  const code = data.code;
  const err = typeof data.error === 'string' ? data.error : '';

  if (code === 'CLIENT_TALENT_ALREADY_BOOKED') {
    return err || 'You already have an intro scheduled with this talent.';
  }
  if (code === 'SLOT_UNAVAILABLE' || code === 'SLOT_NOT_FOUND') {
    return err || 'That time is no longer available. Please pick another.';
  }
  if (code === 'DAY_BOOKED') {
    return err || 'This talent already has an intro that day. Choose another date.';
  }
  if (code === 'HR_OR_TALENT_BUSY') {
    return err || 'That time is no longer available with our team. Pick another slot.';
  }
  if (err) return err;
  if (typeof data.message === 'string') return data.message;
  return fallback;
}

function ExistingIntroPanel({
  booking,
  talentName,
  isRepeatVisit,
  syncNotice,
  clientTimeZone,
  activation,
}) {
  const summary = formatIntroSlotSummary(booking.start, clientTimeZone);

  return (
    <div className="py-16 px-8 text-center max-w-md mx-auto">
      <CheckCircle2 size={40} className="text-amber-500 mx-auto mb-4" />
      {syncNotice?.type === 'rescheduled' && (
        <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4 font-medium">
          {syncNotice.message}
        </p>
      )}
      <h4 className="font-black text-lg mb-2 text-gray-900">
        {isRepeatVisit ? 'You already have an intro with this talent' : 'Intro call booked'}
      </h4>
      <p className="text-sm text-gray-600 font-medium mb-3 leading-relaxed">
        {isRepeatVisit ? (
          <>
            An intro with <span className="font-bold text-black">{talentName}</span> is already on
            your calendar. You cannot book a second intro with the same talent.
          </>
        ) : (
          <>Your intro with <span className="font-bold text-black">{talentName}</span> is confirmed.</>
        )}
      </p>
      <p className="text-sm font-bold text-gray-800">{summary.dayLine}</p>
      <p className="text-sm text-red font-black mt-1">{summary.timeLine}</p>
      <p className="text-[10px] text-gray-400 mt-2">Shown in your local time</p>
      {booking.meetingUrl && (
        <a
          href={booking.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-5 text-sm font-bold text-red hover:underline"
        >
          Open meeting link
        </a>
      )}
      <p className="text-[11px] text-gray-400 mt-5">
        Check your email ({booking.guestEmail || 'your inbox'}) for the Cal.com calendar invite.
      </p>
      {activation?.sent && (
        <p className="text-[11px] text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mt-4 font-semibold leading-relaxed">
          {isRepeatVisit ? 'We sent another ' : 'We also sent a '}
          <span className="font-black text-black">client portal activation</span> email to{' '}
          {booking.guestEmail || 'your inbox'}. Click the link to set your password.
        </p>
      )}
      {activation?.reason === 'already_active' && (
        <p className="text-[11px] text-gray-500 mt-4">
          Your client account is already active.{' '}
          <a href="/login" className="font-bold text-red hover:underline">
            Log in here
          </a>
          .
        </p>
      )}
    </div>
  );
}

export default function IntroSlotPicker({
  talentId,
  talentName = 'this talent',
  guestName: guestNameProp = '',
  guestEmail: guestEmailProp = '',
  guestCompany = '',
  identityLocked = false,
  bookingTitle = 'Intro Interview',
  onBooked,
}) {
  const { timeZone: clientTimeZone, timeZoneLabel } = useClientSchedulingTimezone();

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [booking, setBooking] = useState(false);
  const [existingIntro, setExistingIntro] = useState(null);
  const [syncNotice, setSyncNotice] = useState(null);
  const [justBooked, setJustBooked] = useState(null);
  const [activationInfo, setActivationInfo] = useState(null);
  const [guestName, setGuestName] = useState(guestNameProp);
  const [guestEmail, setGuestEmail] = useState(guestEmailProp);
  const [checkedEmail, setCheckedEmail] = useState('');

  const normalizedGuestEmail = useMemo(
    () => guestEmail.trim().toLowerCase(),
    [guestEmail]
  );

  const emailPendingCheck =
    Boolean(normalizedGuestEmail && normalizedGuestEmail.includes('@')) &&
    normalizedGuestEmail !== checkedEmail;

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) || null,
    [slots, selectedSlotId]
  );

  useEffect(() => {
    setGuestName(guestNameProp);
    setGuestEmail(guestEmailProp);
  }, [guestNameProp, guestEmailProp]);

  useEffect(() => {
    const em = normalizedGuestEmail;
    if (!em || !em.includes('@')) {
      setCheckedEmail('');
      setExistingIntro(null);
      setSyncNotice(null);
      setSlots([]);
      setSlotsLoading(false);
      return undefined;
    }

    if (identityLocked) {
      setCheckedEmail(em);
      return undefined;
    }

    const timer = setTimeout(() => {
      setCheckedEmail(em);
    }, 500);
    return () => clearTimeout(timer);
  }, [normalizedGuestEmail, identityLocked]);

  const loadSlots = useCallback(
    async ({ silent = false } = {}) => {
      if (!talentId) return;
      try {
        if (!silent) setSlotsLoading(true);
        setError('');
        const params = new URLSearchParams();
        if (checkedEmail) params.set('clientEmail', checkedEmail);
        params.set('timeZone', clientTimeZone);
        const qs = `?${params.toString()}`;
        const resp = await fetch(
          `${API_BASE}/api/intro/client-slots/${encodeURIComponent(talentId)}${qs}`
        );
        const data = await parseApiJson(resp);
        if (!resp.ok) {
          throw new Error(messageFromApi(data, 'Could not load availability'));
        }

        if (data.existingBooking) {
          setExistingIntro(data.existingBooking);
          setSyncNotice(data.syncNotice || null);
          setJustBooked(null);
          setSlots([]);
          setSelectedSlotId('');
          return;
        }

        setExistingIntro(null);
        setSyncNotice(data.syncNotice || null);
        const nextSlots = data.slots || [];
        setSlots(nextSlots);
        setSelectedSlotId((prev) =>
          prev && nextSlots.some((s) => s.id === prev) ? prev : ''
        );
      } catch (err) {
        setError(err.message || 'Could not load slots');
        setSlots([]);
      } finally {
        if (!silent) setSlotsLoading(false);
      }
    },
    [talentId, checkedEmail, clientTimeZone]
  );

  useEffect(() => {
    if (!talentId || !checkedEmail) return;
    loadSlots({ silent: false });
  }, [talentId, checkedEmail, loadSlots]);

  function selectSlot(slot) {
    if (!guestEmail.trim() || !guestEmail.includes('@')) {
      setError('Enter your work email before choosing a time.');
      return;
    }
    setError('');
    setSelectedSlotId(slot.id);
  }

  async function confirmBooking() {
    if (!selectedSlotId || !guestName.trim() || !guestEmail.trim()) return;
    if (emailPendingCheck) {
      setError('Still checking your email — wait a moment, then confirm again.');
      return;
    }
    if (normalizedGuestEmail !== checkedEmail) {
      setError('Email changed — wait for times to reload for this address.');
      return;
    }
    try {
      setBooking(true);
      setError('');
      const resp = await fetch(`${API_BASE}/api/intro/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlotId,
          talentId,
          name: guestName.trim(),
          email: guestEmail.trim(),
          company: guestCompany.trim() || undefined,
          clientTimeZone,
        }),
      });
      const data = await parseApiJson(resp);

      if (resp.status === 409 && data?.booking) {
        setExistingIntro(data.booking);
        setJustBooked(null);
        setActivationInfo(data.activation || null);
        setError('');
        return;
      }

      if (!resp.ok) {
        throw new Error(messageFromApi(data, 'Booking failed'));
      }

      setJustBooked(data.booking);
      setActivationInfo(data.activation || null);
      setExistingIntro(null);
      onBooked?.(data.booking);
    } catch (err) {
      setError(err.message || 'Could not complete booking');
      await loadSlots({ silent: true });
    } finally {
      setBooking(false);
    }
  }

  if (existingIntro) {
    return (
      <ExistingIntroPanel
        booking={existingIntro}
        talentName={talentName}
        isRepeatVisit
        syncNotice={syncNotice}
        clientTimeZone={clientTimeZone}
        activation={activationInfo}
      />
    );
  }

  if (justBooked) {
    return (
      <ExistingIntroPanel
        booking={justBooked}
        talentName={talentName}
        isRepeatVisit={false}
        clientTimeZone={clientTimeZone}
        activation={activationInfo}
      />
    );
  }

  const canConfirm =
    selectedSlotId &&
    guestName.trim() &&
    guestEmail.trim().includes('@') &&
    !booking &&
    !emailPendingCheck &&
    normalizedGuestEmail === checkedEmail;

  return (
    <div className="p-6 md:p-8">
      <p className="text-[11px] text-gray-500 font-semibold mb-4">
        {identityLocked ? (
          <>
            Pick a time in <span className="text-gray-700">{timeZoneLabel}</span> (your local time).
            HR and the talent must both be free.
          </>
        ) : (
          <>
            Enter your details, then pick a time in{' '}
            <span className="text-gray-700">{timeZoneLabel}</span> (your local time). HR and the talent
            must both be free.
          </>
        )}
      </p>

      {identityLocked ? (
        <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
            <User size={16} className="text-gray-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
              Booking as
            </p>
            <p className="text-sm font-black text-gray-900 truncate">
              {guestName.trim() || 'Client'}
            </p>
            <p className="text-xs text-gray-600 font-medium truncate">{guestEmail}</p>
            {guestCompany.trim() && (
              <p className="text-[11px] text-gray-500 font-medium mt-0.5 truncate">
                {guestCompany.trim()}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Your name
            </label>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Work email
            </label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => {
                setGuestEmail(e.target.value);
                setSelectedSlotId('');
                setJustBooked(null);
                setExistingIntro(null);
                setActivationInfo(null);
                setSlots([]);
                setSyncNotice(null);
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold"
              placeholder="you@company.com"
            />
          </div>
        </div>
      )}

      {!identityLocked && !checkedEmail && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Enter your work email below to load available times and check for an existing intro with this
          talent.
        </p>
      )}

      {!identityLocked && emailPendingCheck && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Checking <span className="font-bold">{normalizedGuestEmail}</span> for an existing intro…
        </p>
      )}

      {checkedEmail && syncNotice?.type === 'cancelled' && !slotsLoading && (
        <div
          className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4"
          role="status"
        >
          <p className="font-black text-amber-950 mb-1">Previous intro cancelled</p>
          <p className="text-xs font-medium leading-relaxed">{syncNotice.message}</p>
        </div>
      )}

      {checkedEmail && slotsLoading && (
        <div className="flex items-center gap-2 py-8 justify-center mb-4">
          <Loader2 size={18} className="text-red animate-spin" />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Checking times with HR and talent…
          </p>
        </div>
      )}

      {checkedEmail && error && !slotsLoading && !slots.length && (
        <p className="text-xs text-red-600 font-medium mb-4">{error}</p>
      )}

      {checkedEmail && !slotsLoading && !slots.length && !error && (
        <div className="py-8 text-center mb-4">
          <Calendar size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="font-black text-sm text-gray-900">No intro times available</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            This talent has no open slots right now, or times are taken. Try again later.
          </p>
        </div>
      )}

      {checkedEmail && !slotsLoading && slots.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {slots.map((slot) => {
            const active = selectedSlotId === slot.id;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => selectSlot(slot)}
                className={`text-left border-2 rounded-2xl p-4 transition-all ${
                  active
                    ? 'border-red bg-red/5 shadow-md'
                    : 'border-gray-100 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="font-black text-sm text-gray-900">
                  {formatIntroWeekday(slot.start, clientTimeZone)}
                </div>
                <div className="text-xs text-gray-500 font-medium mt-0.5">
                  {formatIntroDate(slot.start, clientTimeZone)}
                </div>
                <div className={`mt-2 text-sm font-bold ${active ? 'text-red' : 'text-gray-800'}`}>
                  {formatIntroTime(slot.start, clientTimeZone)}
                </div>
                <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">
                  30 min · {bookingTitle}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {checkedEmail && selectedSlot && !slotsLoading && slots.length > 0 && (
        <p className="text-xs text-gray-600 font-medium mb-4 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          You selected{' '}
          <span className="font-bold text-gray-900">
            {formatIntroWeekday(selectedSlot.start, clientTimeZone)},{ ' '}
            {formatIntroDate(selectedSlot.start, clientTimeZone)} at{' '}
            {formatIntroTime(selectedSlot.start, clientTimeZone)} ({timeZoneLabel})
          </span>
          . The calendar invite will use this same moment in your timezone.
        </p>
      )}

      {checkedEmail && !slotsLoading && slots.length > 0 && error && (
        <p className="text-xs text-red-600 font-medium mb-4">{error}</p>
      )}

      {checkedEmail && !slotsLoading && slots.length > 0 && (
        <button
          type="button"
          disabled={!canConfirm}
          onClick={confirmBooking}
          className="w-full sm:w-auto px-8 py-4 bg-black hover:bg-red disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {booking ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Booking…
            </>
          ) : (
            'Confirm intro call'
          )}
        </button>
      )}
    </div>
  );
}

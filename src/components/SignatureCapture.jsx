import React, { useState } from 'react';
import SignaturePad from './SignaturePad';

/**
 * Type-name OR draw signature.
 * onChange({ mode: 'type'|'draw', value: string }) — value is typed name or PNG dataURL.
 */
export default function SignatureCapture({
  value = '',
  mode: controlledMode,
  onChange,
  onModeChange,
  placeholder = 'Type your full legal name',
}) {
  const [mode, setMode] = useState(controlledMode || 'type');
  const active = controlledMode || mode;

  const setActive = (next) => {
    if (!controlledMode) setMode(next);
    onModeChange?.(next);
    onChange?.('');
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setActive('type')}
          className={`rounded-full px-3.5 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
            active === 'type' ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-black'
          }`}
        >
          Type name
        </button>
        <button
          type="button"
          onClick={() => setActive('draw')}
          className={`rounded-full px-3.5 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
            active === 'draw' ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-black'
          }`}
        >
          Draw signature
        </button>
      </div>

      {active === 'type' ? (
        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
          Full legal name
          <input
            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-black outline-none focus:border-red"
            placeholder={placeholder}
            value={value?.startsWith('data:image') ? '' : value}
            onChange={(e) => onChange?.(e.target.value)}
          />
          {value && !value.startsWith('data:image') ? (
            <p className="mt-3 font-serif text-2xl normal-case italic tracking-normal text-black/80">{value}</p>
          ) : null}
        </label>
      ) : (
        <SignaturePad
          key="draw-pad"
          onChange={(dataUrl) => onChange?.(dataUrl)}
        />
      )}
    </div>
  );
}

export function signatureReady(value) {
  return Boolean(value && String(value).trim());
}

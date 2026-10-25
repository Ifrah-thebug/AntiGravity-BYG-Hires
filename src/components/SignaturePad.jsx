import React, { useEffect, useRef, useState } from 'react';

/** Canvas signature pad — onChange(dataUrl | '') when stroke ends / cleared. */
export default function SignaturePad({ onChange, height = 140, className = '' }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, height);
  }, [height]);

  const pos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches?.[0];
    return {
      x: (t ? t.clientX : e.clientX) - rect.left,
      y: (t ? t.clientY : e.clientY) - rect.top,
    };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
    setTick((n) => n + 1);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(hasInk.current ? canvasRef.current.toDataURL('image/png') : '');
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, height);
    hasInk.current = false;
    setTick((n) => n + 1);
    onChange?.('');
  };

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="w-full touch-none rounded-xl border border-gray-200 bg-white cursor-crosshair"
        style={{ height }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold text-gray-500">Draw your signature above</p>
        <button
          type="button"
          onClick={clear}
          className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

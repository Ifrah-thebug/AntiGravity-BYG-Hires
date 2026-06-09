import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFoundPage() {
  useEffect(() => {
    document.title = '404 — Page not found | BYG Hires';
    return () => {
      document.title = 'BYG Hires';
    };
  }, []);

  return (
    <div className="bg-white min-h-[70vh] pt-32 pb-24 flex items-center">
      <div className="max-w-xl mx-auto px-6 text-center">
        <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-4">
          404
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-black tracking-tight mb-4">
          Page not found
        </h1>
        <p className="text-gray-600 font-medium mb-10 leading-relaxed">
          This URL doesn&apos;t exist on BYG Hires. Check the address or head back to the homepage.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-red text-white rounded-full font-bold text-base hover:bg-black transition-colors border-2 border-red"
          >
            <Home size={18} />
            Back to home
          </Link>
          <Link
            to="/talent"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white border-2 border-black text-black rounded-full font-bold text-base hover:bg-black hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            Browse talent
          </Link>
        </div>
      </div>
    </div>
  );
}

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, FileText, UploadCloud } from 'lucide-react';
import CVShredderLoader from './CVShredderLoader';
import { cvParseHeadline, friendlyCvParseMessage } from '../lib/cvParseDisplay';

/**
 * Unified CV parse / retry UI — black cinematic screen while parsing;
 * same friendly retry card on black when parsing fails (signup + invite).
 */
export default function CvParseRetryScreen({
  parsing = false,
  message,
  fileName,
  context = 'signup',
  onReupload,
  onContinueManually,
}) {
  const inputRef = useRef(null);
  const headline = cvParseHeadline(context);
  const friendlyMessage = friendlyCvParseMessage(message);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file && onReupload) onReupload(file);
    e.target.value = '';
  };

  if (parsing) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center text-center p-8"
        role="status"
        aria-live="polite"
        aria-label="Parsing your CV"
      >
        <CVShredderLoader className="mb-6" label="Parsing your CV" />
        <h3 className="text-white font-black text-xl uppercase tracking-wider mb-2">
          Parsing your CV…
        </h3>
        <p className="text-gray-400 text-sm font-medium max-w-xs">
          Extracting your skills, experience, and profile details…
        </p>
        <p className="text-gray-500 text-xs font-medium mt-2 max-w-xs">
          This usually takes 10–20 seconds. Please keep this tab open.
        </p>
        {fileName && (
          <p className="text-gray-600 text-[10px] font-semibold mt-3 truncate max-w-xs" title={fileName}>
            {fileName}
          </p>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cv-parse-retry-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md bg-white border border-gray-200 rounded-[2rem] shadow-2xl shadow-black/30 overflow-hidden"
      >
        <div className="px-8 py-8 md:px-10 md:py-9 text-left space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0">
              <p
                id="cv-parse-retry-title"
                className="font-black text-lg text-gray-900 tracking-tight"
              >
                {headline}
              </p>
              <p className="text-sm text-gray-600 font-medium mt-1 leading-relaxed">
                {friendlyMessage}
              </p>
              {fileName && (
                <p
                  className="text-[10px] text-gray-400 font-semibold mt-2 truncate"
                  title={fileName}
                >
                  File: {fileName}
                </p>
              )}
            </div>
          </div>

          <ul className="text-[11px] text-gray-500 font-medium space-y-1.5 pl-1">
            <li className="flex items-center gap-2">
              <FileText size={12} className="text-red shrink-0" />
              Use a text-based PDF (not a scanned image if possible)
            </li>
            <li className="flex items-center gap-2">
              <FileText size={12} className="text-red shrink-0" />
              Remove password protection · keep file under 8MB
            </li>
          </ul>

          <div className="flex flex-col gap-3 pt-1">
            {onReupload && (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleFile}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full py-4 bg-red hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  <UploadCloud size={16} />
                  Re-upload CV & try again
                </button>
              </>
            )}
            {onContinueManually && (
              <button
                type="button"
                onClick={onContinueManually}
                className="w-full py-3 border-2 border-gray-200 text-gray-600 hover:border-gray-400 hover:text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-colors"
              >
                Continue and fill in manually
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

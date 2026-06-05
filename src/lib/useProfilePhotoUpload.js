import { useCallback, useRef, useState } from 'react';
import { fileToDataUrl, processProfilePhotoWithAI } from './processProfilePhoto';
import { formatGeminiPhotoError } from '../services/geminiPhotoService';

const STEP_LABELS = {
  crop: 'Preparing your photo…',
  enhance: 'Creating professional studio photo…',
  ai: 'Creating professional headshot with AI…',
  frame: 'Final framing for your profile…',
};

/**
 * Shared handler: pick image → passport 4:5 crop on neutral background.
 */
export function useProfilePhotoUpload({ onError, showEnhanceDebug = false } = {}) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(null);
  const [photoEnhanceDebug, setPhotoEnhanceDebug] = useState('');
  const previewUrlRef = useRef(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const clearPhoto = useCallback(() => {
    revokePreview();
    setPhotoFile(null);
    setPhotoPreview('');
    setPhotoProgress(null);
    setPhotoEnhanceDebug('');
  }, [revokePreview]);

  const handlePhotoSelect = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setPhotoProcessing(true);
      setPhotoProgress(null);
      setPhotoEnhanceDebug('');
      onError?.('');

      try {
        const processed = await processProfilePhotoWithAI(
          file,
          (step) => setPhotoProgress(STEP_LABELS[step] || null),
          (warning) => onError?.(warning),
          showEnhanceDebug
            ? (msg) => setPhotoEnhanceDebug(typeof msg === 'string' ? msg : '')
            : undefined
        );
        revokePreview();
        const objectUrl = URL.createObjectURL(processed);
        previewUrlRef.current = objectUrl;
        setPhotoFile(processed);
        setPhotoPreview(objectUrl);
      } catch (err) {
        clearPhoto();
        onError?.(formatGeminiPhotoError(err) || 'Photo processing failed.');
      } finally {
        setPhotoProcessing(false);
        setPhotoProgress(null);
      }
    },
    [clearPhoto, onError, revokePreview, showEnhanceDebug]
  );

  /** For flows that store base64 (pending signup) */
  const getPhotoDataUrl = useCallback(async () => {
    if (!photoFile) return '';
    return fileToDataUrl(photoFile);
  }, [photoFile]);

  return {
    photoFile,
    setPhotoFile,
    photoPreview,
    setPhotoPreview,
    photoProcessing,
    photoProgress,
    photoEnhanceDebug,
    handlePhotoSelect,
    clearPhoto,
    getPhotoDataUrl,
    revokePreview,
  };
}

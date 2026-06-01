import { useCallback, useRef, useState } from 'react';
import { fileToDataUrl, processProfilePhoto } from './processProfilePhoto';

/**
 * Shared handler: pick image → passport 4:5 crop on neutral background.
 */
export function useProfilePhotoUpload({ onError } = {}) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(null);
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
  }, [revokePreview]);

  const handlePhotoSelect = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setPhotoProcessing(true);
      setPhotoProgress(null);
      onError?.('');

      try {
        const processed = await processProfilePhoto(file);
        revokePreview();
        const objectUrl = URL.createObjectURL(processed);
        previewUrlRef.current = objectUrl;
        setPhotoFile(processed);
        setPhotoPreview(objectUrl);
      } catch (err) {
        clearPhoto();
        onError?.(err.message || 'Photo processing failed.');
      } finally {
        setPhotoProcessing(false);
        setPhotoProgress(null);
      }
    },
    [clearPhoto, onError, revokePreview]
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
    handlePhotoSelect,
    clearPhoto,
    getPhotoDataUrl,
    revokePreview,
  };
}

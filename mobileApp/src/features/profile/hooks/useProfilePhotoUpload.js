import { useCallback, useState } from 'react';
import { pickImageFile } from '@/core/storage/files';
import { enhanceProfilePhotoOnServer } from '@/features/profile/api/photoEnhanceApi';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/**
 * Pick a headshot → server Leonardo studio photo (same endpoint as web).
 * Falls back to the picked photo when the server enhance fails.
 */
export function useProfilePhotoUpload({ onError } = {}) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(null);

  const clearPhoto = useCallback(() => {
    setPhotoFile(null);
    setPhotoProgress(null);
  }, []);

  const handlePhotoSelect = useCallback(async () => {
    let picked;
    try {
      picked = await pickImageFile();
    } catch (err) {
      onError?.(err.message || 'Could not open your photos.');
      return;
    }
    if (!picked) return;

    if (picked.size && picked.size > MAX_PHOTO_BYTES) {
      onError?.('Image must be under 10MB.');
      return;
    }

    setPhotoProcessing(true);
    setPhotoProgress('Creating professional studio photo…');
    onError?.('');

    try {
      const enhanced = await enhanceProfilePhotoOnServer(picked);
      setPhotoFile(enhanced);
    } catch (err) {
      console.warn('[useProfilePhotoUpload] server enhance failed', err);
      onError?.(`${err.message || 'Server enhancement unavailable.'} Using your original photo.`);
      setPhotoFile(picked);
    } finally {
      setPhotoProcessing(false);
      setPhotoProgress(null);
    }
  }, [onError]);

  return {
    photoFile,
    photoPreview: photoFile?.uri || '',
    photoProcessing,
    photoProgress,
    handlePhotoSelect,
    clearPhoto,
  };
}

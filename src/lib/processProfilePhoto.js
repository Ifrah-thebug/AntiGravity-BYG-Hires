import {
  isGeminiPhotoEnabled,
  stylizeProfilePhoto,
  dataUrlToJpegFile,
  formatGeminiPhotoError,
} from '../services/geminiPhotoService';
import {
  enhanceProfilePhotoOnServer,
  isServerPhotoEnhanceEnabled,
  formatPhotoEnhanceDebugMessage,
} from './profilePhotoApi';
import {
  enhanceProfilePhotoInBrowser,
  isClientBgRemovalEnabled,
  formatClientPhotoDebug,
} from './profilePhotoEnhanceClient';

import {
  PASSPORT_WIDTH,
  PASSPORT_HEIGHT,
  PASSPORT_BACKGROUND,
} from './profilePhotoConstants';

export { PASSPORT_WIDTH, PASSPORT_HEIGHT, PASSPORT_BACKGROUND };

/** Passport-style profile photo: 4:5 crop on neutral background. */

const MAX_SOURCE_EDGE = 1600;

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image.'));
    };
    img.src = url;
  });
}

/** Downscale very large phone photos before canvas work */
async function normalizeSourceFile(file) {
  const img = await loadImageFromBlob(file);
  const longest = Math.max(img.width, img.height);
  if (longest <= MAX_SOURCE_EDGE) return file;

  const scale = MAX_SOURCE_EDGE / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not prepare image.'));
          return;
        }
        resolve(
          new File([blob], file.name.replace(/\.\w+$/, '.jpg') || 'photo.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
        );
      },
      'image/jpeg',
      0.92
    );
  });
}

/**
 * Cover-crop into 4:5 with neutral fill — same framing as talent directory cards.
 * Works best when the original already has a plain wall behind the subject.
 */
function compositePassportCover(img) {
  const canvas = document.createElement('canvas');
  canvas.width = PASSPORT_WIDTH;
  canvas.height = PASSPORT_HEIGHT;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = PASSPORT_BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (canvas.width - drawW) / 2;
  const dy = (canvas.height - drawH) * 0.2;

  ctx.drawImage(img, dx, dy, drawW, drawH);
  return canvas;
}

function canvasToJpegFile(canvas, filename = 'profile-photo.jpg', quality = 0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not export processed photo.'));
          return;
        }
        resolve(
          new File([blob], filename, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
        );
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function processProfilePhoto(file) {
  const isHeic = /\.heic$/i.test(file?.name || '') || /\.heif$/i.test(file?.name || '');
  if (!file?.type?.startsWith('image/') && !isHeic) {
    throw new Error('Please upload a JPG, PNG, or HEIC headshot.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image must be under 10MB.');
  }

  try {
    const normalized = await normalizeSourceFile(file);
    const img = await loadImageFromBlob(normalized);
    const canvas = compositePassportCover(img);
    return canvasToJpegFile(canvas);
  } catch (err) {
    console.warn('[processProfilePhoto] failed', err);
    throw new Error(
      err.message || 'Could not prepare your photo. Try a JPG or PNG under 10MB.'
    );
  }
}

/**
 * Profile photo for directory cards.
 * Default: server Leonardo AI + sharp frame. Optional browser imgly if VITE_CLIENT_BG_REMOVAL=true.
 * Optional Gemini if VITE_GEMINI_PHOTO_ENABLED=true.
 */
export async function processProfilePhotoWithAI(file, onStep, onWarning, onDebug) {
  if (isServerPhotoEnhanceEnabled()) {
    try {
      onStep?.('enhance');
      const out = await enhanceProfilePhotoOnServer(file, onStep, (debug) => {
        onDebug?.(formatPhotoEnhanceDebugMessage(debug));
      });
      return out;
    } catch (err) {
      console.warn('[processProfilePhotoWithAI] server enhance failed', err);
      onWarning?.(
        `${err.message || 'Server enhancement unavailable.'} Trying fallback…`
      );
    }
  }

  if (isClientBgRemovalEnabled()) {
    try {
      const { file: out, debug } = await enhanceProfilePhotoInBrowser(file, onStep);
      onDebug?.(formatClientPhotoDebug(debug));
      return out;
    } catch (err) {
      console.warn('[processProfilePhotoWithAI] browser enhance failed', err);
      onWarning?.(
        `${err.message || 'Browser photo enhance failed.'} Using basic crop…`
      );
    }
  }

  if (isGeminiPhotoEnabled()) {
    onStep?.('crop');
    const cropped = await processProfilePhoto(file);
    onStep?.('ai');
    const dataUrl = await fileToDataUrl(cropped);
    try {
      const styledUrl = await stylizeProfilePhoto(dataUrl);
      if (styledUrl !== dataUrl) {
        const styledFile = await dataUrlToJpegFile(styledUrl, cropped.name);
        onStep?.('frame');
        return processProfilePhoto(styledFile);
      }
    } catch (err) {
      if (err?.code === 'GEMINI_QUOTA_EXCEEDED') {
        onWarning?.(formatGeminiPhotoError(err));
      }
      console.warn('[processProfilePhotoWithAI] Gemini failed', err);
    }
    return cropped;
  }

  onStep?.('crop');
  return processProfilePhoto(file);
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read photo.'));
    reader.readAsDataURL(file);
  });
}

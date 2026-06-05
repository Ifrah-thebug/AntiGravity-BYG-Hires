/**
 * Browser-side background removal (@imgly/background-removal WASM).
 * Works on Windows — avoids Node onnx crash. Same face, clean studio background.
 */

import {
  PASSPORT_WIDTH,
  PASSPORT_HEIGHT,
  PASSPORT_BACKGROUND,
} from './profilePhotoConstants';

const HEIC_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

export function isClientBgRemovalEnabled() {
  return import.meta.env.VITE_CLIENT_BG_REMOVAL === 'true';
}

function isHeicFile(file) {
  const type = String(file?.type || '').toLowerCase();
  if (HEIC_TYPES.has(type)) return true;
  return /\.heic$/i.test(file?.name || '') || /\.heif$/i.test(file?.name || '');
}

async function heicToJpegBlob(file) {
  const heic2any = (await import('heic2any')).default;
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(result) ? result[0] : result;
  return blob;
}

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

function compositeStudioPortrait(img) {
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

function canvasToJpegFile(canvas, filename = 'profile-photo.jpg') {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not export photo.'));
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
      0.9
    );
  });
}

export function formatClientPhotoDebug(debug) {
  if (!debug) return '';
  const imglyNote =
    debug.imgly === 'ok'
      ? 'imgly WASM OK (background removed)'
      : debug.imgly === 'failed'
        ? 'imgly WASM failed — crop fallback'
        : `imgly: ${debug.imgly}`;

  return [
    'Dev · photo pipeline (browser)',
    'canvas OK',
    imglyNote,
    debug.heic === 'converted' ? 'HEIC → JPEG' : null,
    `pipeline: ${debug.pipeline}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * @returns {Promise<{ file: File, debug: object }>}
 */
export async function enhanceProfilePhotoInBrowser(file, onStep) {
  if (!file?.type?.startsWith('image/') && !isHeicFile(file)) {
    throw new Error('Please upload a JPG, PNG, or HEIC photo.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image must be under 10MB.');
  }

  const debug = {
    heic: 'no',
    imgly: 'pending',
    pipeline: 'canvas-only',
  };

  let workingBlob = file;
  if (isHeicFile(file)) {
    onStep?.('Converting HEIC…');
    workingBlob = await heicToJpegBlob(file);
    debug.heic = 'converted';
  }

  onStep?.('Removing background (first time may download ~40MB model)…');
  const { removeBackground } = await import('@imgly/background-removal');

  let cutoutBlob;
  try {
    cutoutBlob = await removeBackground(workingBlob, {
      model: 'medium',
      output: { format: 'image/png', quality: 0.9 },
      progress: (key, current, total) => {
        if (total > 0) {
          const pct = Math.round((current / total) * 100);
          onStep?.(`Loading ${key}… ${pct}%`);
        }
      },
    });
    debug.imgly = 'ok';
    debug.pipeline = 'wasm+canvas';
  } catch (err) {
    console.warn('[profilePhoto client] imgly failed', err);
    debug.imgly = 'failed';
    workingBlob = workingBlob instanceof File ? workingBlob : file;
    const img = await loadImageFromBlob(workingBlob);
    const fileOut = await canvasToJpegFile(
      compositeStudioPortrait(img),
      file.name?.replace(/\.\w+$/, '.jpg') || 'profile-photo.jpg'
    );
    return { file: fileOut, debug };
  }

  onStep?.('Framing studio portrait…');
  const img = await loadImageFromBlob(cutoutBlob);
  const fileOut = await canvasToJpegFile(
    compositeStudioPortrait(img),
    file.name?.replace(/\.\w+$/, '.jpg') || 'profile-photo.jpg'
  );
  return { file: fileOut, debug };
}

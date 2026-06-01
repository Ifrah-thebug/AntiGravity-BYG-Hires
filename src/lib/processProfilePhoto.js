/** Passport-style profile photo: 4:5 crop on neutral background (no AI matting). */

export const PASSPORT_WIDTH = 1200;
export const PASSPORT_HEIGHT = 1500;
export const PASSPORT_BACKGROUND = '#f0f0f0';

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
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Please upload a JPG or PNG headshot.');
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

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read photo.'));
    reader.readAsDataURL(file);
  });
}

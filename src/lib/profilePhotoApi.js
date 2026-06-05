function getPhotoApiBase() {
  const env = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
  if (import.meta.env.DEV) return '';
  return env;
}

/** @param {Headers} headers */
export function parsePhotoEnhanceDebugHeaders(headers) {
  return {
    sharp: headers.get('X-Photo-Sharp') || 'unknown',
    leonardo: headers.get('X-Photo-Leonardo') || 'unknown',
    model: headers.get('X-Photo-Model') || '',
    heic: headers.get('X-Photo-Heic') || 'unknown',
    pipeline: headers.get('X-Photo-Pipeline') || 'unknown',
  };
}

export function formatPhotoEnhanceDebugMessage(debug) {
  if (!debug) return '';
  const sharpOk = debug.sharp === 'ok';
  const leoOk = debug.leonardo === 'ok';
  const leoNote =
    debug.leonardo === 'skipped'
      ? 'Leonardo skipped (no API key)'
      : debug.leonardo === 'failed'
        ? 'Leonardo failed — sharp crop fallback'
        : leoOk
          ? `Leonardo OK (${debug.model || 'nano-banana-2'})`
          : `Leonardo: ${debug.leonardo}`;

  return [
    'Dev · photo pipeline',
    sharpOk ? 'sharp OK' : `sharp: ${debug.sharp}`,
    leoNote,
    debug.heic === 'converted' ? 'HEIC → JPEG' : null,
    `pipeline: ${debug.pipeline}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * @param {File} file
 * @param {(step: string) => void} [onStep]
 * @param {(debug: object) => void} [onDebug]
 */
export async function enhanceProfilePhotoOnServer(file, onStep, onDebug) {
  onStep?.('enhance');
  const form = new FormData();
  form.append('photo', file, file.name || 'photo.jpg');

  let resp;
  try {
    resp = await fetch(`${getPhotoApiBase()}/api/profile/enhance-photo`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(240000),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new Error('Photo enhancement timed out (Leonardo can take 1–3 minutes — try again).');
    }
    if (err?.message === 'Failed to fetch') {
      throw new Error(
        'Could not reach the backend. Start it with: cd backend && npm run dev'
      );
    }
    throw err;
  }

  const bodyBuffer = await resp.arrayBuffer();

  if (!resp.ok) {
    let message = 'Photo enhancement failed. Is the backend running on port 5001?';
    const errText = new TextDecoder().decode(bodyBuffer);
    try {
      const data = JSON.parse(errText);
      message = data?.error || message;
    } catch {
      if (errText && !errText.startsWith('<')) message = errText.slice(0, 200);
    }
    throw new Error(message);
  }

  const debug = parsePhotoEnhanceDebugHeaders(resp.headers);
  onDebug?.(debug);

  const blob = new Blob([bodyBuffer], { type: resp.headers.get('Content-Type') || 'image/jpeg' });
  const outFile = new File([blob], file.name?.replace(/\.\w+$/, '.jpg') || 'profile-photo.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
  outFile.photoEnhanceDebug = debug;
  return outFile;
}

export function isServerPhotoEnhanceEnabled() {
  return import.meta.env.VITE_PROFILE_PHOTO_ENHANCE !== 'false';
}

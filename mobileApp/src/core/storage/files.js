import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { pick, keepLocalCopy, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/core/api/supabase';
import { withTimeout } from '@/core/api/http';
import { withPhotoCacheBust } from '@/shared/lib/photoUrl';

/**
 * A picked local file. Mirrors the browser `File` fields the web code relies on.
 * @typedef {{ uri: string, name: string, type: string, size: number }} LocalFile
 */

const BUCKET = 'talent-files';

/** Strip file:// so react-native-blob-util can read the path. */
export function toFsPath(uri) {
  const raw = String(uri || '');
  if (!raw.startsWith('file://')) return raw;
  return decodeURIComponent(raw.replace(/^file:\/\//, ''));
}

export function toFileUri(path) {
  const raw = String(path || '');
  if (!raw || raw.startsWith('file://') || raw.startsWith('content://')) return raw;
  return Platform.OS === 'android' ? `file://${raw}` : raw;
}

export async function readFileAsBase64(file) {
  return ReactNativeBlobUtil.fs.readFile(toFsPath(file.uri), 'base64');
}

function isPickerCancel(err) {
  return isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED;
}

export const MAX_CV_BYTES = 5 * 1024 * 1024;
const CV_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
// The picker filter takes MIME types on Android and UTIs on iOS.
const CV_PICK_TYPES = Platform.OS === 'ios' ? ['com.adobe.pdf', 'public.png', 'public.jpeg'] : CV_TYPES;
const EXT_BY_TYPE = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
};

/** Size from the picker, or from disk when the provider did not report one. */
async function fileSize(uri, reported) {
  if (reported > 0) return reported;
  try {
    const stat = await ReactNativeBlobUtil.fs.stat(toFsPath(uri));
    return Number(stat?.size) || 0;
  } catch {
    return 0;
  }
}

/** Pick a CV (PDF / PNG / JPG, max 5MB) and copy it to the app cache. Returns null on cancel. */
export async function pickCvFile() {
  try {
    const [res] = await pick({ type: CV_PICK_TYPES });
    const name = res.name || 'cv.pdf';
    const type = res.type || (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    if (!CV_TYPES.includes(type)) {
      throw new Error('Please choose a PDF, PNG or JPG file.');
    }
    const [copy] = await keepLocalCopy({
      files: [{ uri: res.uri, fileName: name }],
      destination: 'cachesDirectory',
    });
    if (copy.status !== 'success') {
      throw new Error(copy.copyError || 'Could not read the selected file.');
    }
    const size = await fileSize(copy.localUri, res.size || 0);
    if (size > MAX_CV_BYTES) {
      throw new Error('CV must be under 5MB.');
    }
    return { uri: copy.localUri, name, type, size };
  } catch (err) {
    if (isPickerCancel(err)) return null;
    throw err;
  }
}

/** Pick an image from the gallery. Returns null on cancel. */
export async function pickImageFile({ maxEdge = 1600 } = {}) {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    quality: 0.92,
    maxWidth: maxEdge,
    maxHeight: maxEdge,
  });
  if (result.didCancel) return null;
  if (result.errorCode) {
    throw new Error(result.errorMessage || 'Could not open your photo library.');
  }
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    name: asset.fileName || 'photo.jpg',
    type: asset.type || 'image/jpeg',
    size: asset.fileSize || 0,
  };
}

const UPLOAD_TIMEOUT_MS = 120000;

async function uploadToBucket(path, file, contentType) {
  const base64 = await readFileAsBase64(file);
  // A stalled connection must not leave the "Uploading…" overlay up forever.
  const { error } = await withTimeout(
    supabase.storage.from(BUCKET).upload(path, decode(base64), { upsert: true, contentType }),
    UPLOAD_TIMEOUT_MS
  );
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return withPhotoCacheBust(data.publicUrl);
}

/** Upload CV or photo to Supabase Storage talent-files bucket (same paths as web). */
/** Extension from the file name, else from the MIME type ("Resume" with no dot → pdf). */
function fileExtension(file, fallback) {
  const name = String(file.name || '');
  const fromName = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (/^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return EXT_BY_TYPE[file.type] || fallback;
}

export async function uploadTalentFile(userId, file, kind) {
  const ext = fileExtension(file, kind === 'photo' ? 'jpg' : 'pdf');
  const contentType = file.type || (kind === 'photo' ? 'image/jpeg' : 'application/octet-stream');
  return uploadToBucket(`${userId}/${kind}.${ext}`, file, contentType);
}

/** Portal photo replace — web always writes `${userId}/photo.jpg`. */
export async function uploadProfilePhoto(userId, file) {
  return uploadToBucket(`${userId}/photo.jpg`, file, 'image/jpeg');
}

/** Upload portfolio project cover image */
export async function uploadPortfolioCover(userId, projectId, file) {
  const ext = fileExtension(file, 'jpg');
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
  return uploadToBucket(
    `${userId}/portfolio/${projectId}.${safeExt}`,
    file,
    file.type || `image/${safeExt}`
  );
}

/**
 * Upload both files; returns URLs and non-fatal warnings if one fails.
 * Lets signup continue so user can retry on setup / portal.
 */
export async function uploadSignupFiles(userId, cvFile, photoFile) {
  const warnings = [];
  let cvUrl = '';
  let photoUrl = '';

  if (cvFile) {
    try {
      cvUrl = await uploadTalentFile(userId, cvFile, 'cv');
    } catch (e) {
      warnings.push(`CV upload failed: ${e.message}. You can retry when saving your profile.`);
    }
  }

  if (photoFile) {
    try {
      photoUrl = await uploadTalentFile(userId, photoFile, 'photo');
    } catch (e) {
      warnings.push(`Photo upload failed: ${e.message}. You can retry when saving your profile.`);
    }
  }

  return { cvUrl, photoUrl, warnings };
}

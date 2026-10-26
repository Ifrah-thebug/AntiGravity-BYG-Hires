import ReactNativeBlobUtil from 'react-native-blob-util';
import { apiUrl } from '@/core/api/http';
import { toFileUri, toFsPath } from '@/core/storage/files';

const ENHANCE_TIMEOUT_MS = 240000;

/**
 * Server Leonardo AI + sharp studio photo (POST /api/profile/enhance-photo).
 * Saves the returned JPEG to the app cache and returns it as a LocalFile.
 * @param {import('@/core/storage/files').LocalFile} file
 */
export async function enhanceProfilePhotoOnServer(file) {
  let res;
  try {
    res = await ReactNativeBlobUtil.config({
      fileCache: true,
      appendExt: 'jpg',
      timeout: ENHANCE_TIMEOUT_MS,
    }).fetch(
      'POST',
      apiUrl('/api/profile/enhance-photo'),
      { 'Content-Type': 'multipart/form-data' },
      [
        {
          name: 'photo',
          filename: file.name || 'photo.jpg',
          type: file.type || 'image/jpeg',
          data: ReactNativeBlobUtil.wrap(toFsPath(file.uri)),
        },
      ]
    );
  } catch (err) {
    if (/timed? ?out/i.test(String(err?.message || ''))) {
      throw new Error('Photo enhancement timed out (it can take 1–3 minutes). Please try again.');
    }
    throw new Error('Could not reach BYG Hires. Check your internet connection and try again.');
  }

  const status = res.info().status;
  if (status < 200 || status >= 300) {
    let message = 'Photo enhancement failed. Please try again.';
    try {
      const text = await ReactNativeBlobUtil.fs.readFile(res.path(), 'utf8');
      const data = JSON.parse(text);
      message = data?.error || message;
    } catch {
      /* keep default */
    }
    await ReactNativeBlobUtil.fs.unlink(res.path()).catch(() => {});
    throw new Error(message);
  }

  return {
    uri: toFileUri(res.path()),
    name: (file.name || 'profile-photo').replace(/\.\w+$/, '') + '.jpg',
    type: 'image/jpeg',
    size: 0,
  };
}

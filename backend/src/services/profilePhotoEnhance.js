/**
 * Profile photo pipeline: Leonardo.AI enhancement + sharp framing (HEIC convert, 4:5 JPEG).
 */

const sharp = require('sharp');
const { enhanceWithLeonardo, isLeonardoEnabled } = require('./leonardoProfilePhoto');

const HEIC_MIMES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const WIDTH = 1200;
const HEIGHT = 1500;
const STUDIO_BG = { r: 240, g: 240, b: 240 };

/** 4:5 talent-card aspect (height / width). */
const TARGET_RATIO = HEIGHT / WIDTH;

function getTightRatioMax() {
  const n = parseFloat(process.env.PROFILE_PHOTO_TIGHT_RATIO_MAX);
  return Number.isFinite(n) && n > 1.1 && n < 2 ? n : 1.22;
}

function getWideRatioMin() {
  const n = parseFloat(process.env.PROFILE_PHOTO_WIDE_RATIO_MIN);
  return Number.isFinite(n) && n > 0.7 && n < 1.2 ? n : 1.05;
}

/**
 * Normalize zoom before final 1200×1500:
 * - Too wide → top-crop to 4:5 (drop lower body)
 * - Too tight (e.g. niqab eye close-up) → fit inside 4:5 with padding (zoom out)
 * - In range → light top crop to exact 4:5
 */
async function normalizePortraitComposition(buffer) {
  const img = sharp(buffer).rotate();
  const { width: w, height: h } = await img.metadata();
  if (!w || !h) return buffer;

  const ratio = h / w;
  const targetH = Math.round(w * TARGET_RATIO);
  const tightMax = getTightRatioMax();
  const wideMin = getWideRatioMin();

  if (ratio > tightMax) {
    return img
      .resize(w, targetH, { fit: 'inside', background: STUDIO_BG })
      .toBuffer();
  }

  if (ratio < wideMin) {
    const cropH = Math.max(1, Math.min(h, targetH));
    if (cropH >= h) return buffer;
    return img.extract({ left: 0, top: 0, width: w, height: cropH }).toBuffer();
  }

  if (ratio > TARGET_RATIO * 1.02 && targetH < h) {
    return img.extract({ left: 0, top: 0, width: w, height: targetH }).toBuffer();
  }

  return buffer;
}

/** Pre-Leonardo: only trim wide uploads; do not tighten already-portrait refs. */
async function prepareLeonardoInput(buffer) {
  const img = sharp(buffer).rotate();
  const { width: w, height: h } = await img.metadata();
  if (!w || !h) return buffer;

  const ratio = h / w;
  if (ratio >= getWideRatioMin()) return buffer;

  const targetH = Math.round(w * TARGET_RATIO);
  const cropH = Math.max(1, Math.min(h, targetH));
  if (cropH >= h) return buffer;
  return img.extract({ left: 0, top: 0, width: w, height: cropH }).toBuffer();
}

function isHeicInput(buffer, mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (HEIC_MIMES.has(mime)) return true;
  if (!buffer || buffer.length < 12) return false;
  const ftyp = buffer.toString('ascii', 4, 8);
  if (ftyp !== 'ftyp') return false;
  const brand = buffer.toString('ascii', 8, 16).toLowerCase();
  return /heic|heix|hevc|hevx|mif1|msf1|heim/.test(brand);
}

async function convertHeicToJpeg(buffer) {
  const convert = require('heic-convert');
  const output = await convert({
    buffer,
    format: 'JPEG',
    quality: 0.92,
  });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

async function normalizeInputBuffer(inputBuffer, mimeType) {
  if (!isHeicInput(inputBuffer, mimeType)) {
    return inputBuffer;
  }
  console.log('[profilePhoto] Converting HEIC/HEIF to JPEG');
  return convertHeicToJpeg(inputBuffer);
}

/** Downscale before Leonardo upload; max dimension from env or 1280. */
async function prepareSourceForLeonardo(inputBuffer) {
  const maxEdge = Math.min(
    2048,
    Math.max(512, parseInt(process.env.LEONARDO_UPLOAD_MAX_EDGE, 10) || 1280)
  );
  return sharp(inputBuffer)
    .rotate()
    .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function exportPassportFrame(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(WIDTH, HEIGHT, {
      fit: 'inside',
      background: STUDIO_BG,
    })
    .flatten({ background: STUDIO_BG })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

async function framePortrait(subjectBuffer) {
  const normalized = await normalizePortraitComposition(subjectBuffer);
  return exportPassportFrame(normalized);
}

async function frameWithoutLeonardo(inputBuffer) {
  const normalized = await normalizePortraitComposition(inputBuffer);
  return exportPassportFrame(normalized);
}

/**
 * @param {Buffer} inputBuffer
 * @param {string} [mimeType]
 * @returns {Promise<{ buffer: Buffer, debug: object }>}
 */
async function enhanceProfilePhotoBuffer(inputBuffer, mimeType) {
  if (!inputBuffer?.length) {
    throw new Error('Empty image buffer');
  }

  const wasHeic = isHeicInput(inputBuffer, mimeType);
  const jpegSource = await normalizeInputBuffer(inputBuffer, mimeType);
  const prepared = await prepareSourceForLeonardo(jpegSource);

  const debug = {
    heic: wasHeic ? 'converted' : 'no',
    sharp: 'ok',
    leonardo: 'pending',
    pipeline: 'leonardo',
  };

  if (!isLeonardoEnabled()) {
    debug.leonardo = 'skipped';
    debug.pipeline = 'sharp-only';
    const out = await frameWithoutLeonardo(prepared);
    return { buffer: out, debug };
  }

  const leonardoInput = await prepareLeonardoInput(prepared);

  try {
    const { buffer: generated, debug: leoDebug } = await enhanceWithLeonardo(leonardoInput);
    debug.leonardo = leoDebug.leonardo;
    debug.model = leoDebug.model;
    debug.generationId = leoDebug.generationId;
    const out = await framePortrait(generated);
    return { buffer: out, debug };
  } catch (err) {
    console.warn('[profilePhoto] Leonardo failed:', err?.message || err);
    debug.leonardo = 'failed';
    debug.pipeline = 'leonardo-fallback-sharp';
    const out = await frameWithoutLeonardo(prepared);
    return { buffer: out, debug };
  }
}

module.exports = { enhanceProfilePhotoBuffer };

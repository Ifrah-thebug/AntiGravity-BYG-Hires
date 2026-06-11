// Professional headshot via Gemini image generation (input photo → styled portrait).

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/** Gemini image generation — input photo → styled portrait. */
export const GEMINI_PHOTO_MODEL = 'gemini-3.1-flash-image';

const STYLE_PROMPT = `
You are a corporate headshot retoucher for a premium remote hiring platform (LinkedIn / Upwork / recruiter directory standard) — NOT a dating, matrimonial, or glamour portrait service.

Transform the attached photo into a hire-ready professional headshot:
- Subject faces the camera directly (correct a slight front-camera angle to straight-on), confident business posture
- Tight consistent headshot framing for a talent directory card: portrait 4:5, same zoom on every candidate — head through upper chest with margin above the head; face ~40% of frame height when visible; for niqab/hijab show full head covering and shoulders (not extreme eyes-only close-up); never show waist or lower body
- Background: clean corporate studio or softly blurred neutral office backdrop — light grey, off-white, or cool grey tones with shallow depth of field (no garden foliage, no romantic golden-hour glow, no decorative props)
- Wardrobe colors (BYG Hires brand palette only): clothing must use red, black, and/or white — solid or tasteful two-tone (black blazer white shirt, red accent on white collar). No navy, grey, beige, cream, or other colors on clothing
- Wardrobe style: workplace professional only — blazer, collared shirt, blouse, or modest office shalwar kameez/kurta in brand colors. Not wedding, party, festival, or casual streetwear. If reference shows hijab, niqab, abaya, or modest dress — preserve coverage; refine fabric/fit in red, black, and white only
- Even corporate studio lighting; natural skin texture; minimal retouching; sharp focus on the face
- Expression: if the face is clearly visible, calm confident professional demeanor — subtle closed-lip smile or neutral business expression, hire-ready, no visible teeth, not flirtatious or overly posed. If face is covered, do not invent facial features
- Preserve exact identity: same face, skin tone, age, hair, hijab, beard, glasses — do not glamorize or beautify into a different person
- Avoid: matrimonial/rishta aesthetic, heavy makeup, airbrushed skin, glamour lighting, bridal jewelry, party wear
- No text, logos, watermarks, or extra people
Output ONLY the edited portrait image.
`.trim();

/** Off by default — use Express open-source pipeline unless explicitly enabled. */
export function isGeminiPhotoEnabled() {
  if (!GEMINI_API_KEY) return false;
  return import.meta.env.VITE_GEMINI_PHOTO_ENABLED === 'true';
}

function buildEndpoint(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

function extractImagePart(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.find((p) => p.inline_data?.data || p.inlineData?.data) || null;
}

async function requestStyledImage(model, mimeType, base64Data) {
  const inline = { mime_type: mimeType, data: base64Data };
  const response = await fetch(buildEndpoint(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: STYLE_PROMPT }, { inline_data: inline }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 0.4,
        imageConfig: { aspectRatio: '4:5' },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`${model}: ${response.status} ${errText.slice(0, 400)}`);
    err.status = response.status;
    err.model = model;
    if (/RESOURCE_EXHAUSTED|quota exceeded|rate-limit/i.test(errText)) {
      err.code = 'GEMINI_QUOTA_EXCEEDED';
    }
    throw err;
  }

  const data = await response.json();
  const imgPart = extractImagePart(data);
  if (!imgPart) {
    throw new Error(`${model}: no image in response`);
  }

  const payload = imgPart.inline_data || imgPart.inlineData;
  const outMime = payload.mime_type || payload.mimeType || 'image/png';
  return `data:${outMime};base64,${payload.data}`;
}

/**
 * @param {string} base64Image - data:image/...;base64,...
 * @returns {Promise<string>} styled data URL, or original on failure
 */
export async function stylizeProfilePhoto(base64Image) {
  if (!isGeminiPhotoEnabled()) {
    console.warn('[Gemini Photo] Disabled or missing API key — using cropped photo only.');
    return base64Image;
  }

  const match = base64Image.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!match) {
    console.warn('[Gemini Photo] Invalid image format — skipping.');
    return base64Image;
  }
  const [, mimeType, base64Data] = match;

  try {
    return await requestStyledImage(GEMINI_PHOTO_MODEL, mimeType, base64Data);
  } catch (err) {
    console.error('[Gemini Photo] Failed:', err?.message || err);
    if (err?.code === 'GEMINI_QUOTA_EXCEEDED') {
      const quotaErr = new Error(
        'AI photo styling is unavailable on your Google API plan (image models need billing enabled). Your cropped photo was saved — you can continue signup, or enable billing at ai.google.dev and try again.'
      );
      quotaErr.code = 'GEMINI_QUOTA_EXCEEDED';
      throw quotaErr;
    }
    return base64Image;
  }
}

export function formatGeminiPhotoError(err) {
  if (err?.code === 'GEMINI_QUOTA_EXCEEDED') return err.message;
  return err?.message || 'Photo AI styling failed. Using cropped photo only.';
}

/** @param {string} dataUrl @param {string} [filename] @returns {Promise<File>} */
export async function dataUrlToJpegFile(dataUrl, filename = 'profile-photo.jpg') {
  const match = dataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data.');
  const mime = match[1];
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const name = filename.replace(/\.\w+$/, '.jpg');
  return new File([blob], name, { type: mime.includes('png') ? mime : 'image/jpeg', lastModified: Date.now() });
}

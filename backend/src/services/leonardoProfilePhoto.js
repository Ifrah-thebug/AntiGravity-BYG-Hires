/**
 * Leonardo.AI profile photos via REST v2 (Nano Banana 2 — same slug as web UI).
 * Uploads reference image (v1 init-image), generates with image_reference guidance.
 */

const crypto = require('crypto');

const LEONARDO_V1_BASE = 'https://cloud.leonardo.ai/api/rest/v1';
const LEONARDO_V2_BASE = 'https://cloud.leonardo.ai/api/rest/v2';

const DEFAULT_MODEL = 'nano-banana-2';
/** 4:5 @ 1K — matches directory card aspect before sharp frame to 1200×1500 */
const GENERATION_WIDTH = 928;
const GENERATION_HEIGHT = 1152;

/** Soft directory-style backdrops (blurred bokeh, not flat studio solids). */
const BACKGROUND_STYLES = [
  'soft blurred green foliage and garden bokeh, bright natural outdoor professional portrait background with shallow depth of field',
  'warm soft beige neutral wall, gently blurred indoor professional backdrop with shallow depth of field',
  'soft light grey wall with subtle texture, clean modern blurred studio backdrop',
  'soft muted charcoal indoor blur, elegant shallow depth of field, premium portrait backdrop',
  'clean soft off-white to light grey gradient blur, minimalist premium talent-directory backdrop',
];

/** Rotating wardrobe — smart casual, traditional modest, formal (not all suits). */
const WARDROBE_STYLES = [
  'smart casual professional attire: clean fitted polo, fine knit sweater, or simple pressed blouse in navy, white, cream, or soft neutral tones — well ironed, no logos, no wrinkles',
  'refined South Asian professional dress: simple well-fitted shalwar kameez or kurta in cream, white, soft grey, or muted earth tones — crisp, modest, polished everyday professional (not ceremonial)',
  'classic formal business attire: tailored blazer or suit jacket in navy, charcoal, or deep grey with a clean shirt — understated executive look, not flashy',
];

const PROFILE_PROMPT =
  'A highly professional talent-directory headshot for a premium remote hiring platform, matching top marketplace profile cards. Front-facing portrait: subject looks directly at the camera with face and shoulders square to the lens, straight-on angle, centered composition. Consistent 4:5 framing on every image — same zoom and head size across all candidates: head through upper chest/shoulders only, comfortable margin above the head, never cropped at the forehead. For visible faces: face occupies roughly 40% of frame height; crop at mid-chest; never show waist or lower torso even if the reference includes them. For hijab, niqab, or face coverings: show the full head covering and upper shoulders with the same zoom scale as other talent cards — eyes in the upper third, not an extreme eyes-only macro close-up. Background: {background} — subject clearly separated from background, soft bokeh, no clutter, no office props, no text. Strictly preserve the exact cultural modesty of the subject; if the subject wears a hijab, niqab, abaya, or head covering in the reference, it must be perfectly retained including color and coverage — absolutely no hair, neck, or skin revealed if it was covered. Wardrobe: if the reference shows hijab, niqab, abaya, shalwar kameez, kurta, or other modest traditional dress, professionally refine that same cultural dress (better fit and fabric, still modest) — do not westernize into a suit. If the reference shows Western dress, apply this direction: {wardrobe}. Clothing must look clean, well-fitted, and premium — never sloppy, wrinkled, cheap, or loud. Expression: if the face is clearly visible in the reference, warm natural professional closed-lip smile — friendly and approachable, lips gently curved, no visible teeth. If the face is not visible or fully covered (niqab, face veil), do not invent, expose, or redraw facial features. Soft flattering natural or studio lighting, sharp focus on face, photorealistic, 8k quality, unified premium platform aesthetic.';

const NEGATIVE_PROMPT =
  'profile view, side profile, three-quarter angle, turned head, looking away from camera, sideways pose, body turned sideways, over-the-shoulder, candid angle, tilted head, extreme close-up, macro crop, eyes only, tight face crop, cropped forehead, cropped hijab, wide shot, full body, full torso, loose framing, distant subject, small face, face too small, too much body, extra torso, waist visible, stomach visible, hips, belt, legs, hands on hips, lower body, frown, angry face, stern expression, serious face, deadpan, sad expression, toothy smile, teeth showing, visible teeth, open mouth smile, grin, laughing, messy hair, revealing clothing, removing hijab, removing niqab, removing head covering, showing hair, showing neck, neon colors, fluorescent clothing, graphic t-shirt, slogan shirt, hoodie, denim jacket, leather jacket, wrinkled clothes, ill-fitting clothes, cheap fabric, sloppy outfit, party wear, sequins, distracting jewelry, cluttered room, messy office, shelves of objects, harsh shadows on face, flat solid color background, passport photo booth, low quality, blurry face, distorted features, asymmetrical face, bad anatomy, text, watermarks, logos, deformed limbs';

const BACKGROUND_PRESETS = {
  varied: null,
  foliage: BACKGROUND_STYLES[0],
  beige: BACKGROUND_STYLES[1],
  grey: BACKGROUND_STYLES[2],
  charcoal: BACKGROUND_STYLES[3],
  light: BACKGROUND_STYLES[4],
  white: BACKGROUND_STYLES[4],
  black: BACKGROUND_STYLES[3],
};

const REF_STRENGTHS = new Set(['LOW', 'MID', 'HIGH']);

function getApiKey() {
  return String(process.env.LEONARDO_API_KEY || '').trim();
}

function isLeonardoEnabled() {
  if (process.env.PROFILE_PHOTO_PROVIDER === 'legacy') return false;
  return Boolean(getApiKey());
}

function getModelSlug() {
  return String(process.env.LEONARDO_MODEL || DEFAULT_MODEL).trim();
}

function getImageRefStrength() {
  const raw = String(process.env.LEONARDO_IMAGE_REF_STRENGTH || 'HIGH').toUpperCase();
  return REF_STRENGTHS.has(raw) ? raw : 'HIGH';
}

function pickStyleVariant(seedBuffer) {
  const hash = crypto.createHash('sha256').update(seedBuffer).digest();
  const wardrobe = WARDROBE_STYLES[hash[0] % WARDROBE_STYLES.length];
  const background = BACKGROUND_STYLES[hash[1] % BACKGROUND_STYLES.length];
  return { wardrobe, background, wardrobeKey: hash[0] % WARDROBE_STYLES.length, backgroundKey: hash[1] % BACKGROUND_STYLES.length };
}

function getWardrobePhrase(seedBuffer) {
  const mode = String(process.env.LEONARDO_WARDROBE_MODE || 'varied').toLowerCase();
  if (mode === 'casual') return WARDROBE_STYLES[0];
  if (mode === 'traditional' || mode === 'shalwar') return WARDROBE_STYLES[1];
  if (mode === 'formal' || mode === 'suit') return WARDROBE_STYLES[2];
  if (!seedBuffer) return WARDROBE_STYLES[0];
  return pickStyleVariant(seedBuffer).wardrobe;
}

function getBackgroundPhrase(seedBuffer) {
  const key = String(process.env.LEONARDO_PROFILE_BACKGROUND || 'varied').toLowerCase();
  if (key !== 'varied' && BACKGROUND_PRESETS[key]) {
    return BACKGROUND_PRESETS[key];
  }
  if (!seedBuffer) return BACKGROUND_STYLES[0];
  return pickStyleVariant(seedBuffer).background;
}

function buildPrompt(seedBuffer) {
  const wardrobe = getWardrobePhrase(seedBuffer);
  const background = getBackgroundPhrase(seedBuffer);
  return PROFILE_PROMPT.replace('{background}', background).replace('{wardrobe}', wardrobe);
}

function buildFullPrompt(seedBuffer) {
  return `${buildPrompt(seedBuffer)} Avoid: ${NEGATIVE_PROMPT}`;
}

function getPollIntervalMs() {
  const n = parseInt(process.env.LEONARDO_POLL_MS, 10);
  return Number.isFinite(n) && n >= 1000 ? n : 2500;
}

function getPollTimeoutMs() {
  const n = parseInt(process.env.LEONARDO_POLL_TIMEOUT_MS, 10);
  return Number.isFinite(n) && n >= 30000 ? n : 180000;
}

async function leonardoFetch(base, path, { method = 'GET', body } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('LEONARDO_API_KEY is not configured');
  }

  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const detail =
      data?.error
      || data?.detail
      || data?.message
      || (typeof data?.raw === 'string' ? data.raw : null)
      || res.statusText;
    throw new Error(`Leonardo API ${res.status}: ${detail}`);
  }

  return data;
}

function extractGenerationId(data) {
  return (
    data?.sdGenerationJob?.generationId
    || data?.generationId
    || data?.id
    || data?.generation?.id
    || data?.generate?.generationId
    || data?.generations_by_pk?.id
  );
}

function extractStatusAndImageUrl(data) {
  const gen = data?.generations_by_pk || data?.generation || data?.data || data;
  const status = String(gen?.status || data?.status || '').toUpperCase();

  const imageLists = [
    gen?.generated_images,
    gen?.generatedImages,
    gen?.images,
    data?.images,
    data?.generated_images,
  ].filter(Array.isArray);

  for (const images of imageLists) {
    const url = images[0]?.url || images[0]?.imageUrl || images[0]?.uri;
    if (url) return { status, url };
  }

  const directUrl = data?.url || gen?.url;
  if (directUrl) return { status: status || 'COMPLETE', url: directUrl };

  return { status, url: null };
}

async function uploadInitImage(jpegBuffer) {
  const initMeta = await leonardoFetch(LEONARDO_V1_BASE, '/init-image', {
    method: 'POST',
    body: { extension: 'jpg' },
  });

  const upload = initMeta?.uploadInitImage;
  if (!upload?.id || !upload?.url) {
    throw new Error('Leonardo init-image response missing upload details');
  }

  const fields =
    typeof upload.fields === 'string' ? JSON.parse(upload.fields) : upload.fields || {};

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, String(value));
  }
  form.append('file', new Blob([jpegBuffer], { type: 'image/jpeg' }), 'profile.jpg');

  const s3Res = await fetch(upload.url, { method: 'POST', body: form });
  if (!s3Res.ok) {
    const errText = await s3Res.text().catch(() => '');
    throw new Error(`Leonardo S3 upload failed (${s3Res.status}): ${errText.slice(0, 200)}`);
  }

  return upload.id;
}

async function createGeneration(initImageId, seedBuffer) {
  const parameters = {
    width: GENERATION_WIDTH,
    height: GENERATION_HEIGHT,
    prompt: buildFullPrompt(seedBuffer),
    quantity: 1,
    prompt_enhance: 'OFF',
    guidances: {
      image_reference: [
        {
          image: {
            id: initImageId,
            type: 'UPLOADED',
          },
          strength: getImageRefStrength(),
        },
      ],
    },
  };

  const styleId = String(process.env.LEONARDO_STYLE_ID || '').trim();
  if (styleId) {
    parameters.style_ids = [styleId];
  }

  const body = {
    model: getModelSlug(),
    parameters,
    public: false,
  };

  const data = await leonardoFetch(LEONARDO_V2_BASE, '/generations', {
    method: 'POST',
    body,
  });

  const generationId = extractGenerationId(data);
  if (!generationId) {
    throw new Error('Leonardo v2 generation response missing generation id');
  }

  return generationId;
}

async function fetchGenerationStatus(generationId) {
  try {
    return await leonardoFetch(LEONARDO_V2_BASE, `/generations/${generationId}`);
  } catch (err) {
    if (!/404|405|not found/i.test(String(err?.message || ''))) {
      throw err;
    }
    return leonardoFetch(LEONARDO_V1_BASE, `/generations/${generationId}`);
  }
}

async function pollGeneration(generationId) {
  const deadline = Date.now() + getPollTimeoutMs();
  const interval = getPollIntervalMs();

  while (Date.now() < deadline) {
    const data = await fetchGenerationStatus(generationId);
    const { status, url } = extractStatusAndImageUrl(data);

    if (status === 'COMPLETE' && url) {
      return url;
    }

    if (status === 'FAILED') {
      const gen = data?.generations_by_pk || data?.generation || data;
      throw new Error(gen?.failureReason || gen?.failedReason || 'Leonardo generation failed');
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error('Leonardo generation timed out');
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download Leonardo image (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) {
    throw new Error('Leonardo returned an empty image');
  }
  return buf;
}

/**
 * @param {Buffer} jpegBuffer — normalized JPEG from sharp
 * @returns {Promise<{ buffer: Buffer, debug: object }>}
 */
async function enhanceWithLeonardo(jpegBuffer) {
  if (!isLeonardoEnabled()) {
    throw new Error('Leonardo is not configured');
  }

  const model = getModelSlug();
  const style = pickStyleVariant(jpegBuffer);
  const initImageId = await uploadInitImage(jpegBuffer);
  const generationId = await createGeneration(initImageId, jpegBuffer);
  const imageUrl = await pollGeneration(generationId);
  const buffer = await downloadImage(imageUrl);

  return {
    buffer,
    debug: {
      leonardo: 'ok',
      model,
      generationId,
      initImageId,
      wardrobeStyle: style.wardrobeKey,
      backgroundStyle: style.backgroundKey,
    },
  };
}

module.exports = {
  enhanceWithLeonardo,
  isLeonardoEnabled,
  buildPrompt,
  NEGATIVE_PROMPT,
  DEFAULT_MODEL,
};

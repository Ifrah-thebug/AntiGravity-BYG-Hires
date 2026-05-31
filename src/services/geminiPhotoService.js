// src/services/geminiPhotoService.js
// Sends an uploaded profile photo to Gemini and gets back a
// professionally styled black-and-red branded headshot.

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Model that supports image input + image output generation
const MODEL = 'gemini-2.0-flash-preview-image-generation';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const STYLE_PROMPT = `
You are a professional photo editor for a premium remote staffing brand.
Take the person's headshot in this photo and recreate it as a clean, high-quality professional portrait with the following brand style:
- Dark/black background (#0a0a0a or #111111)
- Subtle red (#ff3d3d) accent rim lighting or color grading
- Sharp, high-contrast, crisp rendering
- The person should look professional, confident, and polished
- Keep the person's face, skin tone, and likeness accurate
- Style similar to a premium LinkedIn or executive headshot
- Crop tightly on the face and upper shoulders (portrait orientation 4:5 ratio)
- Do NOT add text, logos, or overlays
Output ONLY the image, no explanations.
`.trim();

/**
 * Stylizes a base64 profile photo using the Gemini image generation API.
 * @param {string} base64Image - Full data URL (data:image/jpeg;base64,...)
 * @returns {Promise<string>} - Stylized image as a data URL, or original on failure
 */
export async function stylizeProfilePhoto(base64Image) {
  if (!GEMINI_API_KEY) {
    console.warn('[Gemini] No API key set — skipping photo stylization.');
    return base64Image;
  }

  // Parse the base64 data URL
  const match = base64Image.match(/^data:(image\/[\w+]+);base64,(.+)$/);
  if (!match) {
    console.warn('[Gemini] Invalid image format — skipping stylization.');
    return base64Image;
  }
  const [, mimeType, base64Data] = match;

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: STYLE_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
          temperature: 1,
          topP: 0.95,
          topK: 40
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Gemini] API error:', response.status, errText);
      return base64Image; // fallback to original
    }

    const data = await response.json();

    // Find the image part in the response
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find(p => p.inline_data?.data);

    if (!imgPart) {
      console.warn('[Gemini] No image returned in response — using original.');
      return base64Image;
    }

    const outMime = imgPart.inline_data.mime_type || 'image/png';
    return `data:${outMime};base64,${imgPart.inline_data.data}`;

  } catch (err) {
    console.error('[Gemini] Photo stylization failed:', err);
    return base64Image; // always fallback gracefully
  }
}

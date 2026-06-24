/**
 * Builds email logo variants in public/:
 *   - byg-hires-email-logo.png          — flat white pad (baseline)
 *   - byg-hires-email-logo-round.png    — pill / capsule (full rounded ends)
 *   - byg-hires-email-logo-rounded.png  — button-style corners (~14px), no border
 *   - byg-hires-email-logo-soft.png     — softer corners (~22px), light border
 *   - byg-hires-email-logo-frame.png    — button-style + slightly stronger border
 * Run: node backend/scripts/generate-email-logo.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '../..');
const candidates = [
  path.join(root, 'public/byg-hires-logo.png'),
  path.join(root, 'src/assets/BYG Hires Logo.png'),
];
const input = candidates.find((p) => fs.existsSync(p));
if (!input) {
  console.error('No source logo found.');
  process.exit(1);
}

const EMAIL_LOGO_WIDTH = 280;
const padding = 16;

async function loadResizedLogo() {
  return sharp(input)
    .resize({ width: EMAIL_LOGO_WIDTH, withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function buildPaddedLogo(resized) {
  const meta = await sharp(resized).metadata();
  const contentW = meta.width + padding * 2;
  const contentH = meta.height + padding * 2;
  const buf = await sharp({
    create: {
      width: contentW,
      height: contentH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resized, top: padding, left: padding }])
    .png()
    .toBuffer();
  return { buf, contentW, contentH };
}

function roundedRectSvg(width, height, radius, { fill = 'white', stroke, strokeWidth = 0 } = {}) {
  const strokeAttr =
    stroke && strokeWidth
      ? `fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"`
      : `fill="${fill}"`;
  const inset = stroke && strokeWidth ? strokeWidth / 2 : 0;
  const w = width - strokeWidth;
  const h = height - strokeWidth;
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${inset}" y="${inset}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" ${strokeAttr}/>
    </svg>`
  );
}

async function clipToShape(paddedBuf, contentW, contentH, radius) {
  const mask = await sharp(roundedRectSvg(contentW, contentH, radius)).png().toBuffer();
  return sharp(paddedBuf)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function addBorder(clippedBuf, contentW, contentH, radius, strokeWidth, strokeColor) {
  const borderLayer = await sharp(
    roundedRectSvg(contentW, contentH, radius, {
      stroke: strokeColor,
      strokeWidth,
    })
  )
    .png()
    .toBuffer();
  return sharp(clippedBuf).composite([{ input: borderLayer }]).png().toBuffer();
}

async function addShadow(clippedBuf, contentW, contentH, radius) {
  const shadowPad = 10;
  const canvasW = contentW + shadowPad * 2;
  const canvasH = contentH + shadowPad * 2;
  const shadowSvg = Buffer.from(
    `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.12"/>
        </filter>
      </defs>
      <rect x="${shadowPad}" y="${shadowPad}" width="${contentW}" height="${contentH}"
        rx="${radius}" ry="${radius}" fill="white" filter="url(#s)"/>
    </svg>`
  );
  const shadowBase = await sharp(shadowSvg).png().toBuffer();
  return sharp(shadowBase)
    .composite([{ input: clippedBuf, top: shadowPad, left: shadowPad }])
    .png()
    .toBuffer();
}

async function writeVariant(name, paddedBuf, contentW, contentH, radius, borderOpts, shadow = false) {
  const out = path.join(root, `public/byg-hires-email-logo-${name}.png`);
  let buf = await clipToShape(paddedBuf, contentW, contentH, radius);
  if (borderOpts) {
    buf = await addBorder(buf, contentW, contentH, radius, borderOpts.width, borderOpts.color);
  }
  if (shadow) {
    buf = await addShadow(buf, contentW, contentH, radius);
  }
  await sharp(buf).png().toFile(out);
  console.log(`  ✓ ${path.basename(out)} (${contentW}x${contentH}, radius ${radius})`);
}

async function buildRectLogo(paddedBuf, contentW, contentH) {
  const out = path.join(root, 'public/byg-hires-email-logo.png');
  await sharp(paddedBuf).png().toFile(out);
  console.log(`  ✓ ${path.basename(out)} (${contentW}x${contentH}, flat)`);
}

(async () => {
  const resized = await loadResizedLogo();
  const { buf: paddedBuf, contentW, contentH } = await buildPaddedLogo(resized);
  const pillRadius = Math.round(contentH / 2);

  console.log('Email logo variants:');
  await buildRectLogo(paddedBuf, contentW, contentH);

  // Pill — keep existing style
  await writeVariant('round', paddedBuf, contentW, contentH, pillRadius, {
    width: 2,
    color: '#e5e7eb',
  });

  // Button-style — no border stroke (clean on light + dark email backgrounds)
  await writeVariant('rounded', paddedBuf, contentW, contentH, 14, null);

  // Softer corners
  await writeVariant('soft', paddedBuf, contentW, contentH, 22, {
    width: 2,
    color: '#e5e7eb',
  });

  // Button-style + stronger border (more visible on white email bg)
  await writeVariant('frame', paddedBuf, contentW, contentH, 14, {
    width: 2,
    color: '#d1d5db',
  });

  // Rounded + subtle shadow (card look)
  let cardBuf = await clipToShape(paddedBuf, contentW, contentH, 14);
  cardBuf = await addShadow(cardBuf, contentW, contentH, 14);
  const cardOut = path.join(root, 'public/byg-hires-email-logo-card.png');
  await sharp(cardBuf).png().toFile(cardOut);
  console.log(`  ✓ ${path.basename(cardOut)} (${contentW}x${contentH}, radius 14 + shadow)`);
})();

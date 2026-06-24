/**
 * Builds public/byg-hires-email-logo.png — site logo on white padding for email (dark-mode safe).
 * Run from repo root: node backend/scripts/generate-email-logo.js
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

const out = path.join(root, 'public/byg-hires-email-logo.png');
const padding = 20;

(async () => {
  const meta = await sharp(input).metadata();
  const w = meta.width + padding * 2;
  const h = meta.height + padding * 2;
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input, top: padding, left: padding }])
    .png()
    .toFile(out);
  console.log(`Wrote ${out} (${w}x${h}) from ${input}`);
})();

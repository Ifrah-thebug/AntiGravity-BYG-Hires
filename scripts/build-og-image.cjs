/**
 * Crop og-image to 1200×630 (center crop = original framing), CTA on the right.
 * Run: node scripts/build-og-image.cjs
 */

const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, '../backend/node_modules/sharp'));

const sourceDefault = path.join(__dirname, '../public/og-image.png');
const backup = path.join(__dirname, '../public/og-image.original.png');
const output = path.join(__dirname, '../public/og-image.png');

// CTA on the right — clear of headline, subheadline, and bottom logo.
const CTA_SVG = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000000" flood-opacity="0.12"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <rect x="800" y="458" width="328" height="56" rx="28" fill="#ff3d3d"/>
  </g>
  <text x="964" y="493" text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700"
    fill="#ffffff">Find a Great Hire &#8594;</text>
</svg>`);

async function main() {
  if (!fs.existsSync(sourceDefault) && !fs.existsSync(backup)) {
    console.error('Missing og-image source');
    process.exit(1);
  }

  if (!fs.existsSync(backup) && fs.existsSync(sourceDefault)) {
    fs.copyFileSync(sourceDefault, backup);
    console.log('Backed up original to og-image.original.png');
  }

  const source = backup;
  const meta = await sharp(source).metadata();
  const targetRatio = 1200 / 630;
  const srcRatio = meta.width / meta.height;

  let cropW;
  let cropH;
  let left;
  let top;

  if (srcRatio > targetRatio) {
    cropH = meta.height;
    cropW = Math.round(meta.height * targetRatio);
    left = Math.round((meta.width - cropW) / 2);
    top = 0;
  } else {
    cropW = meta.width;
    cropH = Math.round(meta.width / targetRatio);
    left = 0;
    // Center crop — preserves original framing (headline + bottom logo).
    top = Math.round((meta.height - cropH) / 2);
  }

  let buf = await sharp(source)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(1200, 630, { fit: 'fill' })
    .composite([{ input: CTA_SVG, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  if (buf.length > 1_000_000) {
    buf = await sharp(buf).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    const jpgOut = output.replace(/\.png$/i, '.jpg');
    await fs.promises.writeFile(jpgOut, buf);
    console.log(`Wrote ${jpgOut} (${buf.length} bytes)`);
  } else {
    await fs.promises.writeFile(output, buf);
    console.log(`Wrote ${output} (${buf.length} bytes)`);
  }

  const check = await sharp(buf).metadata();
  console.log(`Dimensions: ${check.width}x${check.height}, format: ${check.format}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Pure Node.js PWA Icon Generator (no dependencies)
 * Creates simple PNG icons for the punch clock app
 * Run: node generate-icons.js
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function createPNG(width, height, pixels) {
  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);   // Width
  ihdrData.writeUInt32BE(height, 4);  // Height
  ihdrData[8] = 8;                     // Bit depth (8)
  ihdrData[9] = 6;                     // Color type (RGBA)
  ihdrData[10] = 0;                    // Compression
  ihdrData[11] = 0;                    // Filter
  ihdrData[12] = 0;                    // Interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT Chunk - raw image data with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const srcOffset = (y * width + x) * 4;
      rawData[pixelOffset] = pixels[srcOffset];       // R
      rawData[pixelOffset + 1] = pixels[srcOffset + 1]; // G
      rawData[pixelOffset + 2] = pixels[srcOffset + 2]; // B
      rawData[pixelOffset + 3] = pixels[srcOffset + 3]; // A
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idat = createChunk('IDAT', compressed);

  // IEND Chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuffer, data]);

  const crc = crc32(crcInput);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
const crcTable = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Draw the icon
function generateIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const cornerRadius = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Rounded rect mask
      let inRect = true;
      if (x < cornerRadius && y < cornerRadius) {
        const dx = cornerRadius - x;
        const dy = cornerRadius - y;
        inRect = Math.sqrt(dx*dx + dy*dy) <= cornerRadius;
      } else if (x >= size - cornerRadius && y < cornerRadius) {
        const dx = x - (size - cornerRadius);
        const dy = cornerRadius - y;
        inRect = Math.sqrt(dx*dx + dy*dy) <= cornerRadius;
      } else if (x < cornerRadius && y >= size - cornerRadius) {
        const dx = cornerRadius - x;
        const dy = y - (size - cornerRadius);
        inRect = Math.sqrt(dx*dx + dy*dy) <= cornerRadius;
      } else if (x >= size - cornerRadius && y >= size - cornerRadius) {
        const dx = x - (size - cornerRadius);
        const dy = y - (size - cornerRadius);
        inRect = Math.sqrt(dx*dx + dy*dy) <= cornerRadius;
      }

      if (!inRect) {
        pixels[i + 3] = 0; // Transparent
        continue;
      }

      // Background gradient (top to bottom)
      const t = y / size;
      const bgR = Math.round(0 + (0 - 0) * t);      // 0x00 -> 0x00
      const bgG = Math.round(122 + (86 - 122) * t);   // 0x7A -> 0x56
      const bgB = Math.round(255 + (204 - 255) * t);  // 0xFF -> 0xCC

      // Distance from center
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Clock circle outer ring
      const outerRing = r * 0.82;
      const ringHalfWidth = size * 0.04;

      if (dist >= outerRing - ringHalfWidth && dist <= outerRing + ringHalfWidth) {
        // White ring
        const alpha = 1 - Math.abs(dist - outerRing) / ringHalfWidth;
        const a = Math.round(alpha * 255);
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
        pixels[i + 3] = a;
        continue;
      }

      // Clock hands
      const hourHandEndY = cy - r * 0.5;
      const hourHandEndX = cx;
      const hourHalfWidth = size * 0.025;

      if (isOnLine(x, y, cx, cy, hourHandEndX, hourHandEndY, hourHalfWidth) && dist <= r * 0.82) {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
        pixels[i + 3] = 255;
        continue;
      }

      const minHandEndX = cx + r * 0.35;
      const minHandEndY = cy + r * 0.15;
      const minHalfWidth = size * 0.02;

      if (isOnLine(x, y, cx, cy, minHandEndX, minHandEndY, minHalfWidth) && dist <= r * 0.82) {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
        pixels[i + 3] = 255;
        continue;
      }

      // Center dot
      const dotR = size * 0.05;
      if (dist <= dotR) {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
        pixels[i + 3] = 255;
        continue;
      }

      // Small camera rectangle
      const camX = cx + r * 0.5;
      const camY = cy + r * 0.5;
      const camW = size * 0.16;
      const camH = size * 0.12;

      if (Math.abs(x - camX) <= camW / 2 && Math.abs(y - camY + camH * 0.05) <= camH / 2) {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
        pixels[i + 3] = 255;
        continue;
      }

      // Camera lens circle
      const lensDist = Math.sqrt((x - camX) ** 2 + (y - camY) ** 2);
      if (lensDist <= camH * 0.35) {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
        pixels[i + 3] = 255;
        continue;
      }

      // Inner circle fill (light overlay)
      if (dist <= r) {
        const blendAlpha = 0.15;
        pixels[i] = Math.round(bgR + (255 - bgR) * blendAlpha);
        pixels[i + 1] = Math.round(bgG + (255 - bgG) * blendAlpha);
        pixels[i + 2] = Math.round(bgB + (255 - bgB) * blendAlpha);
        pixels[i + 3] = 255;
        continue;
      }

      // Background fill
      pixels[i] = bgR;
      pixels[i + 1] = bgG;
      pixels[i + 2] = bgB;
      pixels[i + 3] = 255;
    }
  }

  return pixels;
}

// Check if point (px,py) is within halfWidth distance of line segment (x1,y1)-(x2,y2)
function isOnLine(px, py, x1, y1, x2, y2, halfWidth) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2) <= halfWidth;
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;
  const dist = Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);

  return dist <= halfWidth;
}

// Generate both icon sizes
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Generating 192x192 icon...');
const pixels192 = generateIcon(192);
const png192 = createPNG(192, 192, pixels192);
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), png192);
console.log('  ✅ icons/icon-192.png');

console.log('Generating 512x512 icon...');
const pixels512 = generateIcon(512);
const png512 = createPNG(512, 512, pixels512);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), png512);
console.log('  ✅ icons/icon-512.png');

console.log('\nDone! Icons generated in the icons/ folder.');

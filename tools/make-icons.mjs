// Generates the extension icons. Writes PNG by hand to avoid a dependency.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const SIZES = [16, 48, 128];
/** The Edge listing wants a square logo per language: 128 is its floor, 300 its recommendation. */
const STORE_LOGO = 300;
/** Rendered at this multiple and box-filtered down, which is where the anti-aliasing comes from. */
const SUPERSAMPLE = 4;

const GROUND = [30, 41, 59];
const PLAYED = [45, 212, 191];
const REMAINING = [118, 132, 150];
const HANDLE = [255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** pixels is RGBA, length size * size * 4. */
function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Each row is prefixed with a filter type byte; 0 means None
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < size * 4; x += 1) {
      raw[y * stride + 1 + x] = pixels[y * size * 4 + x];
    }
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A seek bar and its handle on a flat disc.
 *
 * A disc rather than a rounded square, and one flat colour rather than a gradient, so the
 * mark cannot be read as the branding of the site it runs on. The handle is oversized
 * because at 16px it is the only part that still registers.
 */
function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  const centre = size / 2;
  const discRadius = size * 0.5;
  const barHeight = size * 0.15;
  const barLeft = size * 0.10;
  const barRight = size * 0.90;
  const handleX = size * 0.60;
  const handleRadius = size * 0.17;

  const put = (i, [r, g, b]) => {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      const dx = px - centre;
      const dy = py - centre;
      if (dx * dx + dy * dy > discRadius * discRadius) {
        pixels[i + 3] = 0;
        continue;
      }
      put(i, GROUND);

      if (Math.abs(py - centre) <= barHeight / 2 && px >= barLeft && px <= barRight) {
        put(i, px <= handleX ? PLAYED : REMAINING);
      }

      const hx = px - handleX;
      const hy = py - centre;
      if (hx * hx + hy * hy <= handleRadius * handleRadius) put(i, HANDLE);
    }
  }

  return pixels;
}

/** Box-filters a supersampled buffer down to the target size. */
function downsample(pixels, from, to) {
  const factor = from / to;
  const samples = factor * factor;
  const out = new Uint8Array(to * to * 4);

  for (let y = 0; y < to; y += 1) {
    for (let x = 0; x < to; x += 1) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const i = ((y * factor + sy) * from + (x * factor + sx)) * 4;
          const alpha = pixels[i + 3] / 255;
          r += pixels[i] * alpha;
          g += pixels[i + 1] * alpha;
          b += pixels[i + 2] * alpha;
          a += alpha;
        }
      }
      const o = (y * to + x) * 4;
      // Averaged premultiplied, then unpremultiplied so edge pixels keep their colour
      out[o] = a ? Math.round(r / a) : 0;
      out[o + 1] = a ? Math.round(g / a) : 0;
      out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round((a / samples) * 255);
    }
  }

  return out;
}

const render = (size) => {
  const large = size * SUPERSAMPLE;
  return encodePng(size, downsample(drawIcon(large), large, size));
};

mkdirSync('public/icon', { recursive: true });
for (const size of SIZES) {
  writeFileSync(`public/icon/${size}.png`, render(size));
  console.log(`wrote public/icon/${size}.png`);
}

// Ships with the listing, not with the extension, so it lives beside the screenshots.
mkdirSync('docs/store', { recursive: true });
writeFileSync(`docs/store/logo-${STORE_LOGO}.png`, render(STORE_LOGO));
console.log(`wrote docs/store/logo-${STORE_LOGO}.png`);

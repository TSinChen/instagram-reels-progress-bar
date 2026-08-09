// 產生備用圖示。手寫 PNG，不引入第三方套件。
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

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

/** pixels 是 RGBA，長度 size * size * 4。 */
function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // 每列前面要加 filter type byte，一律用 0（None）
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

/** 紫橘漸層圓角方塊，底部一條白色進度條加圓點。 */
function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const radius = size * 0.22;

  const barY = Math.round(size * 0.72);
  const barHeight = Math.max(1, Math.round(size * 0.07));
  const barLeft = Math.round(size * 0.14);
  const barRight = Math.round(size * 0.86);
  const dotX = Math.round(size * 0.55);
  const dotR = Math.max(1.5, size * 0.11);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;

      if (!insideRoundedSquare(x, y, size, radius)) {
        pixels[i + 3] = 0;
        continue;
      }

      const t = (x / size + y / size) / 2;
      pixels[i] = Math.round(lerp(131, 245, t));
      pixels[i + 1] = Math.round(lerp(58, 133, t));
      pixels[i + 2] = Math.round(lerp(180, 41, t));
      pixels[i + 3] = 255;

      const onBarRow = y >= barY && y < barY + barHeight;
      if (onBarRow && x >= barLeft && x <= barRight) {
        const played = x <= dotX;
        blend(pixels, i, 255, 255, 255, played ? 1 : 0.45);
      }

      const dy = y - (barY + barHeight / 2);
      const dx = x - dotX;
      if (dx * dx + dy * dy <= dotR * dotR) {
        blend(pixels, i, 255, 255, 255, 1);
      }
    }
  }

  return pixels;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function blend(pixels, i, r, g, b, alpha) {
  pixels[i] = Math.round(lerp(pixels[i], r, alpha));
  pixels[i + 1] = Math.round(lerp(pixels[i + 1], g, alpha));
  pixels[i + 2] = Math.round(lerp(pixels[i + 2], b, alpha));
}

function insideRoundedSquare(x, y, size, radius) {
  const nx = Math.min(x, size - 1 - x);
  const ny = Math.min(y, size - 1 - y);
  if (nx >= radius || ny >= radius) return true;
  const dx = radius - nx;
  const dy = radius - ny;
  return dx * dx + dy * dy <= radius * radius;
}

mkdirSync('public/icon', { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(`public/icon/${size}.png`, encodePng(size, drawIcon(size)));
  console.log(`public/icon/${size}.png 已產生`);
}

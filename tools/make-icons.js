// Generates the PNG app icons (no dependencies): `node tools/make-icons.js`
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import zlib from 'node:zlib';

const out = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'icons');
fs.mkdirSync(out, { recursive: true });

const BG = [17, 19, 23];
const FG = [61, 139, 253];

// Dumbbell made of rounded rectangles, in 0..1 coordinates: [x0, y0, x1, y1, radius]
const SHAPES = [
  [0.27, 0.465, 0.73, 0.535, 0.02],  // bar
  [0.25, 0.28, 0.33, 0.72, 0.03],    // inner plates
  [0.67, 0.28, 0.75, 0.72, 0.03],
  [0.175, 0.35, 0.245, 0.65, 0.03],  // outer plates
  [0.755, 0.35, 0.825, 0.65, 0.03],
  [0.13, 0.455, 0.18, 0.545, 0.015], // end caps
  [0.82, 0.455, 0.87, 0.545, 0.015],
];

function inRoundRect(x, y, [x0, y0, x1, y1, r]) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function render(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.72 : 0.9;     // maskable icons need a safe zone
  const bgRadius = maskable ? 0 : 0.22;
  const SS = 4;                             // supersampling for smooth edges
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let bg = 0, fg = 0;
      for (let sj = 0; sj < SS; sj++) for (let si = 0; si < SS; si++) {
        const x = (i + (si + 0.5) / SS) / size, y = (j + (sj + 0.5) / SS) / size;
        if (!inRoundRect(x, y, [0, 0, 1, 1, bgRadius])) continue;
        bg++;
        const ux = (x - 0.5) / scale + 0.5, uy = (y - 0.5) / scale + 0.5;
        if (SHAPES.some(s => inRoundRect(ux, uy, s))) fg++;
      }
      const n = SS * SS, a = bg / n, f = bg ? fg / bg : 0, o = (j * size + i) * 4;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(BG[c] * (1 - f) + FG[c] * f);
      px[o + 3] = Math.round(a * 255);
    }
  }
  return png(size, size, px);
}

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) {
  fs.writeFileSync(path.join(out, name), render(size, { maskable }));
  console.log('wrote icons/' + name);
}

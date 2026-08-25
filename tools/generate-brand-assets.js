const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const webIcons = path.join(root, 'assets', 'icons');
const desktopIcons = path.join(root, 'src-tauri', 'icons');
fs.mkdirSync(webIcons, { recursive: true });
fs.mkdirSync(desktopIcons, { recursive: true });

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const rows = [];
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    rows.push(Buffer.from([0]));
    rows.push(Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function hex(value) {
  const raw = value.replace('#', '');
  return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16), raw.length === 8 ? parseInt(raw.slice(6, 8), 16) : 255];
}

function blend(buffer, index, color, alpha = 1) {
  const sourceAlpha = (color[3] / 255) * alpha;
  const targetAlpha = buffer[index + 3] / 255;
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) return;
  for (let channel = 0; channel < 3; channel++) {
    buffer[index + channel] = Math.round((color[channel] * sourceAlpha + buffer[index + channel] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  }
  buffer[index + 3] = Math.round(outAlpha * 255);
}

function roundedRect(x, y, left, top, width, height, radius) {
  const right = left + width;
  const bottom = top + height;
  if (x >= left + radius && x <= right - radius && y >= top && y <= bottom) return true;
  if (y >= top + radius && y <= bottom - radius && x >= left && x <= right) return true;
  const corners = [
    [left + radius, top + radius], [right - radius, top + radius],
    [left + radius, bottom - radius], [right - radius, bottom - radius]
  ];
  return corners.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2);
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects = ((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const lengthSquared = vx * vx + vy * vy;
  if (!lengthSquared) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lengthSquared));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function drawLogo(size) {
  const supersample = size <= 64 ? 4 : 3;
  const width = size * supersample;
  const height = width;
  const rgba = new Uint8Array(width * height * 4);
  const palette = {
    background: hex('#F5F7FA'),
    blueA: hex('#426F9F'),
    blueB: hex('#244A75'),
    fold: hex('#7FA1C5'),
    white: hex('#FFFFFF'),
    gold: hex('#B28A46'),
    cream: hex('#F7F4EC')
  };

  const sample = (x, y) => {
    const u = x / width * 64;
    const v = y / height * 64;
    const colors = [];
    if (roundedRect(u, v, 0, 0, 64, 64, 15)) colors.push([palette.background, 1]);

    const document = roundedRect(u, v, 11, 6, 40, 53, 4) && !pointInPolygon(u, v, [[40, 6], [51, 17], [51, 6]]);
    if (document) {
      const mix = Math.max(0, Math.min(1, (u + v - 16) / 82));
      colors.push([[
        Math.round(palette.blueA[0] * (1 - mix) + palette.blueB[0] * mix),
        Math.round(palette.blueA[1] * (1 - mix) + palette.blueB[1] * mix),
        Math.round(palette.blueA[2] * (1 - mix) + palette.blueB[2] * mix), 255
      ], 1]);
    }
    if (pointInPolygon(u, v, [[40, 6], [51, 17], [44, 19], [40, 15]])) colors.push([palette.fold, .9]);

    const vertical = u >= 23 && u <= 29 && v >= 22 && v <= 44;
    const outerEllipse = ((u - 30.5) / 11.5) ** 2 + ((v - 33) / 11) ** 2 <= 1 && u >= 25;
    const innerEllipse = ((u - 30.5) / 5.7) ** 2 + ((v - 33) / 6) ** 2 <= 1 && u >= 29;
    if (vertical || (outerEllipse && !innerEllipse)) colors.push([palette.white, 1]);

    const seal = (u - 47) ** 2 + (v - 49) ** 2 <= 7 ** 2;
    const sealBorder = (u - 47) ** 2 + (v - 49) ** 2 <= 9 ** 2;
    if (sealBorder) colors.push([palette.cream, 1]);
    if (seal) colors.push([palette.gold, 1]);
    const checkDistance = Math.min(
      distanceToSegment(u, v, 43.8, 49, 45.9, 51.1),
      distanceToSegment(u, v, 45.9, 51.1, 50.2, 46.7)
    );
    if (checkDistance <= 1.05) colors.push([palette.white, 1]);
    return colors;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      for (const [color, alpha] of sample(x + .5, y + .5)) blend(rgba, index, color, alpha);
    }
  }

  if (supersample === 1) return encodePng(width, height, rgba);
  const down = new Uint8Array(size * size * 4);
  const area = supersample * supersample;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < supersample; sy++) for (let sx = 0; sx < supersample; sx++) {
        const source = (((y * supersample + sy) * width) + x * supersample + sx) * 4;
        for (let channel = 0; channel < 4; channel++) totals[channel] += rgba[source + channel];
      }
      const target = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel++) down[target + channel] = Math.round(totals[channel] / area);
    }
  }
  return encodePng(size, size, down);
}

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const directory = Buffer.alloc(images.length * 16);
  let offset = header.length + directory.length;
  images.forEach((image, index) => {
    const entry = index * 16;
    directory[entry] = image.size >= 256 ? 0 : image.size;
    directory[entry + 1] = image.size >= 256 ? 0 : image.size;
    directory[entry + 2] = 0;
    directory[entry + 3] = 0;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(image.buffer.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.buffer.length;
  });
  return Buffer.concat([header, directory, ...images.map(image => image.buffer)]);
}

const iconSizes = [32, 64, 128, 192, 256, 512];
const icons = new Map(iconSizes.map(size => [size, drawLogo(size)]));
for (const [size, buffer] of icons) {
  fs.writeFileSync(path.join(webIcons, `icon-${size}.png`), buffer);
}
fs.copyFileSync(path.join(webIcons, 'icon-512.png'), path.join(desktopIcons, 'icon.png'));
fs.copyFileSync(path.join(webIcons, 'icon-32.png'), path.join(desktopIcons, '32x32.png'));
fs.copyFileSync(path.join(webIcons, 'icon-128.png'), path.join(desktopIcons, '128x128.png'));
fs.copyFileSync(path.join(webIcons, 'icon-256.png'), path.join(desktopIcons, '128x128@2x.png'));
fs.writeFileSync(path.join(desktopIcons, 'icon.ico'), encodeIco([32, 64, 128, 256].map(size => ({ size, buffer: icons.get(size) }))));

console.log(`Identidad raster generada: ${iconSizes.join(', ')} px e icon.ico.`);

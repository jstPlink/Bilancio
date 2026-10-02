// Genera le icone PNG dell'app (PWA) in public/: node scripts/genera-icone.mjs
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

function icona(size, { maskable = false } = {}) {
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#0f766e';
  if (maskable) g.fillRect(0, 0, size, size);
  else { g.beginPath(); g.roundRect(0, 0, size, size, size / 4); g.fill(); }
  // Il disegno (viewBox 32) occupa il 62% al centro per le icone "maskable", il 100% altrimenti.
  const k = (maskable ? 0.62 : 1) * size / 32;
  const off = (size - 32 * k) / 2;
  g.strokeStyle = '#fff';
  g.lineWidth = 2.4 * k;
  g.lineCap = 'round';
  g.beginPath();
  for (const [a, b, x, y] of [[8, 21, 24, 21], [16, 9, 16, 21], [9, 13, 23, 13]]) { g.moveTo(off + a * k, off + b * k); g.lineTo(off + x * k, off + y * k); }
  g.stroke();
  return c.toBuffer('image/png');
}

writeFileSync('public/icon-192.png', icona(192));
writeFileSync('public/icon-512.png', icona(512));
writeFileSync('public/icon-maskable-512.png', icona(512, { maskable: true }));
writeFileSync('public/apple-touch-icon.png', icona(180, { maskable: true }));

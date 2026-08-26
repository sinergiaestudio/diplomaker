const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist-web');
const entries = [
  'index.html',
  'manifest.webmanifest',
  'version.json',
  'sw.js',
  '.nojekyll',
  'styles',
  'src',
  'vendor',
  'assets',
  'examples',
  'docs',
  'README.md',
  'LICENSE',
  'NOTICE.md',
  'PRIVACY.md'
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  if (!fs.existsSync(source)) throw new Error(`No se encontró ${entry}`);
  fs.cpSync(source, path.join(dist, entry), { recursive: true });
}

console.log(`Paquete web preparado en ${path.relative(root, dist)}.`);

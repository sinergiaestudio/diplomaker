const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicVersion = process.argv[2];
const bundleVersion = process.argv[3];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(publicVersion || '')) {
  throw new Error('Indicá una versión pública semántica válida.');
}
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(bundleVersion || '')) {
  throw new Error('Indicá una versión de paquete válida.');
}

const alphaNumber = (publicVersion.match(/alpha\.(\d+)/) || [])[1] || '0';
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, content) => fs.writeFileSync(path.join(root, rel), content.replace(/\r?\n/g, '\n'), 'utf8');

function updateJson(rel, mutate) {
  const value = JSON.parse(read(rel));
  mutate(value);
  write(rel, `${JSON.stringify(value, null, 2)}\n`);
}

updateJson('package.json', value => {
  value.version = bundleVersion;
});

updateJson('version.json', value => {
  value.version = publicVersion;
  value.bundleVersion = bundleVersion;
  value.channel = publicVersion.includes('-') ? publicVersion.split('-')[1].split('.')[0] : 'stable';
  value.build = new Date().toISOString().slice(0, 10);
});

updateJson('src-tauri/tauri.conf.json', value => {
  value.version = bundleVersion;
});

let cargo = read('src-tauri/Cargo.toml');
cargo = cargo.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${bundleVersion}"`);
write('src-tauri/Cargo.toml', cargo);

let experience = read('src/experience.js');
experience = experience.replace(/const APP_VERSION = '[^']+';/, `const APP_VERSION = '${publicVersion}';`);
write('src/experience.js', experience);

let embedded = read('src/embedded-assets.js');
embedded = embedded.replace(/2\.2\.0-alpha\.\d+/g, publicVersion);
write('src/embedded-assets.js', embedded);

let serviceWorker = read('sw.js');
serviceWorker = serviceWorker
  .replace(/const VERSION = '[^']+';/, `const VERSION = '${publicVersion}';`)
  .replace(/diplomaker-2-2-alpha-\d+/g, `diplomaker-2-2-alpha-${alphaNumber}`);
write('sw.js', serviceWorker);

let readme = read('README.md');
readme = readme
  .replace(/2\.2\.0--alpha\.\d+/g, publicVersion.replace('-', '--'))
  .replace(/v2\.2\.0-alpha\.\d+/g, `v${publicVersion}`)
  .replace(/Diplomaker-2\.2\.0-alpha\.\d+/g, `Diplomaker-${publicVersion}`);
write('README.md', readme);

let installation = read('docs/INSTALLATION.md');
installation = installation
  .replace(/v2\.2\.0-alpha\.\d+/g, `v${publicVersion}`)
  .replace(/Diplomaker-2\.2\.0-alpha\.\d+/g, `Diplomaker-${publicVersion}`);
write('docs/INSTALLATION.md', installation);

let workflow = read('.github/workflows/publish-alpha.yml');
workflow = workflow
  .replace(/name: Publicar Diplomaker 2\.2 alpha \d+/, `name: Publicar Diplomaker 2.2 alpha ${alphaNumber}`)
  .replace(/TAG_NAME: v[^\n]+/, `TAG_NAME: v${publicVersion}`)
  .replace(/DISPLAY_VERSION: [^\n]+/, `DISPLAY_VERSION: ${publicVersion}`)
  .replace(/# Diplomaker 2\.2 alpha \d+/, `# Diplomaker 2.2 alpha ${alphaNumber}`)
  .replace(/Primera versión de prueba de \*\*Diplomaker 2\.2/, `Versión de prueba actualizada de **Diplomaker 2.2`);
write('.github/workflows/publish-alpha.yml', workflow);

const changelogPath = 'CHANGELOG.md';
let changelog = read(changelogPath);
if (!changelog.includes(`## ${publicVersion}`)) {
  const entry = `## ${publicVersion} — ${new Date().toISOString().slice(0, 10)}\n\n- identidad visual oficial aplicada en web y escritorio;\n- iconos y portada social regenerados;\n- tema claro predeterminado y tema oscuro persistente;\n- biblioteca y respaldo de proyectos;\n- persistencia adicional en la edición Windows;\n- mejoras de instalación, actualización y experiencia móvil.\n\n`;
  changelog = changelog.replace(/^# Changelog\s*/i, `# Changelog\n\n${entry}`);
  write(changelogPath, changelog);
}

console.log(`Diplomaker actualizado a ${publicVersion} · paquete ${bundleVersion}`);

const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const required=[
  'index.html','manifest.webmanifest','version.json','sw.js',
  'styles/app.css','styles/experience.css','vendor/jszip.min.js',
  'src/utils.js','src/csv-reader.js','src/xlsx-reader.js','src/embedded-assets.js','src/templates.js','src/template-studio.js','src/experience.js','src/renderer.js','src/pdf-writer.js','src/storage.js','src/app.js',
  'assets/brand/diplomaker-symbol.svg','assets/brand/diplomaker-horizontal.svg','assets/brand/diplomaker-horizontal-dark.svg','assets/brand/diplomaker-monochrome.svg','assets/brand/favicon.svg',
  'assets/templates/clasico.svg','assets/templates/moderno.svg','assets/templates/academico.svg','assets/icons/icon-192.png','assets/icons/icon-512.png',
  'docs/BRAND.md','LICENSE','PRIVACY.md','NOTICE.md'
];
let failed=false;
for(const rel of required){const file=path.join(root,rel);if(!fs.existsSync(file)){console.error(`FALTA: ${rel}`);failed=true;}else console.log(`OK: ${rel}`);}
for(const rel of required.filter(name=>name.endsWith('.js'))){try{new Function(fs.readFileSync(path.join(root,rel),'utf8'));}catch(error){console.error(`JS inválido: ${rel}\n${error.message}`);failed=true;}}
const words=['juicio por '+'jurados','poder '+'judicial','mesa '+'federal','universidad nacional del '+'oeste','cm '+'caba','chubut','iajj'];
const forbidden=new RegExp(words.join('|'),'i'),extensions=new Set(['.html','.js','.md','.json','.csv','.txt','.svg','.css']);
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='.git'||entry.name==='vendor')continue;const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(extensions.has(path.extname(entry.name))&&path.resolve(full)!==path.resolve(__filename)){const text=fs.readFileSync(full,'utf8');if(forbidden.test(text)){console.error(`REFERENCIA NO PÚBLICA: ${path.relative(root,full)}`);failed=true;}}}}
walk(root);
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(!indexSource.includes('src/template-studio.js')){console.error('El Estudio de plantillas no está enlazado desde index.html.');failed=true;}
const embeddedAssets=fs.readFileSync(path.join(root,'src/embedded-assets.js'),'utf8');
if(!embeddedAssets.includes('src/experience.js')){console.error('La experiencia 2.2 no se carga desde embedded-assets.js.');failed=true;}
if(!embeddedAssets.includes('styles/experience.css')){console.error('El sistema visual 2.2 no se carga desde embedded-assets.js.');failed=true;}
const serviceWorker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
for(const asset of ['src/template-studio.js','src/experience.js','styles/experience.css','assets/brand/diplomaker-symbol.svg','version.json']){if(!serviceWorker.includes(asset)){console.error(`Falta en caché offline: ${asset}`);failed=true;}}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
if(manifest.background_color!=='#f5f7fa'){console.error('El manifiesto no usa el tema claro como fondo predeterminado.');failed=true;}
const version=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8'));
if(!/^2\.2\./.test(version.version||'')){console.error('version.json no identifica Diplomaker 2.2.');failed=true;}
if(failed)process.exit(1);
console.log('Control estático, de integración, identidad y sanitización completado sin errores.');

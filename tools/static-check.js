const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const required=['index.html','styles/app.css','vendor/jszip.min.js','src/utils.js','src/csv-reader.js','src/xlsx-reader.js','src/embedded-assets.js','src/templates.js','src/template-studio.js','src/renderer.js','src/pdf-writer.js','src/storage.js','src/app.js','assets/templates/clasico.svg','assets/templates/moderno.svg','assets/templates/academico.svg','assets/icons/icon-192.png','assets/icons/icon-512.png','LICENSE','PRIVACY.md','NOTICE.md'];
let failed=false;
for(const rel of required){const file=path.join(root,rel);if(!fs.existsSync(file)){console.error(`FALTA: ${rel}`);failed=true;}else console.log(`OK: ${rel}`);}
for(const rel of required.filter(name=>name.endsWith('.js'))){try{new Function(fs.readFileSync(path.join(root,rel),'utf8'));}catch(error){console.error(`JS inválido: ${rel}\n${error.message}`);failed=true;}}
const words=['juicio por '+'jurados','poder '+'judicial','mesa '+'federal','universidad nacional del '+'oeste','cm '+'caba','chubut','iajj'];
const forbidden=new RegExp(words.join('|'),'i'),extensions=new Set(['.html','.js','.md','.json','.csv','.txt','.svg']);
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='.git'||entry.name==='vendor')continue;const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(extensions.has(path.extname(entry.name))&&path.resolve(full)!==path.resolve(__filename)){const text=fs.readFileSync(full,'utf8');if(forbidden.test(text)){console.error(`REFERENCIA NO PÚBLICA: ${path.relative(root,full)}`);failed=true;}}}}
walk(root);
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(!indexSource.includes('src/template-studio.js')){console.error('El Estudio de plantillas no está enlazado desde index.html.');failed=true;}
const serviceWorker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
if(!serviceWorker.includes('src/template-studio.js')){console.error('El Estudio de plantillas no está incluido en el caché offline.');failed=true;}
if(failed)process.exit(1);
console.log('Control estático, de integración y de sanitización completado sin errores.');

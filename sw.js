const CACHE='diplomaker-public-2-1-beta-1';
const ASSETS=[
  './',
  './index.html',
  './styles/app.css',
  './manifest.webmanifest',
  './vendor/jszip.min.js',
  './src/utils.js',
  './src/csv-reader.js',
  './src/xlsx-reader.js',
  './src/embedded-assets.js',
  './src/templates.js',
  './src/template-studio.js',
  './src/renderer.js',
  './src/pdf-writer.js',
  './src/storage.js',
  './src/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match('./index.html'))));
});

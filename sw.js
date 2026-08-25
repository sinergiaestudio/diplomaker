const VERSION = '2.2.0-alpha.1';
const CACHE = `diplomaker-app-${VERSION}`;
const FALLBACK = './index.html';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './version.json',
  './styles/app.css',
  './styles/experience.css',
  './styles/polish.css',
  './vendor/jszip.min.js',
  './src/utils.js',
  './src/csv-reader.js',
  './src/xlsx-reader.js',
  './src/embedded-assets.js',
  './src/templates.js',
  './src/template-studio.js',
  './src/desktop.js',
  './src/experience.js',
  './src/polish.js',
  './src/renderer.js',
  './src/pdf-writer.js',
  './src/storage.js',
  './src/app.js',
  './assets/brand/diplomaker-symbol.svg',
  './assets/brand/diplomaker-horizontal.svg',
  './assets/brand/diplomaker-horizontal-dark.svg',
  './assets/brand/favicon.svg',
  './assets/templates/clasico.svg',
  './assets/templates/moderno.svg',
  './assets/templates/academico.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('diplomaker-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  } catch (_) {
    return (await cache.match(request)) || (await cache.match(FALLBACK));
  }
}

async function cacheFirstWithRefresh(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response?.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || cache.match(FALLBACK);
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request)));
    return;
  }

  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirstWithRefresh(event.request));
});

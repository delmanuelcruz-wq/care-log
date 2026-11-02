// Care Log offline support: keeps the app files cached so it opens without internet.
// Bump VERSION whenever app files change so phones pick up the new copy.
const VERSION = 'carelog-v1.0.0';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/core.js',
  'js/charts.js',
  'js/today.js',
  'js/symptoms.js',
  'js/labs.js',
  'js/visits.js',
  'js/treatment.js',
  'js/more.js',
  'js/app.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// Same-site files: try the network first (so updates show up), fall back to the cache when
// offline or slow. Other sites (the research search) go straight to the network.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await Promise.race([
        fetch(req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('slow network')), 4000)),
      ]);
      if (res && res.ok) event.waitUntil(cache.put(req, res.clone()));
      return res;
    } catch (e) {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});

/* Root GitHub Pages offline cache. Root and /web/ pages use separate SW scopes. */
const CACHE = 'chronos-root-v2.1.0-beta.1-mission';
const ASSETS = [
  './', './index.html', './web/index.html',
  './web/styles.css', './web/app.js',
  './web/sound-studio.js', './web/sound-studio.css',
  './web/cloud-sync.js', './web/cloud-sync.css', './web/control-center.css', './web/mission-control.css', './web/mission-engine.js',
  './web/icon.svg', './web/icon-192.png', './web/icon-512.png',
  './web/manifest.webmanifest'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('chronos-root-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});

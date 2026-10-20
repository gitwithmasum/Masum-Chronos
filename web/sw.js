/* Minimal offline cache for local PWA; no external requests. */
const CACHE = 'masum-chronos-2.4.0-beta.1-universal-widgets';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './sound-studio.js', './sound-studio.css', './cloud-sync.js', './cloud-sync.css', './control-center.css', './mission-control.css', './calendar-command.css', './intelligence.css', './mission-engine.js', './productivity-intelligence.js', './widgets/widget.html', './widgets/widget.css', './widgets/widget.js', './widgets/widget-core.js', './widgets/chronos-widgets.js', './widgets/studio.html', './widgets/studio.css', './widgets/studio.js', './icon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('masum-chronos-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); }
    return response;
  }).catch(() => caches.match(event.request)));
});

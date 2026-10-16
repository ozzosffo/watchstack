'use strict';
const CACHE = 'watchstack-v1.3.0-20261016';
const CORE = ['./', './index.html', './styles.css?v=1.3.0', './catalog.js?v=1.3.0', './app.js?v=1.3.0',
  './manifest.webmanifest', './assets/icon-192.png', './assets/icon-512.png'];
const INDEX = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  // Existing clients choose when to update so an open edit form is never reloaded.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('watchstack-v1.') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  let response;
  try {
    response = await fetch(request, { signal: controller.signal });
    if (response.ok) {
      try { await cache.put(request, response.clone()); } catch { /* A full cache must not block a live response. */ }
      return response;
    }
  } catch { /* Use the saved shell when offline or the connection stalls. */ }
  finally { clearTimeout(timer); }
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  if (request.mode === 'navigate') {
    const shell = await cache.match(INDEX);
    if (shell) return shell;
  }
  // Never serve HTML as a missing script, image, or stylesheet.
  return response || new Response('Offline: this file is not cached.', { status: 503, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(networkFirst(event.request));
});

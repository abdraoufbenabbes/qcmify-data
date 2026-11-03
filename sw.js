/* QCMify service worker — offline app shell + question banks.
 *
 * Deploy this file next to index.html (same directory, same origin) so its scope
 * covers the app. Bump CACHE on every release; the page shows a "new version"
 * toast when a new worker is waiting.
 */
const CACHE = 'qcmify-v1.8.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // fonts, analytics: untouched

  /* question banks — network first so a content update shows up immediately,
     cache fallback so a module already opened stays readable offline */
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || Response.error()))
    );
    return;
  }

  /* app shell — cache first, quietly refreshed in the background */
  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});

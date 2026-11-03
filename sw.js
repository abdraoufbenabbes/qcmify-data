/* QCMify service worker — offline app shell + question banks.
 *
 * Strategy v1.8.2 (the first deployment taught us something):
 *
 *   · navigations + shell files → NETWORK FIRST, revalidated with `no-cache`.
 *     The cache is only the offline fallback. A deploy is therefore picked up on
 *     the very next load, with no "clear site data" ritual.
 *
 *   · question banks (*.json) → stale-while-revalidate. The app versions those
 *     URLs with ?v=DATA_VERSION, so a changed bank is a new URL anyway.
 *
 * Why the change: the previous cache-first shell re-filled its cache from the
 * browser's HTTP cache (10 min on GitHub Pages), so a client could keep serving
 * the old index.html long after a deploy — the only escape was clearing site data.
 * Precaching now bypasses the HTTP cache (`cache: 'reload'`) and every navigation
 * revalidates (`cache: 'no-cache'`).
 *
 * Bump CACHE on every deploy so activate() drops the previous one.
 */
const CACHE = 'qcmify-v1.9.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (url) => {
      try {
        /* 'reload' bypasses the HTTP cache: never precache a stale shell */
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (e) { /* a missing asset must not block installation */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Navigations carry mode:'navigate', which cannot be re-wrapped with new init
   options — fetch the URL instead of the Request object. */
function freshFetch(url) {
  return fetch(url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'follow' });
}

async function networkFirst(request, fallbackUrl) {
  try {
    const res = request.mode === 'navigate'
      ? await freshFetch(request.url)
      : await fetch(request, { cache: 'no-cache' });
    if (res && res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const shell = await caches.match(fallbackUrl);
      if (shell) return shell;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request, { cache: 'no-cache' })
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // fonts, analytics: untouched

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './index.html'));
    return;
  }
  if (url.pathname.endsWith('.json')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  event.respondWith(networkFirst(req));
});

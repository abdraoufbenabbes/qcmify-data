/* QCMify service worker — offline app shell + question banks.
 *
 * Strategy v1.9.0:
 *
 *   · navigations + shell files → NETWORK FIRST, revalidated with `no-cache`,
 *     with a short network timeout. The cache is only the offline fallback.
 *     A deploy is picked up on the very next load, and a slow/flaky connection
 *     shows the cached shell instead of a blank page.
 *
 *   · question banks (*.json) → stale-while-revalidate. The app versions those
 *     URLs with ?v=DATA_VERSION, so a changed bank is a new URL anyway.
 *
 *   · shell precache bypasses the HTTP cache (`cache: 'reload'`) and every
 *     navigation revalidates (`cache: 'no-cache'`), so a client cannot keep
 *     serving an old index.html after a deploy.
 *
 * Note: banks and the manifest now live under the same origin as the app
 * (DATA_BASE is relative), so they are cacheable here both in production and
 * when running the app from localhost.
 *
 * Bump CACHE on every deploy so activate() drops the previous one.
 */
const CACHE = 'qcmify-v1.9.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

/* How long a navigation may wait for the network before the cached shell wins.
   A flaky connection (not a clean offline) used to hang the page indefinitely. */
const NETWORK_TIMEOUT_MS = 4000;

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

/* Cache writes are attached to the event so the worker is not stopped before
   they finish. Errors (quota, aborted request) must never break the response. */
function cachePut(event, request, res) {
  if (!res || !res.ok) return;
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.put(request, res.clone()))
      .catch(() => {})
  );
}

async function networkFirst(event, request, fallbackUrl) {
  const network = (request.mode === 'navigate'
    ? freshFetch(request.url)
    : fetch(request, { cache: 'no-cache' }))
    .then((res) => {
      cachePut(event, request, res);
      return res;
    })
    .catch(() => null);

  const cached = await caches.match(request);

  /* No cache available: the network is the only answer, even if it is slow. */
  if (!cached && !fallbackUrl) return (await network) || Response.error();

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS);
  });
  const winner = await Promise.race([network, timeout]);
  clearTimeout(timer);
  if (winner) return winner;

  /* Slow network: serve the shell now; the in-flight request still refreshes
     the cache when it eventually settles. */
  const fallback = cached || (fallbackUrl ? await caches.match(fallbackUrl) : null);
  if (fallback) return fallback;
  return (await network) || Response.error();
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request, { cache: 'no-cache' })
    .then((res) => {
      if (res && res.ok) {
        event.waitUntil(cache.put(request, res.clone()).catch(() => {}));
      }
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
    event.respondWith(networkFirst(event, req, './index.html'));
    return;
  }
  if (url.pathname.endsWith('.json')) {
    event.respondWith(staleWhileRevalidate(event, req));
    return;
  }
  event.respondWith(networkFirst(event, req));
});

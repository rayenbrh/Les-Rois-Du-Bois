/*
 * Service worker - safe for continuous deployments.
 *  - Pages (navigations): network first, cached copy only when offline.
 *  - Hashed build assets (/assets/*) and images: cache first (they never change).
 *  - API and cross-origin requests: never touched.
 * Bump VERSION to drop every previous cache.
 */
const VERSION = 'v3';
const STATIC_CACHE = `lrdb-static-${VERSION}`;
const PAGE_CACHE = `lrdb-pages-${VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(['/logo-light.webp', '/logo-dark.webp', '/favicon.png']).catch(() => {})
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  // HTML navigations: always try the network so new deployments are picked up immediately
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put('/', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error()))
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith('/assets/') || /\.(webp|png|jpg|jpeg|svg|ico|woff2?)$/i.test(url.pathname);
  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
    )
  );
});

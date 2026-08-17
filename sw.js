/* Runae — Service Worker (PWA base)
 * Scope: "/" (served from /sw.js → controls whole site)
 *
 * Strategy summary:
 *   - Static assets  → cache-first (fast, offline-capable)
 *   - /api/*         → NETWORK-ONLY, never cached (dynamic astrology + paid content)
 *   - Navigations    → network-first, fall back to cache, then /offline.html
 *   - Push           → scaffold only (structure + notificationclick), no live push service yet
 *
 * Bump CACHE_VERSION to bust all caches on the next activate.
 */

const CACHE_VERSION = 'runae-v1';
const CACHE_STATIC  = `runae-static-${CACHE_VERSION}`;

/* Conservative precache list — core shell + offline page only.
 * Do NOT add /api/* here. Keep this small; anything else is cached lazily. */
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/icon.svg',
  '/favicon.svg',
  '/pages/home-en.html'   // start_url (built by the homepage agent)
];

/* Never touch the network cache for these path prefixes. */
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

/* Same-origin only helper. */
function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

/* ── install: precache shell, tolerate individual misses ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) =>
      // addAll is atomic (fails all if one 404s). Add individually so a
      // not-yet-built page (e.g. home-en.html) never breaks install.
      Promise.all(
        PRECACHE_URLS.map((u) =>
          cache.add(u).catch((err) => console.warn('[sw] precache skip:', u, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* ── activate: drop caches from previous versions ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_STATIC).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── fetch: routing ── */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET. POST/PUT (forms, payments) pass straight through.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ignore cross-origin (CDN, analytics, fonts on other hosts, etc.).
  if (!isSameOrigin(url)) return;

  // 1) /api/* → NETWORK-ONLY. Never read or write cache.
  //    Guarantees dynamic BaZi/fortune results and paid content are never stale.
  if (isApiRequest(url)) {
    event.respondWith(fetch(req));
    return;
  }

  // 2) Navigations (HTML documents) → network-first, then cache, then offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // 3) Static assets (css/js/img/fonts/svg) → cache-first, lazily populate.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Only cache clean, complete, same-origin 200s.
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_STATIC).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached); // no cache + offline → let it fail naturally
    })
  );
});

/* ──────────────────────────────────────────────────────────────
 * PUSH NOTIFICATIONS — SCAFFOLD ONLY (future "daily fortune" push)
 *
 * Wiring left intentionally inert: no push service / VAPID keys yet.
 * To activate later:
 *   1. Generate VAPID keys, expose public key to the client.
 *   2. Client: registration.pushManager.subscribe({ userVisibleOnly:true,
 *        applicationServerKey: <vapidPublicKey> }) → POST subscription to backend.
 *   3. Backend: send Web Push payloads { title, body, url, icon }.
 * The handlers below already render + route notifications once payloads arrive.
 * ────────────────────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Runae', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Runae';
  const options = {
    body: data.body || 'Your daily fortune is ready.',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'runae-daily',
    data: { url: data.url || '/pages/home-en.html' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/pages/home-en.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab if one is already open, else open a new one.
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

/* Allow the page to trigger an immediate SW update (optional helper). */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

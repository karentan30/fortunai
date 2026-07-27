/* 善缘 Service Worker — 离线缓存 + 推送通知 */

const CACHE = 'shenyuan-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
  '/assets/css/style.css'
];

/* ── 安装：预缓存核心资源 ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── 激活：清理旧缓存 ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
          .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── 请求拦截：网络优先，离线回退到缓存 ── */
self.addEventListener('fetch', function(event) {
  // 只拦截同源 GET 请求
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // 成功的响应才缓存
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        // 网络失败 → 从缓存取
        return caches.match(event.request).then(function(cached) {
          return cached || new Response('离线模式 — 请检查网络连接', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

/* ── 推送通知接收 ── */
self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: '善缘', body: event.data ? event.data.text() : '' };
  }

  var title = data.title || '善缘 ShenYuan';
  var options = {
    body: data.body || '您有一条新的运势消息',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: data.url ? { url: data.url } : {}
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ── 通知点击 ── */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = event.notification.data && event.notification.data.url;
  if (url) {
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});

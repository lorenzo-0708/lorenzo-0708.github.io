// ============================================================
// DSWD SPOT CHECK — SERVICE WORKER
// Version: 1.0.0
// ============================================================

const CACHE_NAME   = 'dswd-sc-v1';
const STATIC_CACHE = 'dswd-static-v1';

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js'
];

// ============================================================
// INSTALL — cache static assets
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS.map(url => {
          return new Request(url, { mode: 'no-cors' });
        }));
      })
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache error:', err))
  );
});

// ============================================================
// ACTIVATE — clean up old caches
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — offline-first strategy
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and GAS API calls (those need real network)
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('script.google.com')) return;
  if (url.hostname.includes('googleapis.com')) return;

  // Navigation requests — always serve index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // CDN & static assets — cache first, fallback to network
  if (
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // All other requests — network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ============================================================
// BACKGROUND SYNC (experimental — for future use)
// ============================================================
self.addEventListener('sync', event => {
  if (event.tag === 'dswd-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'BG_SYNC_TRIGGER' });
        });
      })
    );
  }
});

// ============================================================
// PUSH NOTIFICATIONS (future use)
// ============================================================
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  self.registration.showNotification(data.title || 'DSWD Spot Check', {
    body: data.body || 'You have a new notification.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: 'dswd-notif'
  });
});

console.log('[SW] DSWD Spot Check Service Worker loaded.');

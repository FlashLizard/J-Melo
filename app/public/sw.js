const CACHE_NAME = 'j-melo-cache-v3';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg',
  '/favicon.svg',
  '/i18n/zh.json',
  '/i18n/en.json'
];

// Dictionary data files needed for kuroshiro (kuromoji)
const DICT_ASSETS = [
  '/dict/base.dat.gz',
  '/dict/cc.dat.gz',
  '/dict/check.dat.gz',
  '/dict/tid_map.dat.gz',
  '/dict/tid_pos.dat.gz',
  '/dict/tid.dat.gz',
  '/dict/unk_char.dat.gz',
  '/dict/unk_compat.dat.gz',
  '/dict/unk_invoke.dat.gz',
  '/dict/unk_map.dat.gz',
  '/dict/unk_pos.dat.gz',
  '/dict/unk.dat.gz'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([...PRECACHE_ASSETS, ...DICT_ASSETS]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Strategy: Cache proxied images even if they are cross-origin
  if (url.pathname.includes('/api/media/proxy-image')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
          }
          return networkResponse;
        }).catch(() => null);
      })
    );
    return;
  }

  // 2. Skip other cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. Strategy: Cache First for Static Assets (Dictionary, i18n, logo, fonts)
  if (
    url.pathname.startsWith('/dict/') ||
    url.pathname.startsWith('/i18n/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
    );
    return;
  }

  // 4. Strategy: Stale-While-Revalidate for Next.js scripts and styles
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchedResponse = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => null);

          return cachedResponse || fetchedResponse;
        });
      })
    );
    return;
  }

  // 5. Strategy: Network First for Page Navigation (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return caches.match('/'); 
        })
    );
    return;
  }

  // 6. Default: Match cache or Network
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

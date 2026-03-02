const CACHE_NAME = 'j-melo-cache-v6';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg',
  '/favicon.svg',
  '/i18n/zh.json',
  '/i18n/en.json'
];

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
      return Promise.allSettled(
        [...PRECACHE_ASSETS, ...DICT_ASSETS].map(url => 
          fetch(url).then(response => {
            if (response.ok) return cache.put(url, response);
            throw new Error(`Failed to fetch ${url}`);
          }).catch(err => console.warn(`Precache failed for ${url}:`, err))
        )
      );
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
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Media Proxy Images
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
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // 2. Local Static Assets (i18n, dict, logos) - Cache First
  if (
    url.pathname.startsWith('/dict/') ||
    url.pathname.startsWith('/i18n/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. Next.js Internal Assets (Stale-While-Revalidate)
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        }).catch(() => {
            // Return null so we can check it later
            return null;
        });

        if (cachedResponse) return cachedResponse;
        return fetchPromise.then(resp => resp || new Response('', { status: 404 }));
      })
    );
    return;
  }

  // 4. Page Navigation (Network First, fallback to cached '/' index)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(response => {
            return response || caches.match('/');
          });
        })
    );
    return;
  }

  // 5. Default - Match Cache or Network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).catch(() => {
            if (event.request.destination === 'image') return new Response('', { status: 404 });
            return new Response('Offline', { status: 503 });
        });
      })
    );
  }
});

const CACHE_NAME = 'j-melo-cache-v10';
const APP_SHELL_URL = '/';

const PRECACHE_ASSETS = [
  APP_SHELL_URL,
  '/manifest.json',
  '/logo.svg',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
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

const cacheIfOk = async (cache, request) => {
  const response = await fetch(request);
  if (response && response.ok) {
    const responseToCache = response.clone();
    await cache.put(request, responseToCache);
  }
  return response;
};

const cacheRuntimeResponse = (event, request, response) => {
  if (!response || !response.ok) return response;

  let responseToCache;
  try {
    responseToCache = response.clone();
  } catch (err) {
    console.warn('Skipping runtime cache because response clone failed:', err);
    return response;
  }

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.put(request, responseToCache))
      .catch((err) => console.warn(`Runtime cache failed for ${request.url}:`, err))
  );

  return response;
};

const extractNextAssetUrls = (text, baseUrl) => {
  const urls = new Set();
  const htmlAssetPattern = /(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g;
  const manifestAssetPattern = /["'](static\/[^"']+\.(?:js|css))["']/g;

  for (const match of text.matchAll(htmlAssetPattern)) {
    urls.add(new URL(match[1], baseUrl).pathname);
  }
  for (const match of text.matchAll(manifestAssetPattern)) {
    urls.add(`/_next/${match[1]}`);
  }
  return [...urls];
};

const precacheNextAssets = async (cache) => {
  const shellResponse = await cacheIfOk(cache, APP_SHELL_URL);
  const shellText = await shellResponse.clone().text();
  const shellAssetUrls = extractNextAssetUrls(shellText, self.location.origin);

  await Promise.allSettled(shellAssetUrls.map((url) => cacheIfOk(cache, url)));

  const buildManifestUrl = shellAssetUrls.find((url) => url.endsWith('/_buildManifest.js'));
  if (!buildManifestUrl) return;

  const buildManifestResponse = await caches.match(buildManifestUrl) || await cacheIfOk(cache, buildManifestUrl);
  const buildManifestText = await buildManifestResponse.clone().text();
  const pageAssetUrls = extractNextAssetUrls(buildManifestText, self.location.origin);

  await Promise.allSettled(pageAssetUrls.map((url) => cacheIfOk(cache, url)));
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        [...PRECACHE_ASSETS, ...DICT_ASSETS].map((url) =>
          cacheIfOk(cache, url).catch((err) => console.warn(`Precache failed for ${url}:`, err))
        )
      );
      await precacheNextAssets(cache).catch((err) => console.warn('Next asset precache failed:', err));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        return undefined;
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) return;
  if (event.request.destination === 'audio' || event.request.destination === 'video') return;

  if (url.pathname.startsWith('/api/') && !url.pathname.includes('/api/media/proxy-image')) {
    return;
  }

  if (url.pathname.includes('/api/media/proxy-image')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          return cacheRuntimeResponse(event, event.request, networkResponse);
        }).catch(() => new Response('', { status: 404 }))
      })
    );
    return;
  }

  if (url.pathname.startsWith('/i18n/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheRuntimeResponse(event, event.request, response))
        .catch(() =>
          caches
            .match(event.request)
            .then((response) => response || new Response('{}', {
              status: 503,
              headers: { 'Content-Type': 'application/json; charset=utf-8' }
            }))
        )
    );
    return;
  }

  if (
    url.pathname.startsWith('/dict/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((response) => {
          return cacheRuntimeResponse(event, event.request, response);
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            return cacheRuntimeResponse(event, event.request, networkResponse);
          })
          .catch(() => null);

        if (cachedResponse) return cachedResponse;
        return fetchPromise.then((response) => response || new Response('', { status: 404 }));
      })
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheRuntimeResponse(event, event.request, response))
        .catch(() => caches.match(event.request).then((response) => response || caches.match(APP_SHELL_URL)))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((networkResponse) => {
        return cacheRuntimeResponse(event, event.request, networkResponse);
      }).catch(() => {
        if (event.request.destination === 'image') return new Response('', { status: 404 });
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

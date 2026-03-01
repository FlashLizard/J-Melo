// Minimal Service Worker to satisfy PWA requirements
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    // Don't intercept any requests, just pass them through
    // This makes it a valid "fetch" event handler for PWA criteria
});
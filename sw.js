// Service Worker for Elforat Pharma PWA
const CACHE_NAME = 'elforat-cache-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './analysis.js',
  './paymob.js',
  './manifest.json',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './hero-products.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-cache partial warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Never cache external APIs or Supabase/Paymob
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('paymob.com') ||
    url.hostname.includes('telegram.org') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/functions/v1/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

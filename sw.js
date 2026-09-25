// Service Worker for Elforat Pharma PWA
const CACHE_NAME = 'elforat-cache-v9';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './welcome-offer.js',
  './order-status.js',
  './analysis.js',
  './instapay.js',
  './instapay-logo.png',
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

  // Never cache external APIs (Supabase REST/Functions) or Telegram.
  // ملحوظة: قبل كده كنا بنستثني أي طلب لـ supabase.co بالكامل بما فيها
  // صور Supabase Storage (زي صورة الهيرو والمنتجات)، فكانت الصورة بترجع
  // تتحمّل من الإنترنت من الصفر في كل زيارة بدل ما تتخزن في كاش الـ SW.
  // دلوقتي بنستثني بس مسارات الـ API الحقيقية (rest/functions)، وبنسيب
  // صور الـ Storage تتخزن وتتكاش زي أي صورة تانية في الموقع.
  if (
    url.hostname.includes('telegram.org') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/functions/v1/')
  ) {
    return;
  }

  // Images: cache-first (fast), but refresh the cache in the background
  if (event.request.destination === 'image') {
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
    return;
  }

  // HTML/JS/CSS and everything else: network-first so updates are picked up
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match('./index.html'))
      )
  );
});
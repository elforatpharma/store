// Service Worker for Elforat Pharma PWA
const CACHE_NAME = 'elforat-cache-v13';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './welcome-offer.js',
  './order-status.js',
  './analysis.js',
  './instapay.js',
  './instapay-logo.png',
  './vodafone-cash.js',
  './vodafone-cash-logo.png',
  './manifest.json',
  './logo.png',
  './logo-96.png',
  './logo-96.webp',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png'
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

  // Images, JS, CSS: cache-first / stale-while-revalidate (فوري من الكاش،
  // وبيتحدث في الخلفية) بدل ما ينتظر الشبكة زي قبل كده. ده بيدّي إحساس
  // "cache lifetime" طويل في الزيارات المتكررة حتى إن هيدر Cache-Control
  // بتاع GitHub Pages نفسه 10 دقايق بس (ومش قادرين نتحكم فيه من هنا).
  // التحديثات لسه بتوصل: كل تاب بيفتح بيبعت طلب شبكة في الخلفية ويحدّث
  // الكاش لأي زيارة جاية، وكمان أي تغيير حقيقي في الملفات بيتغطى برفع
  // رقم CACHE_NAME فوق (بيمسح الكاش القديم بالكامل ويبدأ نضيف).
  if (
    event.request.destination === 'image' ||
    event.request.destination === 'script' ||
    event.request.destination === 'style'
  ) {
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

  // HTML وأي حاجة تانية: network-first عشان الصفحة نفسها ومسارات التنقل
  // تفضل دايماً أحدث نسخة أول ما تكون الشبكة متاحة.
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
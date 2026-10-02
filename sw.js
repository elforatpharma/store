// Service Worker - Elforat Pharma PWA
// غيّري رقم النسخة (وكل ?v= في index.html) مع كل نشر عشان الزوار ياخدوا التحديث.
const CACHE_NAME = 'elforat-cache-v19';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.min.css?v=19',
  './tailwind-built.css?v=19',
  './mobile.css?v=19',
  './fa-subset.css?v=19',
  './supabase-lite.js?v=19',
  './welcome-offer.js?v=19',
  './analysis.js?v=19',
  './instapay-logo.webp',
  './vodafone-cash-logo.webp',
  './manifest.json',
  './logo.png',
  './logo-96.png',
  './logo-96.webp',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
  './hero-products.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll كانت بتفشل كلها لو ملف واحد مش موجود (فمفيش حاجة كانت بتتخزن).
      // دلوقتي كل ملف لوحده: اللي موجود بيتخزن واللي مش موجود بيتجاهل.
      // cache:'reload' عشان GitHub Pages بيرجّع max-age=600 وممكن نخزّن نسخة قديمة من كاش المتصفح
      Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
      // navigation preload: الطلب بيبدأ بالتوازي مع تشغيل الـ SW بدل ما ينتظره
      self.registration.navigationPreload ? self.registration.navigationPreload.enable() : Promise.resolve()
    ])
  );
  self.clients.claim();
});

function putInCache(request, response) {
  if (response && response.status === 200 && response.type === 'basic') {
    const copy = response.clone();
    return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => { });
  }
  return Promise.resolve();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API الحقيقية (Supabase REST/Functions) وتليجرام: مفيش كاش أبداً
  if (
    url.hostname.includes('telegram.org') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/functions/v1/') ||
    url.hostname === 'api.ipify.org'
  ) return;

  // صفحات التنقل (HTML): من الكاش فوراً + تحديث في الخلفية (الصفحة بتفتح لحظياً،
  // والبيانات نفسها بتيجي طازة من سوبابيز). لو مفيش كاش: الشبكة ثم صفحة الأوفلاين.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = (await cache.match('./index.html')) || (await cache.match(req, { ignoreSearch: true }));
      const network = (async () => {
        try {
          const res = (await event.preloadResponse) || (await fetch(req));
          await putInCache(new Request('./index.html'), res.clone());
          return res;
        } catch (_) { return null; }
      })();
      if (cached) { event.waitUntil(network); return cached; }
      return (await network) || (await cache.match('./index.html')) || Response.error();
    })());
    return;
  }

  // ملفات الموقع نفسه (CSS/JS/صور/manifest): stale-while-revalidate
  // ملحوظة: صور Supabase/wsrv.nl (cross-origin) بيكاشيها المتصفح نفسه (HTTP cache)؛
  // مبنخزنهاش هنا لأن الردود opaque بتاكل مساحة كبيرة من حصة التخزين.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const network = fetch(req).then(async (res) => { await putInCache(req, res.clone()); return res; }).catch(() => null);
      if (cached) { event.waitUntil(network); return cached; }
      return (await network) || Response.error();
    })());
  }
});

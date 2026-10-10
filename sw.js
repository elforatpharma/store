// Service Worker - Elforat Pharma PWA
const CACHE_NAME = 'elforat-cache-v45';
const STATIC_ASSETS = ['./','./index.html','./style.min.css?v=47','./tailwind-built.css?v=47','./mobile.css?v=47','./fa-subset.css?v=47','./supabase-lite.js?v=47','./welcome-offer.js?v=47','./analysis.js?v=46','./image-performance.js?v=1','./instapay-logo.webp','./vodafone-cash-logo.webp','./manifest.json?v=5','./icon-192.png?v=5','./icon-512.png?v=5','./icon-512.png?v=5','./logo.png','./logo-96.png','./logo-96.webp','./favicon-32.png','./hero-products.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' }))))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
    self.registration.navigationPreload ? self.registration.navigationPreload.enable() : Promise.resolve()
  ]));
  self.clients.claim();
});

function putInCache(request, response) {
  if (response && response.status === 200 && response.type === 'basic') {
    return caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
  }
  return Promise.resolve();
}

// يضمن تشغيل محسن الصور حتى لو index.html القديم في كاش المتصفح لم يحتوِ على السكريبت.
async function injectImagePerformance(response) {
  try {
    if (!response || !response.ok) return response;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;
    const html = await response.text();
    if (html.includes('image-performance.js')) return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
    const injected = html.replace('</head>', '<script src="image-performance.js?v=1" defer></script>\n</head>');
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(injected, { status: response.status, statusText: response.statusText, headers });
  } catch (_) { return response; }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname.includes('telegram.org') || url.pathname.includes('/rest/v1/') || url.pathname.includes('/functions/v1/') || url.hostname === 'api.ipify.org') return;

  if (req.mode === 'navigate') {
    // HTML: الشبكة أولاً حتى يظهر آخر إصدار من المتجر بعد أي نشر،
    // مع fallback للكاش لو الزائر أوفلاين.
    event.respondWith((async () => {
      const network = (async () => {
        try {
          const res = (await event.preloadResponse) || (await fetch(req));
          await putInCache(new Request('./index.html'), res.clone());
          return res;
        } catch (_) { return null; }
      })();

      const fresh = await network;
      if (fresh) return injectImagePerformance(fresh);

      const cache = await caches.open(CACHE_NAME);
      const cachedRaw = (await cache.match('./index.html')) || (await cache.match(req, { ignoreSearch: true }));
      return cachedRaw ? injectImagePerformance(cachedRaw) : Response.error();
    })());
    return;
  }

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

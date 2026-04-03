const CACHE_NAME = 'dambo-v2';

// CDN 리소스만 캐시 (무거운 외부 라이브러리 → 오프라인/속도 목적)
const CDN_ASSETS = [
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CDN_ASSETS)).catch(() => {})
  );
  self.skipWaiting(); // 즉시 새 서비스워커 활성화
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // 즉시 모든 탭 제어
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ── HTML / manifest / sw / icon : 항상 네트워크 우선 ──
  // 코드가 업데이트되면 캐시 없이 최신본을 바로 가져옴
  const isAppFile =
    event.request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('manifest.json') ||
    url.pathname.endsWith('sw.js') ||
    url.pathname.endsWith('icon.svg') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/dambo/');

  if (isAppFile) {
    event.respondWith(
      fetch(event.request)
        .then(res => res)
        .catch(() => caches.match(event.request)) // 오프라인 시 캐시 폴백
    );
    return;
  }

  // ── CDN 라이브러리 : 캐시 우선 (속도 + 오프라인) ──
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

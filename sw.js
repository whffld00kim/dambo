const CACHE_NAME = 'dambo-v6';   // v6: React CDN 버전 18.3.1로 고정 (2026-09-03)

// 외부 라이브러리만 캐시한다 (무거워서 — 오프라인/속도 목적).
// index.html이 실제로 불러오는 URL과 한 글자도 다르면 미리 받아두는 의미가 없다.
const CDN_ASSETS = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.24.7/babel.min.js',
  'https://cdn.tailwindcss.com',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js',
];

// 캐시해도 되는 곳. 여기 없는 호스트는 무조건 네트워크로 보낸다.
// ⚠️ 이 목록을 넓히지 말 것 — 로그인(identitytoolkit)과 DB 응답까지 캐시되면
//    지난 응답이 되살아나 로그인이 이상하게 풀리거나 옛 잔고가 보인다.
const CACHEABLE_HOSTS = ['unpkg.com', 'cdn.tailwindcss.com', 'www.gstatic.com'];

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

  // ── 그 외 : 허용한 CDN만 캐시 우선, 나머지는 손대지 않는다 ──
  if (!CACHEABLE_HOSTS.includes(url.hostname)) return;

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

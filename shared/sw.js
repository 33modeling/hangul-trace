/*
 * Service Worker — cache-first 정적 자산 캐싱.
 *
 * 어린이 학습 앱이라 네트워크 끊겨도 첫 셸이 뜨고 모든 모드가 즉시
 * 동작해야 하므로 install 시 핵심 자산을 prefetch해둔다.
 * 새 빌드가 올라오면 CACHE 버전을 올려 옛 캐시를 정리한다.
 *
 * TWA(Trusted Web Activity)에서 'Verified'로 인식되려면 적어도 하나의
 * fetch 핸들러가 등록되어 있어야 하는데, 이 파일이 그 요건을 충족한다.
 */

/* CACHE 버전 — 자산이 바뀌었으면 이 값을 올려서 옛 사용자 브라우저의
 * 캐시를 강제 무효화해야 한다. 새 SW가 install되면 activate에서 옛
 * 캐시 키를 삭제하므로 새 자산이 prefetch된다. */
const CACHE = 'tracing-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './shared/styles.css',
  './shared/common.js',
  './shared/core.js',
  './shared/strokeOrder.js',
  './shared/navigation.js',
  './shared/utils.js',
  './shared/myWords.js',
  './shared/sound.js',
  './index.js',
  './modes/char/modes.js',
  './modes/word/modes.js',
  './modes/advanced/modes.js',
  './modes/number/modes.js',
  './modes/english/modes.js',
  './modes/myword/modes.js',
  './modes/myword-add/modes.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // 같은 출처만 캐시 (Netlify 도메인). 외부 요청은 통과.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // 정상 응답만 캐시에 저장
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});

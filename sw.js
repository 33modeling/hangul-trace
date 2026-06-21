/*
 * Service Worker — 정적 자산 캐싱.
 *
 * 어린이 학습 앱이라 네트워크가 끊겨도 첫 셸이 뜨고 모든 모드가 즉시
 * 동작해야 하므로 install 시 핵심 자산을 prefetch해둔다.
 *
 * 캐시 전략:
 *   - 페이지(navigation): network-first → 온라인이면 항상 최신 셸을 받고,
 *     오프라인이면 캐시(없으면 index.html)로 폴백.
 *   - VERSION: network-first → 표시 버전이 배포와 어긋나지 않게.
 *   - 그 외 동일 출처 정적 자산(JS/CSS/아이콘): stale-while-revalidate →
 *     캐시를 즉시 주고 뒤에서 새 버전을 받아둬 "다음 로드"에 갱신.
 * 이 덕분에 CACHE 버전을 잊고 안 올려도 사용자가 옛 빌드에 영구히 고정되지
 * 않는다. (예전엔 순수 cache-first라 한 번 받은 자산이 영원히 캐시됐음.)
 *
 * TWA(Trusted Web Activity)에서 'Verified'로 인식되려면 적어도 하나의
 * fetch 핸들러가 등록되어 있어야 하는데, 이 파일이 그 요건을 충족한다.
 */

/* CACHE 버전 — VERSION 파일과 동기화한다. scripts/bump-version.sh 가
 * VERSION 을 올릴 때 이 줄의 'tracing-v<버전>' 도 함께 갱신해서, 새 배포가
 * 옛 캐시를 activate 단계에서 정리하도록 한다. 형식을 바꾸면 bump 스크립트의
 * 정규식도 같이 고칠 것. */
const CACHE = 'tracing-v0.0.48';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './VERSION',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './shared/styles.css',
  './shared/common.js',
  './shared/core.js',
  './shared/strokeOrder.js',
  './shared/strokePaths.js',
  './shared/navigation.js',
  './shared/utils.js',
  './shared/pen.js',
  './shared/myWords.js',
  './shared/vocab.js',
  './shared/rewards.js',
  './shared/tts.js',
  './shared/sound.js',
  './index.js',
  './modes/char/modes.js',
  './modes/word/modes.js',
  './modes/advanced/modes.js',
  './modes/number/modes.js',
  './modes/english/modes.js',
  './modes/myword/modes.js',
  './modes/myword-add/modes.js',
  './modes/wordcard/modes.js',
  './modes/quiz/modes.js',
  './modes/phonics/modes.js',
  './modes/batchim/modes.js',
  './modes/dictation/modes.js',
  './modes/strokeorder/modes.js',
  './modes/review/modes.js',
  './modes/sentence/modes.js',
  './modes/settings/modes.js',
  './modes/progress/modes.js'
];

self.addEventListener('install', (event) => {
  // 개별 add 로 캐시 — 자산 하나가 404/리다이렉트여도 install 전체가
  // 실패하지 않도록(addAll 은 하나만 실패해도 전체 reject). 핵심 셸이
  // 빠지면 오프라인 동작은 줄지만 SW 등록 자체는 성공한다.
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((url) => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function putInCache(req, res) {
  // 정상 동일출처 응답만 저장
  if (res && res.status === 200 && res.type === 'basic') {
    const clone = res.clone();
    caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // 같은 출처만 캐시 (Netlify 도메인). 외부 요청(CDN 폰트 등)은 통과.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
  const isVersion = url.pathname.endsWith('/VERSION') || url.pathname.endsWith('VERSION');

  // 페이지·VERSION: network-first (최신 우선, 오프라인이면 캐시 폴백)
  if (isNavigation || isVersion) {
    event.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() =>
          caches.match(req).then((cached) =>
            cached || (isNavigation ? caches.match('./index.html') : Response.error())
          )
        )
    );
    return;
  }

  // 그 외 정적 자산: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => null);
      // 캐시가 있으면 즉시 주고, 네트워크 갱신은 백그라운드에서 진행.
      // 캐시가 없으면 네트워크 결과를 기다린다.
      return cached || network.then((res) => res || Response.error());
    })
  );
});

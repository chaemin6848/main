// 제1당 오프라인 캐시 (서비스 워커, 범위 /jeildang/). 앱(TWA·홈 화면 추가)에서 인터넷 없이도 혼자 하기가 열리게 한다.
// - 페이지(HTML): 네트워크 먼저, 3초 안에 안 오거나 끊겨 있으면 캐시
// - 같은 사이트의 파일(엔진·번역·지도·사진·공통 메뉴): 캐시를 먼저 쓰고 뒤에서 새 파일로 바꿔 둔다
// - 글꼴(Google Fonts): 캐시 먼저
// - 그 밖(Firebase 로그인·멀티 서버, 분석)은 건드리지 않는다
// 파일 구성이 크게 바뀌면 VERSION 을 올린다 (예전 캐시는 지운다)
const VERSION = 'jd-v3';
const CORE = [
  '/jeildang/', '/jeildang/play/', '/jeildang/engine.js', '/jeildang/units.js', '/jeildang/i18n.js', '/jeildang/firebase-config.js',
  '/jeildang/manifest.json', '/jeildang/play/manifest.json', '/jeildang/app/icon-192.png', '/jeildang/app/icon-512.png',
  '/jeildang/img/default.jpg', '/jeildang/img/default-wide.jpg', '/shared/nav.js',
];

self.addEventListener('install', e => {
  // 하나가 실패해도 나머지는 담는다
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const sameOrigin = u => u.origin === self.location.origin;
const isFont = u => u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';

async function networkFirst(req) {
  const c = await caches.open(VERSION);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('느림')), 3000))]);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (e) {
    return (await c.match(req)) || (await c.match('/jeildang/')) || Response.error();
  }
}
async function staleWhileRevalidate(req) {
  const c = await caches.open(VERSION);
  const hit = await c.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (req.mode === 'navigate' && sameOrigin(u) && u.pathname.startsWith('/jeildang/')) { e.respondWith(networkFirst(req)); return; }
  if (sameOrigin(u) && (u.pathname.startsWith('/jeildang/') || u.pathname.startsWith('/shared/'))) {
    if (u.pathname.endsWith('/sw.js')) return;
    e.respondWith(staleWhileRevalidate(req)); return;
  }
  if (isFont(u)) e.respondWith(staleWhileRevalidate(req));
});

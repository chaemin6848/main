// 제1당 앱 아이콘을 만든다 (PWA·안드로이드 TWA·Play 스토어용). 사용: node tools/jeildang/app/icons.js
// 결과: public/jeildang/app/icon-192.png, icon-512.png, icon-maskable-512.png (사이트·앱)
//       android/store/play-icon-512.png, feature-1024x500.png (Play 스토어 등록용, 사이트에 올리지 않는다)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '../../../public/jeildang/app'), STORE = path.join(__dirname, '../../../android/store');
// 차분한 색: 채도를 낮춰 남색 바탕과 어울리게 (진보 쪽 푸른색 → 가운데 금색 → 보수 쪽 붉은색)
const COLORS = ['#5f7fc9', '#86a9d6', '#a596c8', '#d6c08a', '#d58a86', '#c9a07a'];
// 의석 반원: 줄마다 점을 고르게 놓고, 왼쪽부터 정당 색을 채운다
function hemi(cx, cy, r0, rows, dot) {
  const pts = [];
  for (let i = 0; i < rows; i++) {
    const r = r0 + i * dot * 2.3, n = Math.round(Math.PI * r / (dot * 2.4));
    for (let j = 0; j <= n; j++) { const a = Math.PI - Math.PI * j / n; pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a), a]); }
  }
  pts.sort((p, q) => q[2] - p[2]);
  const cut = [.30, .42, .50, .58, .86, 1];
  return pts.map((p, k) => { const f = k / pts.length, c = COLORS[cut.findIndex(x => f < x)]; return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${dot}" fill="${c}"/>`; }).join('');
}
const icon = (size, safe) => {
  const s = size, k = safe ? .72 : .88;   // maskable 은 가운데 80% 안에 그린다
  const w = s * k, cx = s / 2, cy = s * .66;   // 글자 없이 반원만, 가운데보다 조금 아래(반원이라 눈으로 보면 가운데)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22305a"/><stop offset="1" stop-color="#121a33"/></linearGradient></defs>
  <rect width="${s}" height="${s}" ${safe ? '' : `rx="${s * .2}"`} fill="url(#g)"/>
  ${hemi(cx, cy, w * .2, 5, w * .031)}
</svg>`;
};
const feature = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22305a"/><stop offset="1" stop-color="#121a33"/></linearGradient></defs>
  <rect width="1024" height="500" fill="url(#g)"/>
  ${hemi(300, 360, 90, 6, 11)}
  <text x="580" y="235" font-family="Noto Sans KR, sans-serif" font-weight="500" font-size="84" fill="#fff" letter-spacing="6">제1당</text>
  <text x="584" y="295" font-family="Noto Sans KR, sans-serif" font-weight="300" font-size="28" fill="#c9d3f0" letter-spacing="1">정당을 세워 정권을 잡는 전략 게임</text>
</svg>`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;500&display=swap"><body style="margin:0"></body>');
  await p.waitForTimeout(1500);
  fs.mkdirSync(STORE, { recursive: true });
  const shot = async (svg, w, h, file, dir = OUT) => {
    await p.setViewportSize({ width: w, height: h });
    await p.evaluate(s => { document.body.innerHTML = s; }, svg);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(dir, file), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  };
  await shot(icon(192, false), 192, 192, 'icon-192.png');
  await shot(icon(512, false), 512, 512, 'icon-512.png');
  await shot(icon(512, true), 512, 512, 'icon-maskable-512.png');
  await shot(icon(512, true), 512, 512, 'play-icon-512.png', STORE);      // Play 스토어 아이콘은 모서리를 스토어가 깎는다
  await shot(feature(), 1024, 500, 'feature-1024x500.png', STORE);
  await b.close(); console.log('아이콘을 만들었습니다:', fs.readdirSync(OUT).join(', '));
})();

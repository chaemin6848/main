// 브라우저 점검: sitemap의 모든 페이지와 몇몇 숨은 페이지를 휴대폰 폭(360px)으로 열어
//   1) JS 오류(pageerror)  2) 가로 넘침  3) 공통 메뉴가 그려졌는지  를 본다.
// 사용: node tools/check/smoke.js   (public/ 를 직접 띄우므로 서버가 따로 필요 없다. 문제가 있으면 종료 코드 1)
// 바깥 주소(광고·글꼴·Firebase)는 막고 본다. 그 때문에 생기는 오류는 무시한다.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, "../../public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(ROOT, p);
  if (p.endsWith("/")) f = path.join(f, "index.html");
  else if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  else if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const sm = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  const pages = [...sm.matchAll(/<loc>https:\/\/nihongodic\.com([^<]*)<\/loc>/g)].map(m => m[1])
    .concat(["/mypage/", "/politics/login", "/japanese/jlpt/n3/5/"]);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, locale: "ko-KR" });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const problems = [];
  for (const u of [...new Set(pages)]) {
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", e => { if (!/Failed to fetch|NetworkError|Load failed|firebase|gstatic|adsbygoogle|import/i.test(e.message)) errs.push(e.message.slice(0, 120)); });
    const resp = await p.goto(base + u, { waitUntil: "load" }).catch(e => null);
    await p.waitForTimeout(400);
    const info = resp && await p.evaluate(() => ({
      over: document.documentElement.scrollWidth - innerWidth,
      nav: !!document.getElementById("nihongodic-nav") || !document.querySelector('script[src="/shared/nav.js"]')
    }));
    if (!resp || resp.status() !== 200) problems.push(`${u}: 열리지 않음 (${resp && resp.status()})`);
    else {
      if (errs.length) problems.push(`${u}: JS 오류 ${errs.join(" | ")}`);
      if (info.over > 0) problems.push(`${u}: 360px에서 가로로 ${info.over}px 넘침`);
      if (!info.nav) problems.push(`${u}: 공통 메뉴가 그려지지 않음`);
    }
    await p.close();
  }
  await b.close(); server.close();
  problems.forEach(x => console.log("문제", x));
  console.log(`${pages.length}개 페이지 점검, 문제 ${problems.length}개`);
  process.exit(problems.length ? 1 : 0);
})();

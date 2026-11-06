// 공유 미리보기 이미지(og:image, 1200×630)를 만든다.
// 사용: node tools/og/build.js <글꼴 폴더>
//   글꼴 폴더: npm의 @fontsource/noto-sans-kr, @fontsource/noto-sans-jp 패키지를 풀어 둔 곳 (kr/package, jp/package)
// 결과: public/shared/og/<이름>.png  — 페이지의 <meta property="og:image">가 이 파일을 가리킨다.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const fontDir = path.resolve(process.argv[2] || "");
const out = path.join(__dirname, "../../public/shared/og");
const IMAGES = require("./images.json");

function fontCss() {
  let css = "";
  for (const [fam, dir] of [["Noto Sans KR", "kr"], ["Noto Sans JP", "jp"]])
    for (const w of [700, 900]) {
      const p = path.join(fontDir, dir, "package");
      css += fs.readFileSync(path.join(p, w + ".css"), "utf8")
        .replace(/font-family: '[^']+'/g, "font-family: '" + fam + "'")
        .replace(/url\(\.\/files\//g, "url(file://" + path.join(p, "files") + "/");
    }
  return css;
}

function html(img, css) {
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><meta charset="utf-8"><style>${css}
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;background:#f8f7f2;color:#1c211d;font-family:'Noto Sans KR','Noto Sans JP',sans-serif;
    display:flex;flex-direction:column;justify-content:space-between;padding:72px 80px;position:relative;overflow:hidden}
  .glyph{position:absolute;right:80px;top:72px;width:220px;height:220px;border-radius:32px;background:${img.accent};
    display:grid;place-items:center;font-family:'Noto Sans JP','Noto Sans KR',sans-serif;font-weight:900;font-size:136px;line-height:1;
    border:4px solid #1c211d;box-shadow:14px 14px 0 #1c211d}
  .mark{display:flex;align-items:center;gap:16px;font-weight:900;font-size:34px;letter-spacing:-.03em}
  .mark i{font-style:normal;width:56px;height:56px;border:4px solid #1c211d;border-radius:50%;display:grid;place-items:center;font-family:'Noto Sans JP';font-size:28px}
  h1{font-size:${Math.max(...img.title.split('\n').map(l => l.length)) > 9 ? 72 : 92}px;word-break:keep-all;font-weight:900;letter-spacing:-.04em;line-height:1.1;max-width:760px}
  h1 em{font-style:normal;background:linear-gradient(transparent 60%,${img.accent} 60%)}
  p{margin-top:22px;font-size:34px;font-weight:700;color:#4a5149;max-width:900px;line-height:1.35}
  .url{font-size:26px;font-weight:700;color:#6c736b;letter-spacing:.02em}
  </style><body>
  <div class="mark"><i>日</i>nihongodic</div>
  <div class="glyph">${esc(img.glyph)}</div>
  <div><h1>${img.title.split('\n').map(l => '<em>' + esc(l) + '</em>').join('<br>')}</h1><p>${esc(img.sub)}</p></div>
  <div class="url">${esc(img.url)}</div></body>`;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const css = fontCss();
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const [name, img] of Object.entries(IMAGES)) {
    const tmp = path.join(require("os").tmpdir(), "og-" + name + ".html");
    fs.writeFileSync(tmp, html(img, css));
    await page.goto("file://" + tmp);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, name + ".png") });
    fs.unlinkSync(tmp);
    console.log("og", name);
  }
  await b.close();
})();

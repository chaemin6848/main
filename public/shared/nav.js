/* 모든 도구 페이지 맨 위에 붙는 공통 메뉴. <body> 바로 안에서 동기로 불러야 화면이 밀리지 않는다.
   Shadow DOM 안에 그려서 각 도구의 CSS와 서로 간섭하지 않는다. */
(function () {
  var TOOLS = [
    { path: "/japanese/", name: "단어 한 장", glyph: "あ", accent: "#dfff70" },
    { path: "/alarm/", name: "일유알리미", glyph: "留", accent: "#9fd8ff" },
    { path: "/politics/", name: "나가타초 노트", glyph: "政", accent: "#ffb4a2" },
    { path: "/jeildang/", name: "제1당", glyph: "党", accent: "#cdb9ff" }
  ];

  var here = location.pathname;
  var host = document.createElement("div");
  host.id = "nihongodic-nav";
  var root = host.attachShadow({ mode: "open" });

  var links = TOOLS.map(function (t) {
    var on = here.indexOf(t.path) === 0;
    return '<a href="' + t.path + '" style="--accent:' + t.accent + '"' + (on ? ' aria-current="page"' : "") + ">" +
      '<i aria-hidden="true">' + t.glyph + "</i>" + t.name + "</a>";
  }).join("");

  root.innerHTML =
    "<style>" +
    ":host{all:initial;display:block;position:relative;z-index:2147483000;--ink:#1c211d;--muted:#6c736b;--paper:#f8f7f2;--line:#dcdcd3;--on:#1c211d;" +
    "font-family:'Noto Sans KR',system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif}" +
    "@media (prefers-color-scheme:dark){:host{--ink:#ecefe7;--muted:#9aa197;--paper:#151814;--line:#343a32}}" +
    "nav{display:flex;align-items:center;gap:6px;min-height:46px;padding:0 max(12px,env(safe-area-inset-right,0px)) 0 max(12px,env(safe-area-inset-left,0px));" +
    "background:var(--paper);border-bottom:1px solid var(--line);color:var(--ink);box-sizing:border-box}" +
    ".home{display:inline-flex;align-items:center;gap:7px;flex:none;font-weight:900;font-size:14px;letter-spacing:-.03em;color:var(--ink);text-decoration:none;padding:6px 8px 6px 0}" +
    ".home i{font-style:normal;width:24px;height:24px;display:grid;place-items:center;border:1.5px solid var(--ink);border-radius:50%;font-size:12px;line-height:1}" +
    ".tools{position:relative;min-width:0;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin-left:auto}" +
    ".tools::-webkit-scrollbar{display:none}" +
    ".tools a{display:inline-flex;align-items:center;gap:6px;flex:none;padding:6px 10px;border-radius:999px;font-size:13px;font-weight:600;color:var(--muted);text-decoration:none;white-space:nowrap}" +
    ".tools a i{font-style:normal;width:18px;height:18px;display:grid;place-items:center;border-radius:5px;background:var(--accent);color:var(--on);font-size:11px;font-weight:900;line-height:1}" +
    ".tools a:hover{color:var(--ink);background:color-mix(in srgb,var(--accent) 25%,transparent)}" +
    ".tools a[aria-current]{color:var(--on);background:var(--accent)}" +
    ".tools a[aria-current] i{background:transparent}" +
    "a:focus-visible{outline:2px solid var(--ink);outline-offset:2px}" +
    "@media (max-width:560px){.home b{display:none}.home{padding-right:2px}}" +
    "@media print{nav{display:none}}" +
    "</style>" +
    '<nav aria-label="nihongodic 도구">' +
    '<a class="home" href="/"><i aria-hidden="true">日</i><b>nihongodic</b></a>' +
    '<div class="tools">' + links + "</div>" +
    "</nav>";

  var me = document.currentScript;
  if (me && me.parentNode) me.parentNode.insertBefore(host, me);
  else document.body.insertBefore(host, document.body.firstChild);

  var cur = root.querySelector("[aria-current]");
  // 좁은 화면에서 현재 도구가 가로 스크롤 밖에 있으면 보이게 (페이지 세로 위치는 건드리지 않음)
  if (cur) {
    var bar = cur.parentNode;
    var over = cur.offsetLeft + cur.offsetWidth - bar.clientWidth;
    if (over > 0) bar.scrollLeft = over + 12;
  }
})();

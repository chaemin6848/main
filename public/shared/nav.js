/* main/* 모든 도구 페이지 맨 위에 붙는 공통 메뉴 + 한/일/영 전환. <body> 바로 안에서 동기로 불러야 화면이 밀리지 않는다.
   메뉴는 Shadow DOM 안에 그려서 각 도구의 CSS와 서로 간섭하지 않는다.

   언어: <script src="/shared/nav.js" data-langs="ko,en"> 처럼 페이지가 지원하는 언어를 적는다 (생략하면 ko,ja,en).
   번역: 각 페이지가 한국어 원문을 키로 하는 사전을 넣으면, 화면의 텍스트 노드·속성을 원문과 정확히 같을 때 바꿔 준다.
     ND.add({ "원문": ["日本語", "English"] })          // 일·영 함께
     ND.add("en", { "원문": "English" })                // 한 언어만
     ND.pat([[/^(\d+)석$/, "$1議席", "$1 seats"]])      // 숫자가 섞인 문장은 정규식으로
     ND.terms()                                          // 당·지역 이름 같은 짧은 낱말을 문장 속에서도 바꾼다
     ND.fallback("en", fn)                               // 그래도 없으면 fn(원문) (낱말 단위 바꿈 등)
     ND.t("원문")                                        // JS에서 직접 (canvas, alert 등 DOM 밖 글자)
   화면이 바뀌면 MutationObserver가 새로 들어온 글자도 바꾼다. 언어를 고르면 저장하고 새로고침한다. */
(function () {
  var me = document.currentScript;
  var SUPPORTED = ["ko", "ja", "en"];
  var langs = ((me && me.getAttribute("data-langs")) || "ko,ja,en").split(",").map(function (s) { return s.trim(); })
    .filter(function (l) { return SUPPORTED.indexOf(l) >= 0; });
  if (!langs.length) langs = ["ko"];
  var KEY = "nd-lang";

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function browserLang() {
    var list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "ko"]);
    for (var i = 0; i < list.length; i++) {
      var l = String(list[i]).toLowerCase().slice(0, 2);
      if (SUPPORTED.indexOf(l) >= 0) return l;
    }
    return "en";
  }
  var q = null;
  try { q = new URLSearchParams(location.search).get("lang"); } catch (e) {}
  if (q && SUPPORTED.indexOf(q) >= 0) { try { localStorage.setItem(KEY, q); } catch (e) {} }
  var want = (q && SUPPORTED.indexOf(q) >= 0) ? q : (stored() || browserLang());
  // 이 페이지가 고른 언어를 지원하지 않으면: 한국어가 아니면 영어, 그것도 없으면 첫 번째 언어
  var lang = langs.indexOf(want) >= 0 ? want : (want !== "ko" && langs.indexOf("en") >= 0 ? "en" : langs[0]);
  document.documentElement.lang = lang;
  document.documentElement.setAttribute("data-lang", lang);

  /* ---------- 번역 엔진 ---------- */
  var dict = { ja: {}, en: {} }, pats = { ja: [], en: [] }, falls = { ja: null, en: null };
  var HANGUL = /[가-힣]/;
  var ATTRS = ["title", "aria-label", "placeholder", "alt", "data-l", "data-label"];
  function add(a, b) {
    if (typeof a === "string") { var d = dict[a]; if (d) for (var k in b) d[k] = b[k]; return; }
    for (var key in a) { var v = a[key]; if (v[0] != null) dict.ja[key] = v[0]; if (v[1] != null) dict.en[key] = v[1]; }
  }
  function pat(a, b) {
    if (typeof a === "string") { var p = pats[a]; if (p) b.forEach(function (x) { p.push([x[0], x[1]]); }); return; }
    a.forEach(function (x) { if (x[1] != null) pats.ja.push([x[0], x[1]]); if (x[2] != null) pats.en.push([x[0], x[2]]); });
  }
  // 사전·패턴에 없을 때 마지막으로 부르는 함수 (낱말 단위 바꿈 등). 바꿀 수 없으면 null
  function fallback(l, fn) { if (l in falls) falls[l] = fn; }

  /* 용어 모드(ND.terms()): 사전에 있는 짧은 낱말(당 이름·지역 이름 등)을 문장 안에서 먼저 표지로 바꾼 뒤 패턴을 맞춘다.
     "공화보수당 27", "한별 수도권, 동해 공단"처럼 이름만 늘어선 글도 이걸로 바뀐다. 표지는 앞뒤가 한글이 아닐 때만 붙인다. */
  var useTerms = false, termList = null, termRe = null, TK = /\uE000(\d+)\uE001/g;
  function terms() { useTerms = true; termList = null; }
  function buildTerms() {
    var d = dict[lang];
    termList = Object.keys(d).filter(function (k) {
      return k.length >= 2 && k.length <= 32 && /^[가-힣A-Za-z0-9].*[가-힣A-Za-z0-9]$/.test(k) && HANGUL.test(k) && !/[.,:;!?()（）「」{}\[\]<>%…"']/.test(k) && d[k] && !HANGUL.test(d[k]);
    }).sort(function (x, y) { return y.length - x.length; });
    var esc = function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
    termRe = termList.length ? new RegExp("(^|[^가-힣])(" + termList.map(esc).join("|") + ")(?![가-힣])", "g") : null;
  }
  function tokenize(s) {
    if (!termList) buildTerms();
    if (!termRe) return s;
    var idx = {};
    termList.forEach(function (k, i) { idx[k] = i; });
    tokenize = function (x) { return x.replace(termRe, function (_, pre, k) { return pre + "\uE000" + idx[k] + "\uE001"; }); };
    return tokenize(s);
  }
  function untok(s) { return s.indexOf("\uE000") < 0 ? s : s.replace(TK, function (_, i) { return termList[+i]; }); }
  function restore(s) { return s.indexOf("\uE000") < 0 ? s : s.replace(TK, function (_, i) { return dict[lang][termList[+i]]; }); }

  // 자리({0})에 들어간 한국어는 통째로 번역되거나(이름·용어), 전혀 손대지 않은 낯선 이름이어야 한다.
  // 일부만 바뀌는 조각이나 번역 안 되는 긴 문장이면 패턴이 엉뚱한 곳에서 잘린 것이므로 버린다.
  // 돌려주는 값: false = 버림, 0 = 좋음, 1 = 낯선 한국어 이름을 그대로 둔 채 맞음(덜 믿을 만함)
  function capsOk(m) {
    var unknown = 0;
    for (var j = 1; j < m.length; j++) {
      var c = m[j];
      if (c == null || !HANGUL.test(c.replace(TK, ""))) continue;
      var r = t(c);
      if (!HANGUL.test(r)) continue;
      if (r === c && c.length <= 14 && c.indexOf("\uE000") < 0) { unknown = 1; continue; }
      return false;
    }
    return unknown;
  }
  // 맞는 패턴의 결과와 순번(작을수록 고정 글자가 많은 구체적 패턴)을 돌려준다
  function matchPats(s) {
    var p = pats[lang];
    for (var i = 0; i < p.length; i++) {
      var m = s.match(p[i][0]), ok = m ? capsOk(m) : false;
      if (ok === false) continue;
      var r = p[i][1], score = i + (ok ? 100000 : 0);
      if (typeof r === "function") return { r: r.apply(null, m), i: score };
      return { r: r.replace(/\$(\d)/g, function (_, n) { var v = m[+n]; return v == null ? "" : t(v); }), i: score };
    }
    return null;
  }
  function lookup(s) {
    var d = dict[lang];
    if (!d || !s) return null;
    if (Object.prototype.hasOwnProperty.call(d, s)) return d[s];
    if (s.indexOf("\uE000") >= 0 && !HANGUL.test(s)) return restore(s);
    // 1) 낯선 한국어 조각 없이 맞는 가장 구체적인 패턴 (원문 / 이름을 표지로 바꾼 글 중)
    // 2) 조각·문장을 이어 붙인 글이면 조각마다  3) 이름만 늘어선 글  4) 낯선 이름을 그대로 둔 패턴
    var raw = matchPats(s), tkm = null, tk = s;
    if (useTerms) { tk = tokenize(s); if (tk !== s && HANGUL.test(tk)) tkm = matchPats(tk); }
    var best = null;
    [raw, tkm].forEach(function (c) { if (c && c.r != null && (!best || c.i < best.i)) best = c; });
    if (best) { best.r = restore(best.r); if (best.i < 100000 && !HANGUL.test(best.r)) return best.r; }
    if (useTerms && /( · |, |[.。] )/.test(s)) {
      var parts = tk.split(/( · |, |(?<=[.。]) )/), ok = parts.length > 1;
      for (var i = 0; ok && i < parts.length; i += 2) { if (untok(parts[i]) === s) { ok = false; break; } var x = t(untok(parts[i])); if (HANGUL.test(x)) { ok = false; break; } parts[i] = x; }
      if (ok) return restore(parts.join(""));
    }
    if (tk !== s && !HANGUL.test(tk)) return restore(tk);
    if (best) return best.r;
    if (falls[lang]) { var f = falls[lang](s); if (f != null && f !== s) return f; }
    return null;
  }
  var depth = 0;
  function t(s, vars) {
    var out = s;
    if (lang !== "ko" && s != null && depth < 8) {
      // 앞뒤 공백은 떼고 찾은 뒤 다시 붙인다
      var key = String(s), m = key.match(/^(\s*)([\s\S]*?)(\s*)$/), r;
      depth++; try { r = lookup(m[2]); } finally { depth--; }
      if (r != null) out = m[1] + r + m[3];
    }
    if (vars) out = String(out).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : "{" + k + "}"; });
    return out;
  }
  function trText(node) {
    var v = node.nodeValue;
    if (!v || !HANGUL.test(v)) return;
    var r = t(v);
    if (r !== v) node.nodeValue = r;
  }
  function trAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (v && HANGUL.test(v)) { var r = t(v); if (r !== v) el.setAttribute(a, r); }
    }
    if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type) && HANGUL.test(el.value)) el.value = t(el.value);
    if (el.tagName === "META" && HANGUL.test(el.content || "")) el.content = t(el.content);
    if (el.tagName === "OPTGROUP" && HANGUL.test(el.label || "")) el.label = t(el.label);
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1 };
  function walk(root) {
    if (lang === "ko" || !root) return;
    if (root.nodeType === 3) { if (root.parentNode && !SKIP[root.parentNode.nodeName] && !inNoI18n(root.parentNode)) trText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (inNoI18n(root)) return; if (SKIP[root.nodeName]) { if (root.nodeName === "TEXTAREA") trAttrs(root); return; } trAttrs(root); }
    var tw = document.createTreeWalker(root, 5, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          if (n.hasAttribute("data-no-i18n")) return 2;
          if (SKIP[n.nodeName]) { if (n.nodeName === "TEXTAREA") trAttrs(n); return 2; }
          return 1;
        }
        return 1;
      }
    });
    var n, texts = [];
    while ((n = tw.nextNode())) { if (n.nodeType === 3) texts.push(n); else trAttrs(n); }
    for (var i = 0; i < texts.length; i++) trText(texts[i]);
  }
  function inNoI18n(el) { return !!(el.closest && el.closest("[data-no-i18n]")); }
  function translateTitle() { var tt = document.title; if (HANGUL.test(tt)) { var r = t(tt); if (r !== tt) document.title = r; } }

  var ready = false;
  if (lang !== "ko") {
    // 번역 전 한국어가 잠깐 보이지 않도록 다 바꿀 때까지 가린다 (오류가 나도 1.5초 뒤에는 보인다)
    var hide = document.createElement("style");
    hide.textContent = "body>*:not(#nihongodic-nav){visibility:hidden}";
    document.head.appendChild(hide);
    var reveal = function () { if (hide.parentNode) hide.parentNode.removeChild(hide); };
    setTimeout(reveal, 1500);
    var mo = new MutationObserver(function (list) {
      if (!ready) return;
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === "characterData") { if (!SKIP[m.target.parentNode && m.target.parentNode.nodeName]) trText(m.target); }
        else if (m.type === "attributes") { if (m.target.nodeType === 1) trAttrs(m.target); }
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    var start = function () {
      if (ready) return;
      ready = true;
      walk(document.head); walk(document.body); translateTitle();
      new MutationObserver(translateTitle).observe(document.querySelector("title") || document.head, { childList: true, characterData: true, subtree: true });
      reveal();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else setTimeout(start, 0);
  }

  function setLang(l) {
    if (SUPPORTED.indexOf(l) < 0) return;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    try {
      var u = new URL(location.href);
      if (u.searchParams.has("lang")) { u.searchParams.set("lang", l); location.replace(u.href); return; }
    } catch (e) {}
    location.reload();
  }

  window.ND = { lang: lang, langs: langs, add: add, pat: pat, fallback: fallback, terms: terms, t: t, apply: walk, setLang: setLang };

  /* ---------- 공통 메뉴 ---------- */
  var NAMES = {
    "/japanese/": ["단어 한 장", "단어 한 장（韓国語のみ）", "단어 한 장 (Korean only)"],
    "/alarm/": ["일유알리미", "日留アラーム", "Japan Admissions Tracker"],
    "/politics/": ["나가타초 노트", "나가타초 노트（韓国語のみ）", "나가타초 노트 (Korean only)"],
    "/jeildang/": ["제1당", "第一党", "First Party"]
  };
  var LI = { ko: 0, ja: 1, en: 2 };
  var TOOLS = [
    { path: "/japanese/", glyph: "あ", accent: "#dfff70" },
    { path: "/alarm/", glyph: "留", accent: "#9fd8ff" },
    { path: "/politics/", glyph: "政", accent: "#ffb4a2" },
    { path: "/jeildang/", glyph: "党", accent: "#cdb9ff" }
  ];
  var LANG_NAME = { ko: "한국어", ja: "日本語", en: "English" };
  var LANG_SHORT = { ko: "한", ja: "日", en: "EN" };
  var NAV_LABEL = { ko: "nihongodic 도구", ja: "nihongodic ツール", en: "nihongodic tools" };
  var LANG_LABEL = { ko: "언어", ja: "言語", en: "Language" };

  var here = location.pathname;
  var host = document.createElement("div");
  host.id = "nihongodic-nav";
  var root = host.attachShadow({ mode: "open" });

  var links = TOOLS.map(function (tl) {
    var on = here.indexOf(tl.path) === 0;
    var name = NAMES[tl.path][LI[lang]];
    return '<a href="' + tl.path + '" style="--accent:' + tl.accent + '" aria-label="' + name + '" title="' + name + '"' + (on ? ' aria-current="page"' : "") + ">" +
      '<i aria-hidden="true">' + tl.glyph + "</i></a>";
  }).join("");

  var picker = langs.length > 1
    ? '<label class="lang" title="' + LANG_LABEL[lang] + '"><span aria-hidden="true">' + LANG_SHORT[lang] + '</span><select aria-label="' + LANG_LABEL[lang] + ' / Language">' +
      langs.map(function (l) { return '<option value="' + l + '"' + (l === lang ? " selected" : "") + ' lang="' + l + '">' + LANG_NAME[l] + "</option>"; }).join("") +
      "</select></label>"
    : "";

  root.innerHTML =
    "<style>" +
    ":host{all:initial;display:block;position:relative;z-index:2147483000;--ink:#1c211d;--muted:#6c736b;--paper:#f8f7f2;--line:#dcdcd3;--on:#1c211d;" +
    "font-family:'Noto Sans KR','Noto Sans JP',system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif}" +
    "@media (prefers-color-scheme:dark){:host{--ink:#ecefe7;--muted:#9aa197;--paper:#151814;--line:#343a32}}" +
    "nav{display:flex;align-items:center;gap:6px;min-height:46px;padding:0 max(12px,env(safe-area-inset-right,0px)) 0 max(12px,env(safe-area-inset-left,0px));" +
    "background:var(--paper);border-bottom:1px solid var(--line);color:var(--ink);box-sizing:border-box}" +
    ".home{display:inline-flex;align-items:center;gap:7px;flex:none;font-weight:900;font-size:14px;letter-spacing:-.03em;color:var(--ink);text-decoration:none;padding:6px 8px 6px 0}" +
    ".home i{font-style:normal;width:24px;height:24px;display:grid;place-items:center;border:1.5px solid var(--ink);border-radius:50%;font-size:12px;line-height:1}" +
    ".tools{position:relative;min-width:0;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin-left:auto}" +
    ".tools::-webkit-scrollbar{display:none}" +
    ".tools a{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:8px;text-decoration:none}" +
    ".tools a i{font-style:normal;width:24px;height:24px;display:grid;place-items:center;border-radius:6px;background:var(--accent);color:var(--on);font-size:13px;font-weight:900;line-height:1}" +
    ".tools a:hover{background:color-mix(in srgb,var(--accent) 30%,transparent)}" +
    ".tools a[aria-current]{box-shadow:inset 0 0 0 1.5px var(--ink)}" +
    "a:focus-visible{outline:2px solid var(--ink);outline-offset:2px}" +
    ".lang{position:relative;flex:none;display:grid;place-items:center;min-width:34px;height:30px;padding:0 8px;margin-left:4px;border:1.5px solid var(--line);border-radius:8px;" +
    "font-size:12px;font-weight:800;color:var(--ink);cursor:pointer;box-sizing:border-box}" +
    ".lang:hover{border-color:var(--ink)}" +
    ".lang:focus-within{outline:2px solid var(--ink);outline-offset:2px}" +
    ".lang select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px;border:0;margin:0}" +
    "@media print{nav{display:none}}" +
    "</style>" +
    '<nav aria-label="' + NAV_LABEL[lang] + '">' +
    '<a class="home" href="/"><i aria-hidden="true">日</i><b>nihongodic</b></a>' +
    '<div class="tools">' + links + "</div>" + picker +
    "</nav>";

  if (me && me.parentNode) me.parentNode.insertBefore(host, me);
  else document.body.insertBefore(host, document.body.firstChild);

  var sel = root.querySelector("select");
  if (sel) sel.addEventListener("change", function () { setLang(sel.value); });

  var cur = root.querySelector("[aria-current]");
  // 좁은 화면에서 현재 도구가 가로 스크롤 밖에 있으면 보이게 (페이지 세로 위치는 건드리지 않음)
  if (cur) {
    var bar = cur.parentNode;
    var over = cur.offsetLeft + cur.offsetWidth - bar.clientWidth;
    if (over > 0) bar.scrollLeft = over + 12;
  }
})();

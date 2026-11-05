// 마이페이지: 사이트 전체 이용 현황.
// 로그인하면 계정에 저장된 기록(userData·dexSaves·나가타초 노트 회원 정보)을, 로그인하지 않았거나 계정 기록이 없으면 이 기기의 기록을 보여 준다.
// 제1당은 계정에 저장하지 않으므로 늘 이 기기 기록이다. 읽기만 하고 아무것도 쓰지 않는다.
import { onUser, loginForm, signOut } from "/shared/account.js";
import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore(getApps()[0]);
const ND = window.ND || { lang: "ko", t: s => s };
const lang = ["ko", "ja", "en"].includes(ND.lang) ? ND.lang : "ko";
const LI = { ko: 0, ja: 1, en: 2 }[lang];
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = n => Number(n || 0).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US");

/* ---------- 문구 ---------- */
const T = {
  title: ["마이페이지 | nihongodic", "マイページ | nihongodic", "My page | nihongodic"],
  h1: ["마이페이지", "マイページ", "My page"],
  lead: ["nihongodic 도구를 얼마나 쓰고 있는지 한곳에서 봐요.", "nihongodicのツールの利用状況をまとめて確認できます。", "Your progress across every nihongodic tool, in one place."],
  foot: ["기록을 읽기만 하고 바꾸지 않아요. 저장 항목은", "記録は読み取るだけで変更しません。保存項目は", "This page only reads your data. See what is stored in the"],
  priv: ["개인정보처리방침", "プライバシーポリシー", "Privacy Policy"],
  foot2: ["에서 볼 수 있어요.", "をご覧ください。", "."],
  guest: ["로그인하지 않았어요", "ログインしていません", "Not signed in"],
  guestT: ["지금은 이 기기에 저장된 기록만 보여요. 로그인하면 계정에 저장된 기록을 기기와 상관없이 볼 수 있어요.", "いまはこの端末に保存された記録だけを表示しています。ログインすると、アカウントに保存された記録を端末に関係なく見られます。", "Showing only what's saved on this device. Log in to see your account's progress from any device."],
  login: ["로그인", "ログイン", "Log in"],
  out: ["로그아웃", "ログアウト", "Log out"],
  google: ["Google 계정", "Googleアカウント", "Google account"],
  email: ["이메일 계정", "メールアカウント", "Email account"],
  acctNote: ["계정 기록을 불러오는 중이에요…", "アカウントの記録を読み込んでいます…", "Loading your account data…"],
  acctOk: ["계정에 저장된 기록을 보여 줘요. 계정 기록이 없는 도구는 이 기기 기록이에요.", "アカウントに保存された記録を表示しています。アカウントに記録がないツールはこの端末の記録です。", "Showing your account data. Tools with nothing in your account show this device's data."],
  acctBad: ["계정 기록을 읽지 못해서 이 기기 기록을 보여 줘요.", "アカウントの記録を読めなかったため、この端末の記録を表示しています。", "Couldn't read your account data, so this device's data is shown."],
  srcAcct: ["계정", "アカウント", "Account"],
  srcDev: ["이 기기", "この端末", "This device"],
  open: ["열기 →", "開く →", "Open →"],
  none: ["아직 기록이 없어요.", "まだ記録がありません。", "Nothing here yet."],
  // 단어
  words: ["단어 퀴즈", "単語クイズ", "Vocabulary quizzes"],
  saved: ["내 단어장", "マイ単語帳", "My words"],
  checked: ["학습 완료", "学習済み", "Learned"],
  score: ["맞힌 개수", "正解数", "Correct answers"],
  totalSaved: ["모아 둔 단어", "保存した単語", "Words saved"],
  totalChecked: ["학습 완료 단어", "学習済みの単語", "Words learned"],
  totalScore: ["누적 정답", "累計正解", "Total correct"],
  // 알리미
  alarm: ["일유알리미", "日留アラーム", "Japan Admissions Tracker"],
  picks: ["지망", "志望", "Targets"],
  schools: ["대학", "大学", "Universities"],
  facs: ["학부 단위 지망", "学部単位の志望", "Faculty-level targets"],
  next: ["다가오는 일정", "今後の日程", "Coming up"],
  noNext: ["남은 일정이 없어요.", "今後の日程はありません。", "No upcoming dates."],
  today: ["오늘", "今日", "today"],
  dLeft: ["{n}일 남음", "あと{n}日", "in {n} days"],
  // 도감
  dex: ["포켓몬 도감 도우미", "ポケモン図鑑ヘルパー", "Pokédex Helper"],
  // 나가타초
  pol: ["나가타초 노트", "나가타초 노트", "나가타초 노트"],
  role: ["회원 권한", "会員権限", "Role"],
  posts: ["올린 글", "投稿した記事", "Posts"],
  pending: ["승인 대기 글", "承認待ちの投稿", "Awaiting approval"],
  polNo: ["나가타초 노트 회원으로 가입하지 않았어요.", "나가타초 노트の会員登録はしていません。", "You haven't joined 나가타초 노트."],
  polGuest: ["로그인하면 회원 권한과 올린 글 수를 볼 수 있어요.", "ログインすると会員権限と投稿数を確認できます。", "Log in to see your role and posts."],
  roles: { pending: ["가입 승인 대기", "登録承認待ち", "Pending"], member: ["회원", "会員", "Member"], editor: ["편집자", "編集者", "Editor"], admin: ["관리자", "管理者", "Admin"], blocked: ["차단", "ブロック", "Blocked"] },
  // 제1당
  jd: ["제1당", "第一党", "First Party"],
  ach: ["도전과제", "実績", "Achievements"],
  solo: ["혼자 하기", "一人プレイ", "Solo game"],
  soloNow: ["{r} / {m}분기 진행 중", "{r} / {m}四半期 進行中", "Quarter {r} of {m}"],
  soloOver: ["끝난 판", "終了したゲーム", "Finished"],
  soloLobby: ["시작 전", "開始前", "Not started"],
  rooms: ["최근 멀티 방", "最近のマルチルーム", "Recent rooms"],
  party: ["내 정당", "自分の政党", "My party"],
  jdNote: ["제1당 기록은 이 기기에만 저장돼요.", "第一党の記録はこの端末にのみ保存されます。", "First Party progress is saved on this device only."],
};
const L = (k, vars) => { const v = T[k]; let s = Array.isArray(v) ? v[LI] : v; if (vars) s = s.replace(/\{(\w+)\}/g, (_, x) => vars[x]); return s; };

/* ---------- 기기 기록 읽기 ---------- */
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const cookie = k => { const m = document.cookie.split("; ").find(x => x.startsWith(k + "=")); return m ? decodeURIComponent(m.slice(k.length + 1)) : null; };
const list = v => { if (!v) return []; try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { try { const a = JSON.parse(decodeURIComponent(v)); return Array.isArray(a) ? a : []; } catch (e2) { return []; } } };
const int = v => { const n = Number.parseInt(v, 10); return Number.isSafeInteger(n) && n > 0 ? n : 0; };

const WORD_TOOLS = [
  { id: "wordcard", name: "단어 한 장", path: "/japanese/", glyph: "あ", accent: "var(--lime)", p: "nihongodic_", scoreCookie: true, lv: "jlpt" },
  { id: "wordcardKo", name: "単語一枚", path: "/korean/", glyph: "한", accent: "var(--rose)", p: "nihongodic_ko_", lv: "num" },
  { id: "wordcardEnJa", name: "Wordcard Japanese", path: "/en/japanese/", glyph: "W", accent: "var(--mint)", p: "nihongodic_enja_", lv: "jlpt" },
  { id: "wordcardEnKo", name: "Wordcard Korean", path: "/en/korean/", glyph: "W", accent: "var(--sand)", p: "nihongodic_enko_", lv: "num" },
];
const wordLocal = t => {
  const saved = list(lsGet(t.p + "my_words")).concat(t.scoreCookie ? list(cookie(t.p + "my_words")) : []);
  return { saved: [...new Set(saved)], checked: list(lsGet(t.p + "checked_words")), score: t.scoreCookie ? int(cookie("nihongodic_correct_answers")) : int(lsGet(t.p + "correct_answers")) };
};
const LV = ["N5", "N4", "N3", "N2", "N1"];
const lvName = (t, l) => t.lv === "jlpt" ? l : "Lv." + (LV.indexOf(l) + 1);

const GAMES = [
  { id: "frlg", key: "frlg-dex-helper-v1", max: 150, skip: [], path: "/pokemon/frlg/", vers: [["fr", ["파이어레드", "ファイアレッド", "FireRed"]], ["lg", ["리프그린", "リーフグリーン", "LeafGreen"]]] },
  { id: "rs", key: "rs-dex-helper-v1", max: 200, skip: [], path: "/pokemon/rs/", vers: [["ru", ["루비", "ルビー", "Ruby"]], ["sa", ["사파이어", "サファイア", "Sapphire"]]] },
  { id: "bw", key: "bw-dex-helper-v1", max: 156, skip: [1, 154, 155, 156], path: "/pokemon/bw/", vers: [["b", ["블랙", "ブラック", "Black"]], ["w", ["화이트", "ホワイト", "White"]]] },
  { id: "b2w2", key: "b2w2-dex-helper-v1", max: 301, skip: [1, 299, 300, 301], path: "/pokemon/b2w2/", vers: [["b2", ["블랙2", "ブラック2", "Black 2"]], ["w2", ["화이트2", "ホワイト2", "White 2"]]] },
];
// 계정(dexSaves)의 체크는 16진수 (번호 n 이 비트 n-1)
const decHex = h => { const o = {}; if (typeof h !== "string") return o; for (let i = 0; i < h.length && i < 1024; i++) { const x = parseInt(h[i], 16); if (isNaN(x)) continue; for (let j = 0; j < 4; j++) if (x >> j & 1) o[i * 4 + j + 1] = 1; } return o; };
const dexCount = (g, o) => { let c = 0; for (let n = 1; n <= g.max; n++) if (o && o[n] && !g.skip.includes(n)) c++; return c; };
const dexLocal = g => { let s = null; try { s = JSON.parse(lsGet(g.key) || "null"); } catch (e) {} return s && typeof s === "object" ? g.vers.map(([k]) => s[k] || {}) : null; };

/* ---------- 화면 ---------- */
const card = (accent, glyph, title, src, href, body) => `<section class="card" style="--accent:${accent}">
  <div class="head"><span class="glyph" aria-hidden="true">${esc(glyph)}</span><h2>${esc(title)}</h2>${src ? `<span class="src">${esc(src)}</span>` : ""}${href ? `<a class="go" href="${href}">${L("open")}</a>` : ""}</div>${body}</section>`;
const stat = (v, label) => `<div class="stat"><b>${v}</b><span>${esc(label)}</span></div>`;

function wordsCard(cloud) {
  let tot = { saved: 0, checked: 0, score: 0 }, anyAcct = false;
  const rows = WORD_TOOLS.map(t => {
    const c = cloud && cloud[t.id], d = c ? { saved: c.saved || [], checked: c.checked || [], score: c.score || 0 } : wordLocal(t);
    if (c) anyAcct = true;
    tot.saved += d.saved.length; tot.checked += d.checked.length; tot.score += d.score;
    if (!d.saved.length && !d.checked.length && !d.score) return "";
    const by = LV.map(l => [l, d.checked.filter(k => String(k).startsWith(l + ":")).length]).filter(x => x[1]);
    return `<div class="row"><span class="nm"><a href="${t.path}">${esc(t.name)}</a> <span class="src">${L(c ? "srcAcct" : "srcDev")}</span></span>
      <span class="vals">${L("saved")} ${num(d.saved.length)} · ${L("checked")} ${num(d.checked.length)} · ${L("score")} ${num(d.score)}</span>
      ${by.length ? `<span class="det">${L("checked")}: ${by.map(([l, n]) => `${lvName(t, l)} ${num(n)}`).join(" · ")}</span>` : ""}</div>`;
  }).join("");
  const body = `<div class="stats three">${stat(num(tot.saved), L("totalSaved"))}${stat(num(tot.checked), L("totalChecked"))}${stat(num(tot.score), L("totalScore"))}</div>
    ${rows ? `<div class="sub">${rows}</div>` : `<p class="empty">${L("none")}</p>`}`;
  return card("var(--lime)", "あ", L("words"), "", "", body);
}

const pad = n => String(n).padStart(2, "0");
const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
function alarmEntry(key) {
  if (typeof U === "undefined") return null;
  const [id, k] = String(key).split(":"), u = U.find(x => x.id === id); if (!u) return null;
  if (!k) return FAC[id] ? null : { name: u.n, e: u.e };
  const F = FAC[id], f = F && F.f.find(x => x.k === k); if (!f) return null;
  return { name: `${u.n} ${f.n.split(" (")[0]}`, e: [...F.ce, ...f.e] };
}
function alarmCard(cloud) {
  const fromAcct = !!(cloud && cloud.alarm && Array.isArray(cloud.alarm.sel));
  let sel = fromAcct ? cloud.alarm.sel : (cookie("jw_sel") || "").split(".").filter(x => x && x !== "-");
  const ents = sel.map(alarmEntry).filter(Boolean);
  if (!ents.length && lang === "ja") return ""; // 일본어 화면에는 없는 도구: 기록이 없으면 감춘다
  const ids = new Set(sel.map(k => k.split(":")[0]));
  const ev = [];
  // 일유알리미는 일본어판이 없어 일본어 화면에서는 영어 번역을 빌린다 (영어 화면은 공통 번역이 바꿔 준다)
  const aT = x => lang === "ja" && window.ALARM_EN ? window.ALARM_EN(x) : x;
  for (const en of ents) for (const [d, kind, label] of en.e) if (d >= todayStr) ev.push({ d, kind, t: aT(`${en.name} · ${label}`) });
  ev.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  const left = d => { const n = Math.round((new Date(d + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 864e5); return n === 0 ? L("today") : L("dLeft", { n }); };
  const md = d => { const [, m, dd] = d.split("-"); return `${+m}/${+dd}`; };
  const body = ents.length ? `<div class="stats three">${stat(num(ents.length), L("picks"))}${stat(num(ids.size), L("schools"))}${stat(num(sel.filter(k => k.includes(":")).length), L("facs"))}</div>
    <div><b style="font-size:14px">${L("next")}</b>${ev.length ? `<ul class="list" style="margin-top:8px">${ev.slice(0, 6).map(e => `<li><span class="dt">${md(e.d)}</span><span><i class="k ${e.kind}"></i>${esc(e.t)} <span class="note" style="display:inline">· ${left(e.d)}</span></span></li>`).join("")}</ul>` : `<p class="empty">${L("noNext")}</p>`}</div>`
    : `<p class="empty">${L("none")}</p>`;
  return card("var(--sky)", "留", L("alarm"), L(fromAcct ? "srcAcct" : "srcDev"), "/alarm/", body);
}

function dexCard(cloud) {
  const rows = GAMES.map(g => {
    const c = cloud && cloud[g.id];
    const pair = c ? g.vers.map(([k]) => decHex(c[k])) : dexLocal(g);
    if (!pair) return "";
    const goal = g.max - g.skip.length, cnt = pair.map(o => dexCount(g, o));
    if (!cnt[0] && !cnt[1]) return "";
    const best = Math.max(...cnt);
    return `<div class="row"><span class="nm"><a href="${g.path}">${g.vers.map(v => v[1][LI]).join(" · ")}</a> <span class="src">${L(c ? "srcAcct" : "srcDev")}</span></span>
      <span class="vals">${g.vers.map((v, i) => `${v[1][LI]} ${cnt[i]}/${goal}`).join(" · ")}</span>
      <span class="bar" aria-hidden="true"><i style="width:${Math.round(best / goal * 100)}%"></i></span></div>`;
  }).join("");
  return card("var(--coral)", "図", L("dex"), "", "/pokemon/", rows ? `<div class="sub">${rows}</div>` : `<p class="empty">${L("none")}</p>`);
}

function polCard(user, pol) {
  let body;
  if (!user) body = `<p class="empty">${L("polGuest")}</p>`;
  else if (!pol || !pol.profile) body = `<p class="empty">${L("polNo")}</p>`;
  else {
    const r = T.roles[pol.profile.role] || T.roles.pending;
    body = `<div class="stats three">${stat(esc(r[LI]), L("role"))}${stat(num(pol.posts), L("posts"))}${stat(num(pol.pending), L("pending"))}</div>`;
  }
  return card("var(--coral)", "政", L("pol"), user ? L("srcAcct") : "", "/politics/", body);
}

function jdCard() {
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const ach = Object.keys(get("party1:ach", {}) || {}).length, ACH_TOTAL = 19;
  const solo = get("party1:solo", {}) || {}, prof = get("party1:profile", {}) || {}, rooms = (get("party1:recent", []) || []).length;
  const games = Object.keys(solo).filter(k => /^games\/[^/]+$/.test(k)).map(k => solo[k]).filter(g => g && typeof g === "object");
  const g = games.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const soloText = !g ? "—" : g.status === "playing" ? L("soloNow", { r: g.round, m: g.maxRounds }) : g.status === "over" ? L("soloOver") : L("soloLobby");
  const me = g && g.parties && g.parties.find(p => !p.bot);
  const body = (ach || g || rooms || prof.name)
    ? `<div class="stats">${stat(`${ach}<small style="font-size:13px;font-weight:700"> / ${ACH_TOTAL}</small>`, L("ach"))}${stat(esc(soloText), L("solo"))}${stat(num(rooms), L("rooms"))}${me || prof.name ? stat(esc(ND.t((me && me.name) || prof.name)), L("party")) : ""}</div><p class="note">${L("jdNote")}</p>`
    : `<p class="empty">${L("none")}</p><p class="note">${L("jdNote")}</p>`;
  return card("var(--lilac)", "党", L("jd"), L("srcDev"), "/jeildang/", body);
}

/* ---------- 계정 카드 ---------- */
let form = null;
function acctCard(user, state) {
  const box = $("acct");
  if (!user) {
    box.innerHTML = `<div class="acct"><span class="avatar" aria-hidden="true">?</span><span class="who"><b>${L("guest")}</b><span>${L("guestT")}</span></span></div><div id="loginbox"></div>`;
    if (!form) form = loginForm(lang);
    $("loginbox").appendChild(form.el);
    return;
  }
  const initial = esc((user.name || user.email || "?").trim().charAt(0).toUpperCase());
  const how = user.photo ? L("google") : L("email");
  box.innerHTML = `<div class="acct"><span class="avatar">${user.photo ? `<img alt="" referrerpolicy="no-referrer" src="${esc(user.photo)}">` : initial}</span>
    <span class="who"><b>${esc(user.name || user.email)}</b><span>${esc(user.email)} · ${how}</span></span><button type="button" class="btn" id="out">${L("out")}</button></div>
    <p class="note${state === "bad" ? " bad" : ""}">${L(state === "load" ? "acctNote" : state === "bad" ? "acctBad" : "acctOk")}</p>`;
  const img = box.querySelector("img"); if (img) img.onerror = () => { img.parentNode.textContent = initial; };
  $("out").onclick = () => signOut();
}

function renderAll(user, cloud, state) {
  document.title = L("title"); $("t-h1").textContent = L("h1"); $("t-lead").textContent = L("lead");
  $("t-foot").textContent = L("foot"); $("t-priv").textContent = L("priv"); $("t-priv").href = "/privacy.html?lang=" + lang; $("t-foot2").textContent = L("foot2");
  acctCard(user, state);
  $("tools").innerHTML = [wordsCard(cloud.userData), alarmCard(cloud.userData), dexCard(cloud.dex), polCard(user, cloud.pol), jdCard()].join("");
}

let seq = 0;
async function loadCloud(user) {
  const my = ++seq;
  renderAll(user, {}, "load");
  const safe = p => p.then(x => x, () => undefined);
  const [ud, dx, prof, subs, news] = await Promise.all([
    safe(getDoc(doc(db, "userData", user.uid))), safe(getDoc(doc(db, "dexSaves", user.uid))), safe(getDoc(doc(db, "users", user.uid))),
    safe(getDocs(query(collection(db, "submissions"), where("authorUid", "==", user.uid)))),
    safe(getDocs(query(collection(db, "news"), where("authorUid", "==", user.uid)))),
  ]);
  if (my !== seq) return;
  const cloud = {
    userData: ud && ud.exists() ? ud.data() : null,
    dex: dx && dx.exists() ? dx.data() : null,
    pol: prof && prof.exists() ? { profile: prof.data(), posts: news ? news.size : 0, pending: subs ? subs.docs.filter(d => d.data().status === "pending").length : 0 } : null,
  };
  renderAll(user, cloud, ud === undefined && dx === undefined ? "bad" : "ok");
}

renderAll(null, {}, "ok");
onUser(u => { if (u) loadCloud(u); else { seq++; renderAll(null, {}, "ok"); } });

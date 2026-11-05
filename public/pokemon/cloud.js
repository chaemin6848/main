// 도감 도우미 계정: Google 로그인 + 체크 기록을 계정(Firestore dexSaves/{uid})에 저장해 기기 사이에 동기화.
// 로그인 자체는 사이트 공통 /shared/account.js 를 그대로 쓴다 (다른 도구와 로그인 상태 공유).
// 페이지(dex.js, hub.js)가 다 뜬 뒤에 import() 로 불러온다. 로그인하지 않으면 지금처럼 이 브라우저에만 저장된다.
//
// 페이지 쪽 사용법:
//   const c = mount({ box, lang: () => "ko", games: [{ id, keys: [k0, k1], get: () => [o0, o1], set: ([o0, o1]) => {} }], onState })
//   c.changed(id)   // 체크가 바뀌면 알림 → 잠시 뒤 계정에 올림
//   c.setLang()     // 언어를 바꾸면 다시 그림
//   c.open()       // 로그인 상자(Google + 이메일) 열기
// 체크 객체는 { 번호: 1 } 꼴 (dex.js 의 S[버전키] 그대로).
//
// 맞추는 규칙 (기기마다 '마지막으로 계정과 맞춘 상태'를 base 로 기억):
//   계정에 기록 없음 → 이 기기 기록을 올림 / 둘이 같음 → 그대로
//   이 기기가 base 그대로 → 계정 기록을 받음 / 계정이 base 그대로 → 이 기기 기록을 올림
//   처음 맞추는데 이 기기가 비어 있음 → 계정 기록을 받음 / 그 밖(양쪽 다 바뀜) → 합쳐서(체크 합집합) 올림
import { onUser, signOut, loginForm } from "/shared/account.js";
import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore(getApps()[0]);
const COL = "dexSaves";

const UI = {
  login: { ko: "로그인", ja: "ログイン", en: "Log in" },
  loginT: {
    ko: "로그인하면 체크 기록이 다른 기기와 동기화돼요",
    ja: "ログインすると、チェック記録がほかの端末と同期されます",
    en: "Log in to sync your checks across devices",
  },
  me: { ko: "내 계정", ja: "アカウント", en: "Account" },
  out: { ko: "로그아웃", ja: "ログアウト", en: "Log out" },
  why: { ko: "로그인하면 체크 기록이 계정에 저장돼서 다른 기기에서도 이어서 할 수 있어요.", ja: "ログインするとチェック記録がアカウントに保存され、ほかの端末でも続きから使えます。", en: "Log in to save your checks to your account and pick up on any device." },
  sync: { ko: "동기화 중…", ja: "同期中…", en: "Syncing…" },
  ok: { ko: "체크 기록이 계정에 저장돼요. 같은 계정으로 로그인한 기기끼리 자동으로 맞춰져요.", ja: "チェック記録はアカウントに保存され、同じアカウントでログインした端末どうしで自動的にそろいます。", en: "Your checks are saved to your account and stay in sync on every device signed in with it." },
  outN: { ko: "로그아웃해도 이 기기의 체크 기록은 그대로 남아요.", ja: "ログアウトしても、この端末のチェック記録はそのまま残ります。", en: "Signing out keeps the checks on this device." },
  denied: { ko: "계정 저장소를 아직 쓸 수 없어요. 체크는 이 기기에 계속 저장돼요.", ja: "アカウントの保存先をまだ利用できません。チェックはこの端末に保存され続けます。", en: "Account storage isn't available yet. Your checks are still saved on this device." },
  fail: { ko: "동기화하지 못했어요. 연결되면 다시 시도해요.", ja: "同期できませんでした。接続が戻ると再試行します。", en: "Couldn't sync. Will retry when you're back online." },
};

/* ---------- 체크 객체 ↔ 16진수 (번호 n 이 비트 n-1, 4비트씩, 뒤쪽 0은 생략) ---------- */
function enc(o) {
  const ns = Object.keys(o || {}).map(Number).filter(n => n > 0 && o[n]);
  if (!ns.length) return "";
  const max = Math.max(...ns), out = [];
  for (let i = 0; i < max; i += 4) { let x = 0; for (let j = 0; j < 4; j++) if (o[i + j + 1]) x |= 1 << j; out.push(x.toString(16)); }
  return out.join("").replace(/0+$/, "");
}
function dec(h) {
  const o = {};
  if (typeof h !== "string") return o;
  for (let i = 0; i < h.length && i < 1024; i++) {
    const x = parseInt(h[i], 16); if (isNaN(x)) continue;
    for (let j = 0; j < 4; j++) if (x >> j & 1) o[i * 4 + j + 1] = 1;
  }
  return o;
}
const str = pair => pair.map(enc).join(".");
const isEmpty = s => s === ".";
const union = (a, b) => a.map((o, i) => Object.assign({}, b[i], o));

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

export function mount({ box, lang, games, onState }) {
  const L = k => UI[k][lang()] || UI[k].en;
  const btn = box.querySelector("button");
  const pop = document.createElement("div");
  pop.className = "acct-pop"; pop.hidden = true; pop.setAttribute("role", "dialog");
  pop.innerHTML = '<div class="me"><b></b><span class="mail"></span><span class="st"></span><button type="button" class="out"></button></div><div class="in"><p class="why"></p></div>';
  box.appendChild(pop);
  const $ = s => pop.querySelector(s);

  let user = null, state = "off", stopSnap = null, ready = false, form = null, formLang = null;
  const timers = {};

  /* ---------- 그리기 ---------- */
  function paint() {
    btn.textContent = "";
    $(".out").textContent = L("out");
    pop.setAttribute("aria-label", L("me"));
    btn.setAttribute("aria-haspopup", "dialog");
    $(".me").hidden = !user; $(".in").hidden = !!user;
    if (!user) {
      btn.className = "acct-btn"; btn.textContent = L("login"); btn.title = L("loginT"); btn.setAttribute("aria-label", L("loginT"));
      $(".why").textContent = L("why");
      // 로그인 상자(Google + 이메일)는 언어가 바뀌면 새로 만든다
      if (formLang !== lang()) { if (form) form.el.remove(); form = loginForm(lang()); formLang = lang(); $(".in").appendChild(form.el); }
    } else {
      btn.className = "acct-btn me"; btn.title = user.name || user.email; btn.setAttribute("aria-label", L("me") + ": " + (user.name || user.email));
      const initial = () => { btn.textContent = (user.name || user.email || "?").trim().charAt(0).toUpperCase(); };
      if (user.photo) {
        const img = document.createElement("img"); img.alt = ""; img.referrerPolicy = "no-referrer"; img.src = user.photo;
        img.onerror = () => { btn.textContent = ""; initial(); };
        btn.appendChild(img);
      } else initial();
      $("b").textContent = user.name || "";
      $(".mail").textContent = user.email || "";
    }
    const st = !user ? "" : state === "denied" ? L("denied") : state === "error" ? L("fail") : state === "sync" ? L("sync") : L("ok") + " " + L("outN");
    $(".st").textContent = st; $(".st").hidden = !st;
    $(".st").classList.toggle("bad", state === "denied" || state === "error");
    btn.classList.toggle("warn", !!user && (state === "denied" || state === "error"));
    btn.setAttribute("aria-expanded", String(!pop.hidden));
    if (onState) onState({ user, state });
  }
  const setState = s => { if (state !== s) { state = s; paint(); } };

  /* ---------- 동기화 ---------- */
  const baseKey = g => `dex-cloud-base:${user.uid}:${g.id}`;
  const ref = () => doc(db, COL, user.uid);
  const failed = e => setState(e && e.code === "permission-denied" ? "denied" : "error");

  const pending = new Set();
  const settle = id => { pending.delete(id); if (!pending.size && state === "sync") setState("ok"); };
  function push(g, now) {
    clearTimeout(timers[g.id]);
    pending.add(g.id);
    timers[g.id] = setTimeout(() => {
      timers[g.id] = null;
      if (!user) return settle(g.id);
      const uid = user.uid, pair = g.get(), s = str(pair);
      if (s === lsGet(baseKey(g))) return settle(g.id);
      setState("sync");
      const data = { [g.keys[0]]: enc(pair[0]), [g.keys[1]]: enc(pair[1]), at: serverTimestamp() };
      setDoc(ref(), { [g.id]: data }, { merge: true }).then(() => {
        if (!user || user.uid !== uid) return;
        lsSet(baseKey(g), s);
        settle(g.id);
      }, e => { pending.delete(g.id); failed(e); });
    }, now ? 0 : 1200);
  }

  function merge(g, remote) {
    const local = g.get(), ls = str(local), base = lsGet(baseKey(g));
    if (!remote) { if (!isEmpty(ls) || base !== null) push(g, true); return; }
    const rpair = [dec(remote[g.keys[0]]), dec(remote[g.keys[1]])], rs = str(rpair);
    if (ls === rs) { lsSet(baseKey(g), ls); return; }
    if (base === ls || (base === null && isEmpty(ls))) { g.set(rpair); lsSet(baseKey(g), rs); return; }
    if (base === rs) { push(g, true); return; }
    const u = union(local, rpair);
    g.set(u); lsSet(baseKey(g), rs); push(g, true);
  }

  function follow() {
    if (stopSnap) { stopSnap(); stopSnap = null; }
    Object.keys(timers).forEach(k => { clearTimeout(timers[k]); timers[k] = null; });
    pending.clear();
    ready = false;
    if (!user) { setState("off"); return; }
    setState("sync");
    // 서버에서 확인된 내용만 맞춘다 (내가 방금 쓴 것의 메아리나 오프라인 캐시는 건너뜀)
    stopSnap = onSnapshot(ref(), { includeMetadataChanges: true }, snap => {
      if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
      const d = snap.exists() ? snap.data() : {};
      games.forEach(g => merge(g, d[g.id] && typeof d[g.id] === "object" ? d[g.id] : null));
      ready = true;
      setState(pending.size ? "sync" : "ok");
    }, e => { ready = false; failed(e); });
  }

  onUser(u => {
    const changedUser = (u && u.uid) !== (user && user.uid);
    user = u;
    if (changedUser) { pop.hidden = true; if (form) form.reset(); }
    paint();
    if (changedUser) follow();
  });

  /* ---------- 버튼 ---------- */
  const close = () => { pop.hidden = true; paint(); };
  function open() { pop.hidden = false; paint(); if (!user && form) form.focus(); }
  btn.addEventListener("click", () => { if (pop.hidden) open(); else close(); });
  $(".out").addEventListener("click", () => { pop.hidden = true; signOut(); });
  document.addEventListener("click", ev => { if (!pop.hidden && !ev.composedPath().includes(box)) close(); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !pop.hidden) { close(); btn.focus(); } });
  // 연결이 돌아오면 못 올린 기록을 다시 올린다
  window.addEventListener("online", () => { if (user && state === "error") games.forEach(g => push(g, true)); });

  paint();
  return {
    changed(id) { if (!user || !ready || state === "denied") return; const g = games.find(x => x.id === id); if (g) push(g); },
    setLang: paint,
    open,
    get user() { return user; },
  };
}

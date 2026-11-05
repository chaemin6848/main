// 사이트 공통 계정에 도구 기록을 저장해 기기 사이에 동기화한다 (Firestore userData/{uid} 의 도구별 칸).
// 로그인은 /shared/account.js (공통 메뉴의 로그인 버튼)를 그대로 쓴다. 로그인하지 않으면 지금처럼 이 브라우저에만 저장된다.
//
// 페이지 쪽 사용법 (모듈):
//   import { syncTool } from "/shared/sync.js";
//   syncTool("wordcard", [
//     { name: "saved", type: "set", local: "nihongodic_my_words" },          // localStorage 의 JSON 배열
//     { name: "score", type: "max", cookie: "nihongodic_correct_answers" },  // 쿠키의 숫자
//     { name: "sel", type: "set", get: () => [...], set: arr => {} },        // 페이지가 직접 읽고 쓰는 값
//   ]);
//   기록을 계정에서 받아 이 기기에 쓰면 window 에 "nd:synced" 이벤트({ tool, fields })를 보낸다 → 페이지가 다시 그린다.
//
// 맞추는 규칙 (기기마다 '마지막으로 계정과 맞춘 값'을 base 로 기억, 칸마다 따로):
//   set  : 계정에 없음 → 올림 / 이 기기가 base 그대로 → 계정 값을 받음 / 계정이 base 그대로 → 올림
//          둘 다 바뀜 → 합치되, 어느 한쪽에서 지운 것은 지운 채로 (처음 맞출 때는 합집합)
//   max  : 큰 쪽 (맞힌 개수처럼 늘기만 하는 숫자)
//   flag : 한쪽이라도 켜져 있으면 켬 (다시 보지 않기 같은 설정)
import { onUser } from "/shared/account.js";
import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore(getApps()[0]);
const COL = "userData";
const POLL_MS = 1500, PUSH_MS = 1200;

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const readCookie = k => { const m = document.cookie.split("; ").find(x => x.startsWith(k + "=")); return m ? decodeURIComponent(m.slice(k.length + 1)) : null; };
const writeCookie = (k, v) => { document.cookie = `${k}=${encodeURIComponent(v)}; Max-Age=${365 * 86400}; Path=/; SameSite=Lax`; };
const parseList = v => { if (!v) return []; try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { try { const a = JSON.parse(decodeURIComponent(v)); return Array.isArray(a) ? a : []; } catch (e2) { return []; } } };

/* ---------- 칸 값 읽기·쓰기 (정규화: set=정렬한 문자열 배열, max=0 이상 정수, flag=참거짓) ---------- */
function norm(f, v) {
  if (f.type === "set") return [...new Set((Array.isArray(v) ? v : []).filter(x => typeof x === "string" && x.length <= 200))].sort().slice(0, 20000);
  if (f.type === "max") { const n = Number.parseInt(v, 10); return Number.isSafeInteger(n) && n > 0 ? n : 0; }
  return !!v && v !== "0";
}
function readLocal(f) {
  if (f.get) return norm(f, f.get());
  if (f.local) { const v = lsGet(f.local); return norm(f, f.type === "set" ? parseList(v) : v); }
  if (f.cookie) { const v = readCookie(f.cookie); return norm(f, f.type === "set" ? parseList(v) : v); }
  return norm(f, null);
}
function writeLocal(f, v) {
  if (f.set) return f.set(v);
  const s = f.type === "set" ? JSON.stringify(v) : f.type === "max" ? String(v) : v ? "1" : "";
  if (f.local) { if (f.type === "flag" && !v) { try { localStorage.removeItem(f.local); } catch (e) {} } else lsSet(f.local, s); }
  if (f.cookie && (f.type !== "flag" || v)) writeCookie(f.cookie, s);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function mergeField(f, L, R, B) {
  if (f.type === "max") return Math.max(L, R);
  if (f.type === "flag") return L || R;
  if (B !== null && same(B, L)) return R;
  if (B !== null && same(B, R)) return L;
  if (B === null && !L.length) return R;
  const b = new Set(B || []), l = new Set(L), r = new Set(R);
  // 한쪽에서라도 지운 것(base 에 있었는데 어느 한쪽에 없음)은 빼고 합친다
  return [...new Set([...L, ...R])].filter(x => !(b.has(x) && (!l.has(x) || !r.has(x)))).sort();
}

/* ---------- 공통 메뉴 계정 상자에 보일 안내 ---------- */
const T = {
  ok: { ko: "이 페이지의 기록이 계정에 저장돼요. 같은 계정으로 로그인한 기기끼리 자동으로 맞춰져요.", ja: "このページの記録はアカウントに保存され、同じアカウントでログインした端末どうしで自動的にそろいます。", en: "This page's progress is saved to your account and stays in sync on every device signed in with it." },
  sync: { ko: "기록을 맞추는 중…", ja: "記録を同期中…", en: "Syncing…" },
  denied: { ko: "계정 저장소를 아직 쓸 수 없어요. 기록은 이 기기에 계속 저장돼요.", ja: "アカウントの保存先をまだ利用できません。記録はこの端末に保存され続けます。", en: "Account storage isn't available yet. Your progress is still saved on this device." },
  fail: { ko: "동기화하지 못했어요. 연결되면 다시 시도해요.", ja: "同期できませんでした。接続が戻ると再試行します。", en: "Couldn't sync. Will retry when you're back online." },
  hint: { ko: "로그인하면 이 페이지의 기록(내 단어장 등)이 계정에 저장돼서 다른 기기에서도 이어서 할 수 있어요.", ja: "ログインすると、このページの記録がアカウントに保存され、ほかの端末でも続きから使えます。", en: "Log in to save this page's progress to your account and pick up on any device." },
};
const lang = () => (window.ND && window.ND.lang) || document.documentElement.lang || "ko";
const say = (k, bad) => { if (window.ND && window.ND.setSyncNote) window.ND.setSyncNote(k ? (T[k][lang()] || T[k].ko) : "", !!bad); };

export function syncTool(tool, fields) {
  let user = null, stop = null, ready = false, timer = null, state = "off";
  const baseKey = f => `nd-sync-base:${user.uid}:${tool}:${f.name}`;
  const getBase = f => { const v = lsGet(baseKey(f)); if (v === null) return null; try { return norm(f, JSON.parse(v)); } catch (e) { return null; } };
  const setBase = (f, v) => lsSet(baseKey(f), JSON.stringify(v));
  const ref = () => doc(db, COL, user.uid);
  const setState = s => { state = s; say({ off: "", ok: "ok", sync: "sync", denied: "denied", error: "fail" }[s], s === "denied" || s === "error"); };
  if (window.ND && window.ND.setSyncHint) window.ND.setSyncHint(T.hint[lang()] || T.hint.ko);

  let last = JSON.stringify(fields.map(readLocal));
  function push(now) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!user || !ready) return;
      const uid = user.uid, vals = fields.map(readLocal);
      if (fields.every((f, i) => same(getBase(f), vals[i]))) { if (state === "sync") setState("ok"); return; }
      setState("sync");
      const data = { at: serverTimestamp() };
      fields.forEach((f, i) => { data[f.name] = vals[i]; });
      setDoc(ref(), { [tool]: data }, { merge: true }).then(() => {
        if (!user || user.uid !== uid) return;
        fields.forEach((f, i) => setBase(f, vals[i]));
        setState("ok");
      }, e => setState(e && e.code === "permission-denied" ? "denied" : "error"));
    }, now ? 0 : PUSH_MS);
  }
  function apply(remote) {
    const changed = [];let needPush = false;
    fields.forEach(f => {
      const L = readLocal(f), has = remote && Object.prototype.hasOwnProperty.call(remote, f.name);
      if (!has) { if (!same(L, norm(f, null)) || getBase(f) !== null) needPush = true; return; }
      const R = norm(f, remote[f.name]), B = getBase(f), M = mergeField(f, L, R, B);
      if (!same(M, L)) { writeLocal(f, M); changed.push(f.name); }
      if (!same(M, R)) needPush = true; else setBase(f, M);
    });
    last = JSON.stringify(fields.map(readLocal));
    if (changed.length) window.dispatchEvent(new CustomEvent("nd:synced", { detail: { tool, fields: changed } }));
    return needPush;
  }
  function follow() {
    if (stop) { stop(); stop = null; }
    clearTimeout(timer); ready = false;
    if (!user) { setState("off"); return; }
    setState("sync");
    // 서버에서 확인된 내용만 맞춘다 (방금 내가 쓴 것의 메아리나 오프라인 캐시는 건너뜀)
    stop = onSnapshot(ref(), { includeMetadataChanges: true }, snap => {
      if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
      const d = snap.exists() ? snap.data() : {};
      const mine = d[tool] && typeof d[tool] === "object" ? d[tool] : null;
      const needPush = apply(mine);
      ready = true;
      if (needPush) push(true); else setState("ok");
    }, e => { ready = false; setState(e && e.code === "permission-denied" ? "denied" : "error"); });
  }
  onUser(u => { const changedUser = (u && u.uid) !== (user && user.uid); user = u; if (changedUser) follow(); });
  // 페이지가 기록을 바꾸면(저장소·쿠키 값이 달라지면) 잠시 뒤 계정에 올린다
  setInterval(() => { const now = JSON.stringify(fields.map(readLocal)); if (now !== last) { last = now; if (user && ready) push(); } }, POLL_MS);
  const flush = () => { const now = JSON.stringify(fields.map(readLocal)); if (now !== last) { last = now; } if (user && ready && timer) push(true); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("online", () => { if (user && state === "error") push(true); });
  return { changed() { last = ""; }, get user() { return user; } };
}

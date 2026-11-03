// 나가타초 노트 — Firebase 공통 모듈 (index / login / admin 페이지가 함께 씀)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const configured = !String(firebaseConfig.apiKey || "").startsWith("여기에");
export const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// 권한 단계: pending(가입 승인 대기) → member(글 승인 요청 가능) → editor(바로 게재·승인) → admin(회원·권한 관리)
export const ROLES = { pending: "승인 대기", member: "회원", editor: "편집자", admin: "관리자", blocked: "차단" };
export const can = {
  submit: r => ["member", "editor", "admin"].includes(r),
  publish: r => ["editor", "admin"].includes(r),
  admin: r => r === "admin",
};

export const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
export const fmtDate = ts => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ".");
};

// 로그인 상태 + users/{uid} 프로필을 실시간으로 넘겨준다. cb(user, profile)
export function watchUser(cb) {
  if (!auth) { cb(null, null); return; }
  let stopProfile = null;
  onAuthStateChanged(auth, u => {
    if (stopProfile) { stopProfile(); stopProfile = null; }
    if (!u) { cb(null, null); return; }
    stopProfile = onSnapshot(doc(db, "users", u.uid),
      s => cb(u, s.exists() ? s.data() : null),
      () => cb(u, null));
  });
}

export async function logout() { if (auth) await signOut(auth); }

// 머리말 오른쪽 계정 영역
export function renderAccount(el, user, profile) {
  el.textContent = "";
  if (!configured) {
    const s = document.createElement("span"); s.className = "role"; s.textContent = "Firebase 설정 전";
    el.append(s); return;
  }
  if (!user) {
    const a = document.createElement("a"); a.className = "btn"; a.href = "login.html"; a.textContent = "로그인 · 회원가입";
    el.append(a); return;
  }
  const role = profile?.role || "pending";
  const name = document.createElement("span"); name.className = "who-am-i";
  name.textContent = profile?.name || user.displayName || user.email;
  const badge = document.createElement("span"); badge.className = "role " + role; badge.textContent = ROLES[role] || role;
  el.append(name, badge);
  if (can.publish(role)) {
    const a = document.createElement("a"); a.className = "btn"; a.href = "admin.html"; a.textContent = "관리자 페이지";
    el.append(a);
  }
  const out = document.createElement("button"); out.type = "button"; out.className = "btn"; out.textContent = "로그아웃";
  out.addEventListener("click", () => logout());
  el.append(out);
}

export function authErrorText(e) {
  const c = (e && e.code) || "";
  return ({
    "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
    "auth/missing-password": "비밀번호를 입력하세요.",
    "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
    "auth/email-already-in-use": "이미 가입된 이메일입니다. 로그인해 주세요.",
    "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않습니다.",
    "auth/user-not-found": "가입되지 않은 이메일입니다.",
    "auth/wrong-password": "비밀번호가 맞지 않습니다.",
    "auth/too-many-requests": "시도가 너무 많습니다. 잠시 후 다시 해 주세요.",
    "auth/network-request-failed": "네트워크 연결을 확인해 주세요.",
    "permission-denied": "권한이 없습니다.",
  })[c] || ("오류가 났습니다" + (c ? ` (${c})` : "") + ".");
}

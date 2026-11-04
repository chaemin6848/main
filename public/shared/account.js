// 사이트 공통 계정 (Google 로그인). /shared/nav.js 가 페이지가 다 뜬 뒤에 불러온다.
// 나가타초 노트·제1당과 같은 Firebase 프로젝트·같은 SDK 버전을 써서 로그인 상태를 함께 쓴다.
// 다른 도구에서 쓰기: ND.account.onUser(u => ...), ND.account.signIn(), ND.account.signOut()
//   u 는 { uid, name, email, photo } 또는 null (제1당의 익명 로그인은 '로그인 안 함'으로 본다)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  linkWithPopup, signInWithCredential, signOut as fbSignOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps()[0] || initializeApp(firebaseConfig);
const auth = getAuth(app);
getRedirectResult(auth).catch(() => {}); // 팝업이 막혀 리디렉트로 로그인한 경우 마무리

const pick = u => {
  if (!u || u.isAnonymous) return null;
  const g = (u.providerData || []).find(p => p.providerId === "google.com") || {};
  return { uid: u.uid, name: u.displayName || g.displayName || u.email || "", email: u.email || g.email || "", photo: u.photoURL || g.photoURL || "" };
};

export function onUser(cb) { return onAuthStateChanged(auth, u => cb(pick(u))); }
export const currentUser = () => pick(auth.currentUser);

export async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cur = auth.currentUser;
  try {
    if (cur && cur.isAnonymous) {
      // 제1당 익명 계정은 Google 계정으로 '승격'해서 uid(참가한 방)를 그대로 유지한다
      try { return await linkWithPopup(cur, provider); }
      catch (e) {
        if (e.code === "auth/credential-already-in-use") {
          const cred = GoogleAuthProvider.credentialFromError(e);
          if (cred) return await signInWithCredential(auth, cred);
        }
        throw e;
      }
    }
    return await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-environment") return signInWithRedirect(auth, provider);
    throw e;
  }
}

export const signOut = () => fbSignOut(auth);

// 사용자에게 보여 줄 오류 문구 (창을 닫은 경우 등은 빈 문자열 = 조용히 넘김)
export function errorText(e, lang) {
  const c = (e && e.code) || "";
  const L = { ko: 0, ja: 1, en: 2 }[lang] ?? 0;
  if (["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"].includes(c)) return "";
  const T = {
    "auth/operation-not-allowed": ["아직 Google 로그인을 쓸 수 없어요. 잠시 후 다시 시도해 주세요.", "まだGoogleログインを利用できません。しばらくしてからお試しください。", "Google sign-in isn't available yet. Please try again later."],
    "auth/unauthorized-domain": ["이 주소에서는 아직 로그인을 쓸 수 없어요.", "このアドレスではまだログインできません。", "Sign-in isn't enabled for this address yet."],
    "auth/network-request-failed": ["네트워크 연결을 확인해 주세요.", "ネットワーク接続を確認してください。", "Check your network connection."],
    "auth/too-many-requests": ["시도가 너무 많아요. 잠시 후 다시 해 주세요.", "試行回数が多すぎます。しばらくしてからお試しください。", "Too many attempts. Please try again later."],
  }[c];
  if (T) return T[L];
  return ["로그인하지 못했어요", "ログインできませんでした", "Couldn't sign in"][L] + (c ? ` (${c})` : "");
}

// nav.js 가 기다리는 신호 (모듈이 늦게 떠도 상관없게 ND 에 걸어 두고 알린다)
window.ND = window.ND || {};
window.ND.account = { onUser, currentUser, signIn, signOut, errorText };
document.dispatchEvent(new CustomEvent("nd:account-ready"));

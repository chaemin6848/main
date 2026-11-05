// 사이트 공통 계정 (Google 로그인 · 이메일 로그인). /shared/nav.js 가 페이지가 다 뜬 뒤에 불러오고, 마이페이지(/account/)가 직접 쓴다.
// 나가타초 노트·제1당과 같은 Firebase 프로젝트·같은 SDK 버전을 써서 로그인 상태를 함께 쓴다.
// 다른 도구에서 쓰기: ND.account.onUser(u => ...), ND.account.signIn(), ND.account.signOut()
//   이메일: signInEmail(email, pw), signUpEmail(email, pw, name), resetPassword(email) · 마이페이지: linkGoogle(), updateName(name)
//   u 는 { uid, name, email, photo, providers:['google.com','password'] } 또는 null (제1당의 익명 로그인은 '로그인 안 함'으로 본다)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onIdTokenChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  linkWithPopup, signInWithCredential, signOut as fbSignOut,
  EmailAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, linkWithCredential, updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps()[0] || initializeApp(firebaseConfig);
const auth = getAuth(app);
getRedirectResult(auth).catch(() => {}); // 팝업이 막혀 리디렉트로 로그인한 경우 마무리

const pick = u => {
  if (!u || u.isAnonymous) return null;
  const g = (u.providerData || []).find(p => p.providerId === "google.com") || {};
  return { uid: u.uid, name: u.displayName || g.displayName || u.email || "", email: u.email || g.email || "", photo: u.photoURL || g.photoURL || "",
    providers: (u.providerData || []).map(p => p.providerId) };
};

// onAuthStateChanged는 익명 계정을 Google로 승격할 때(uid가 같음) 울리지 않아 onIdTokenChanged로 듣는다.
// 토큰 갱신(약 1시간마다)에도 울리므로 로그인 상태가 실제로 바뀔 때만 넘긴다.
export function onUser(cb) {
  let last;
  return onIdTokenChanged(auth, u => {
    // 이름을 바꾸거나 Google을 연동해도 uid는 같으므로, 그런 변화도 알리도록 이름·로그인 수단까지 비교한다
    const v = pick(u), key = v ? [v.uid, v.name, v.providers.join(",")].join("|") : null;
    if (key === last) return;
    last = key;
    cb(v);
  });
}
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

// ── 이메일 로그인 ──
export const signInEmail = (email, pw) => signInWithEmailAndPassword(auth, String(email).trim(), pw);
// 가입: 제1당 익명 계정이 있으면 그 계정을 이메일 계정으로 승격해 참가한 방(uid)을 이어 간다
export async function signUpEmail(email, pw, name) {
  const cur = auth.currentUser, e = String(email).trim();
  const cred = cur && cur.isAnonymous ? await linkWithCredential(cur, EmailAuthProvider.credential(e, pw)) : await createUserWithEmailAndPassword(auth, e, pw);
  const nm = String(name || "").trim().slice(0, 30);
  if (nm) await updateProfile(cred.user, { displayName: nm });
  await cred.user.getIdToken(true); // 듣는 쪽(onUser)에 바뀐 이름·로그인 수단을 알린다
  return cred;
}
export const resetPassword = email => sendPasswordResetEmail(auth, String(email).trim());

// ── 마이페이지 ──
// 이메일로 가입한 계정에 Google을 연동한다(연동하면 둘 중 아무 방법으로나 같은 계정에 로그인)
export async function linkGoogle() {
  const cur = auth.currentUser;
  if (!cur || cur.isAnonymous) throw Object.assign(new Error("not signed in"), { code: "auth/not-signed-in" });
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const r = await linkWithPopup(cur, provider);
  await r.user.getIdToken(true);
  return r;
}
export async function updateName(name) {
  const cur = auth.currentUser;
  if (!cur || cur.isAnonymous) throw Object.assign(new Error("not signed in"), { code: "auth/not-signed-in" });
  await updateProfile(cur, { displayName: String(name || "").trim().slice(0, 30) });
  await cur.getIdToken(true);
}

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
    "auth/invalid-credential": ["이메일이나 비밀번호가 맞지 않아요.", "メールアドレスまたはパスワードが違います。", "Wrong email or password."],
    "auth/invalid-login-credentials": ["이메일이나 비밀번호가 맞지 않아요.", "メールアドレスまたはパスワードが違います。", "Wrong email or password."],
    "auth/wrong-password": ["이메일이나 비밀번호가 맞지 않아요.", "メールアドレスまたはパスワードが違います。", "Wrong email or password."],
    "auth/user-not-found": ["이메일이나 비밀번호가 맞지 않아요.", "メールアドレスまたはパスワードが違います。", "Wrong email or password."],
    "auth/invalid-email": ["이메일 주소를 확인해 주세요.", "メールアドレスを確認してください。", "Check the email address."],
    "auth/missing-password": ["비밀번호를 입력해 주세요.", "パスワードを入力してください。", "Enter a password."],
    "auth/weak-password": ["비밀번호는 6자 이상이어야 해요.", "パスワードは6文字以上にしてください。", "Use a password of at least 6 characters."],
    "auth/email-already-in-use": ["이미 가입된 이메일이에요. 로그인해 주세요.", "すでに登録済みのメールアドレスです。ログインしてください。", "That email is already registered. Please log in."],
    "auth/account-exists-with-different-credential": ["이 이메일은 이메일 로그인으로 가입돼 있어요. 이메일로 로그인한 뒤 마이페이지에서 Google을 연동해 주세요.", "このメールアドレスはメールログインで登録されています。メールでログインしてから、マイページでGoogleを連携してください。", "This email is registered with email sign-in. Log in with your email, then link Google on My page."],
    "auth/credential-already-in-use": ["이 Google 계정은 이미 다른 계정에 쓰이고 있어요.", "このGoogleアカウントはすでに別のアカウントで使われています。", "That Google account is already used by another account."],
    "auth/provider-already-linked": ["이미 Google이 연동돼 있어요.", "すでにGoogleが連携されています。", "Google is already linked."],
    "auth/requires-recent-login": ["보안을 위해 다시 로그인한 뒤 시도해 주세요.", "セキュリティのため、もう一度ログインしてからお試しください。", "For security, log in again and retry."],
    "auth/not-signed-in": ["먼저 로그인해 주세요.", "先にログインしてください。", "Please log in first."],
  }[c];
  if (T) return T[L];
  return ["로그인하지 못했어요", "ログインできませんでした", "Couldn't sign in"][L] + (c ? ` (${c})` : "");
}

// nav.js 가 기다리는 신호 (모듈이 늦게 떠도 상관없게 ND 에 걸어 두고 알린다)
window.ND = window.ND || {};
window.ND.account = { onUser, currentUser, signIn, signOut, errorText, signInEmail, signUpEmail, resetPassword, linkGoogle, updateName };
document.dispatchEvent(new CustomEvent("nd:account-ready"));

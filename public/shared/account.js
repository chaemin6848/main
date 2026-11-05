// 사이트 공통 계정 (Google 로그인). /shared/nav.js 가 페이지가 다 뜬 뒤에 불러온다.
// 나가타초 노트·제1당과 같은 Firebase 프로젝트·같은 SDK 버전을 써서 로그인 상태를 함께 쓴다.
// 다른 도구에서 쓰기: ND.account.onUser(u => ...), ND.account.signIn(), ND.account.signOut()
//   이메일(아이디) 로그인: signInEmail(email, pw), signUpEmail(email, pw, name), resetPassword(email)
//   마이페이지: linkGoogle() 로그인한 계정에 Google 로그인 추가, updateName(name)
//   로그인 상자: loginForm(lang, { onDone }) → Google 버튼 + 이메일 로그인·회원가입·비밀번호 찾기 (클래스 nd-*, 스타일은 각 페이지가)
//   u 는 { uid, name, email, photo, providers } 또는 null (providers: ["google.com", "password"] 중 연결된 것) (제1당의 익명 로그인은 '로그인 안 함'으로 본다)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onIdTokenChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  linkWithPopup, signInWithCredential, signOut as fbSignOut,
  EmailAuthProvider, linkWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps()[0] || initializeApp(firebaseConfig);
const auth = getAuth(app);
getRedirectResult(auth).catch(() => {}); // 팝업이 막혀 리디렉트로 로그인한 경우 마무리

const pick = u => {
  if (!u || u.isAnonymous) return null;
  const g = (u.providerData || []).find(p => p.providerId === "google.com") || {};
  const providers = (u.providerData || []).map(p => p.providerId).filter(Boolean);
  return { uid: u.uid, name: u.displayName || g.displayName || u.email || "", email: u.email || g.email || "", photo: u.photoURL || g.photoURL || "", providers };
};

const listeners = new Set();
// onAuthStateChanged 는 익명 계정을 Google·이메일로 승격하거나 로그인 방법을 연동할 때(uid 그대로) 알려 주지 않는다.
// 그래서 토큰이 바뀔 때마다 보고, 화면에 보이는 값(uid·이름·연동 방법)이 바뀐 경우에만 알린다.
const sig = v => v ? [v.uid, v.name, v.email, v.photo, v.providers.join(",")].join("|") : "";
export function onUser(cb) {
  let last;
  const fire = v => { const k = sig(v); if (k === last) return; last = k; cb(v); };
  listeners.add(fire);
  const stop = onIdTokenChanged(auth, u => fire(pick(u)));
  return () => { listeners.delete(fire); stop(); };
}
const notify = () => { const v = pick(auth.currentUser); listeners.forEach(cb => cb(v)); };
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

/* ---------- 이메일(아이디) 로그인 — 나가타초 노트 회원가입과 같은 계정 ---------- */
export function signInEmail(email, pw) { return signInWithEmailAndPassword(auth, email.trim(), pw); }
export async function signUpEmail(email, pw, name) {
  const cur = auth.currentUser, cred = EmailAuthProvider.credential(email.trim(), pw);
  // 제1당 익명 계정이면 승격해서 uid(참가한 방)를 그대로 유지한다
  const res = cur && cur.isAnonymous ? await linkWithCredential(cur, cred) : await createUserWithEmailAndPassword(auth, email.trim(), pw);
  const dn = (name || "").trim().slice(0, 30) || email.trim().split("@")[0].slice(0, 30);
  try { await updateProfile(res.user, { displayName: dn }); await res.user.reload(); } catch (e) {}
  // 이름을 바꾼 뒤 화면에 다시 알린다 (토큰 변경 알림은 이름 변경을 알려 주지 않음)
  notify();
  return res;
}
export function resetPassword(email) { return sendPasswordResetEmail(auth, email.trim()); }

/* ---------- 마이페이지: 로그인 방법 연동·이름 ---------- */
const notSignedIn = () => Object.assign(new Error("not signed in"), { code: "auth/not-signed-in" });
// 이메일로 가입한 계정에 Google 로그인을 더한다 (uid 그대로, 어느 쪽으로 로그인해도 같은 계정)
export async function linkGoogle() {
  const cur = auth.currentUser;
  if (!cur || cur.isAnonymous) throw notSignedIn();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const res = await linkWithPopup(cur, provider);
  // 이름·사진이 비어 있으면 Google 계정 것으로 채운다
  const g = (res.user.providerData || []).find(p => p.providerId === "google.com") || {};
  const fill = {};
  if (!res.user.displayName && g.displayName) fill.displayName = g.displayName;
  if (!res.user.photoURL && g.photoURL) fill.photoURL = g.photoURL;
  if (Object.keys(fill).length) { try { await updateProfile(res.user, fill); } catch (e) {} }
  try { await res.user.reload(); } catch (e) {}
  notify();
  return res;
}
export async function updateName(name) {
  const cur = auth.currentUser;
  if (!cur || cur.isAnonymous) throw notSignedIn();
  const dn = String(name || "").trim().slice(0, 30);
  if (!dn) return;
  await updateProfile(cur, { displayName: dn });
  notify();
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
    "auth/invalid-email": ["이메일 형식이 올바르지 않아요.", "メールアドレスの形式が正しくありません。", "That email address doesn't look right."],
    "auth/missing-email": ["이메일을 입력해 주세요.", "メールアドレスを入力してください。", "Enter your email address."],
    "auth/missing-password": ["비밀번호를 입력해 주세요.", "パスワードを入力してください。", "Enter your password."],
    "auth/weak-password": ["비밀번호는 6자 이상이어야 해요.", "パスワードは6文字以上にしてください。", "Use at least 6 characters for your password."],
    "auth/email-already-in-use": ["이미 가입된 이메일이에요. 로그인해 주세요.", "すでに登録されているメールアドレスです。ログインしてください。", "That email is already registered. Please log in."],
    "auth/credential-already-in-use": ["이미 다른 계정에 연결된 로그인 정보예요. 그 방법으로 로그인해 주세요.", "すでに別のアカウントに連携されているログイン情報です。その方法でログインしてください。", "Those sign-in details already belong to another account. Sign in with them instead."],
    "auth/account-exists-with-different-credential": ["이 이메일은 다른 로그인 방법으로 가입돼 있어요. 그 방법으로 로그인한 뒤 마이페이지에서 연동해 주세요.", "このメールアドレスは別のログイン方法で登録されています。その方法でログインしてからマイページで連携してください。", "This email is registered with another sign-in method. Sign in that way, then link it on My page."],
    "auth/provider-already-linked": ["이미 연동돼 있어요.", "すでに連携されています。", "Already linked."],
    "auth/requires-recent-login": ["보안을 위해 다시 로그인한 뒤 해 주세요.", "セキュリティのため、もう一度ログインしてからお試しください。", "For security, sign in again and retry."],
    "auth/not-signed-in": ["먼저 로그인해 주세요.", "先にログインしてください。", "Please sign in first."],
    "auth/invalid-credential": ["이메일 또는 비밀번호가 맞지 않아요.", "メールアドレスまたはパスワードが違います。", "Wrong email or password."],
    "auth/wrong-password": ["이메일 또는 비밀번호가 맞지 않아요.", "メールアドレスまたはパスワードが違います。", "Wrong email or password."],
    "auth/user-not-found": ["가입되지 않은 이메일이에요.", "登録されていないメールアドレスです。", "No account uses that email."],
    "auth/user-disabled": ["사용이 중지된 계정이에요.", "このアカウントは無効になっています。", "This account has been disabled."],
    "auth/too-many-requests": ["시도가 너무 많아요. 잠시 후 다시 해 주세요.", "試行回数が多すぎます。しばらくしてからお試しください。", "Too many attempts. Please try again later."],
  }[c];
  if (T) return T[L];
  return ["로그인하지 못했어요", "ログインできませんでした", "Couldn't sign in"][L] + (c ? ` (${c})` : "");
}


/* ---------- 로그인 상자 (Google + 이메일). 각 페이지가 nd-* 클래스에 스타일을 입힌다 ---------- */
const F = {
  google: ["Google 계정으로 계속하기", "Googleアカウントで続ける", "Continue with Google"],
  or: ["또는 이메일로", "またはメールアドレスで", "or with email"],
  email: ["이메일", "メールアドレス", "Email"],
  pw: ["비밀번호", "パスワード", "Password"],
  pwNew: ["비밀번호 (6자 이상)", "パスワード（6文字以上）", "Password (6+ characters)"],
  name: ["이름 (선택)", "名前（任意）", "Name (optional)"],
  login: ["로그인", "ログイン", "Log in"],
  signup: ["회원가입", "新規登録", "Sign up"],
  toSignup: ["처음이에요 · 회원가입", "はじめての方・新規登録", "New here? Sign up"],
  toLogin: ["이미 계정이 있어요 · 로그인", "アカウントをお持ちの方・ログイン", "Have an account? Log in"],
  forgot: ["비밀번호를 잊었어요", "パスワードを忘れた", "Forgot password"],
  agree: ["개인정보 수집·이용에 동의하며 만 14세 이상이에요. (필수)", "個人情報の収集・利用に同意し、14歳以上です。（必須）", "I agree to the collection and use of my information and I'm 14 or older. (required)"],
  privacy: ["개인정보처리방침", "プライバシーポリシー", "Privacy Policy"],
  needAgree: ["개인정보 수집·이용에 동의해야 가입할 수 있어요.", "個人情報の収集・利用への同意が必要です。", "Please agree to continue."],
  needEmail: ["위 칸에 이메일을 먼저 입력해 주세요.", "上の欄にメールアドレスを入力してください。", "Enter your email above first."],
  sent: ["비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.", "パスワード再設定メールを送りました。メールを確認してください。", "We sent a password reset email. Check your inbox."],
  busy: ["잠시만요…", "お待ちください…", "One moment…"],
  shared: ["nihongodic 사이트 공통 계정이에요. 나가타초 노트에서 만든 계정으로도 로그인할 수 있어요.", "nihongodic サイト共通のアカウントです。나가타초 노트で作ったアカウントでもログインできます。", "One account for all of nihongodic, including 나가타초 노트 accounts."],
};
export function loginForm(lang, { onDone } = {}) {
  const L = k => F[k][{ ko: 0, ja: 1, en: 2 }[lang] ?? 0];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const box = el("div", "nd-login");
  const g = el("button", "nd-google", L("google")); g.type = "button";
  const or = el("p", "nd-or", L("or"));
  const form = el("form", "nd-form"); form.noValidate = true;
  const field = (label, type, ac) => { const l = el("label", "nd-field"); const s = el("span", null, label); const i = el("input"); i.type = type; i.autocomplete = ac; if (type !== "text") i.required = true; l.append(s, i); return [l, i, s]; };
  const [nameL, nameI] = field(L("name"), "text", "nickname"); nameI.maxLength = 30;
  const [emailL, emailI] = field(L("email"), "email", "email");
  const [pwL, pwI, pwS] = field(L("pw"), "password", "current-password");
  const agreeL = el("label", "nd-agree"); const agreeI = el("input"); agreeI.type = "checkbox";
  const agreeT = el("span", null, L("agree") + " ");
  const pv = el("a", null, L("privacy")); pv.href = "/privacy.html?lang=" + lang; pv.target = "_blank"; pv.rel = "noopener";
  agreeT.append(pv); agreeL.append(agreeI, agreeT);
  const submit = el("button", "nd-submit"); submit.type = "submit";
  const links = el("div", "nd-links");
  const mode = el("button", "nd-link"); mode.type = "button";
  const forgot = el("button", "nd-link", L("forgot")); forgot.type = "button";
  links.append(mode, forgot);
  const msg = el("p", "nd-msg"); msg.setAttribute("role", "status");
  const note = el("p", "nd-note", L("shared"));
  form.append(nameL, emailL, pwL, agreeL, submit, links, msg);
  box.append(g, or, form, note);

  let signup = false, busy = false;
  const say = (t, bad) => { msg.textContent = t || ""; msg.classList.toggle("bad", !!bad); };
  function setMode(v) {
    signup = v; nameL.hidden = agreeL.hidden = !v; forgot.hidden = v;
    submit.textContent = L(v ? "signup" : "login"); mode.textContent = L(v ? "toLogin" : "toSignup");
    pwS.textContent = L(v ? "pwNew" : "pw"); pwI.autocomplete = v ? "new-password" : "current-password";
    say("");
  }
  setMode(false);
  const run = async (fn, okText) => {
    if (busy) return; busy = true; g.disabled = submit.disabled = true; say(L("busy"));
    try { await fn(); say(okText || ""); if (!okText && onDone) onDone(); }
    catch (e) { say(errorText(e, lang), true); }
    finally { busy = false; g.disabled = submit.disabled = false; }
  };
  g.addEventListener("click", () => run(() => signIn()));
  mode.addEventListener("click", () => setMode(!signup));
  agreeI.addEventListener("change", () => { if (agreeI.checked && msg.classList.contains("bad")) say(""); });
  forgot.addEventListener("click", () => {
    if (!emailI.value.trim()) { say(L("needEmail"), true); emailI.focus(); return; }
    run(() => resetPassword(emailI.value), L("sent"));
  });
  form.addEventListener("submit", ev => {
    ev.preventDefault();
    if (signup && !agreeI.checked) { say(L("needAgree"), true); return; }
    run(() => signup ? signUpEmail(emailI.value, pwI.value, nameI.value) : signInEmail(emailI.value, pwI.value));
  });
  return { el: box, reset() { setMode(false); pwI.value = ""; say(""); }, focus() { emailI.focus(); } };
}

// nav.js 가 기다리는 신호 (모듈이 늦게 떠도 상관없게 ND 에 걸어 두고 알린다)
window.ND = window.ND || {};
window.ND.account = { onUser, currentUser, signIn, signOut, errorText, signInEmail, signUpEmail, resetPassword, loginForm, linkGoogle, updateName };
document.dispatchEvent(new CustomEvent("nd:account-ready"));

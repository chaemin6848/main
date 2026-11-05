// 제1당 — 사이트용 온라인 저장소. 게임 코드가 쓰는 저장소 호출을 Firestore로 옮긴다.
// 멀티플레이는 Google 로그인(사이트 공통 /shared/account.js)이 있어야 한다. 익명 로그인은 하지 않고,
// 예전에 익명으로 참가한 사람은 Google로 로그인하면 계정이 승격되어 uid(참가한 방)가 그대로 이어진다.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onIdTokenChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, doc, collection, query, orderBy, limit, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, runTransaction }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const ROOT = "jeilGames";
const fix = p => p.replace(/^games(?=\/|$)/, ROOT);

function wrapDoc(s) {
  return { id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata };
}
function wrapQuery(s) {
  return { docs: s.docs.map(wrapDoc), size: s.size, empty: s.empty, metadata: s.metadata };
}

let fsInst = null;
function base() {
  // 사이트 공통 계정 모듈과 같은 Firebase 앱을 쓴다(먼저 뜬 쪽이 만든 앱을 같이 쓴다).
  const app = getApps()[0] || initializeApp(firebaseConfig);
  if (!fsInst) fsInst = initializeFirestore(app, { ignoreUndefinedProperties: true });
  return { auth: getAuth(app), fs: fsInst };
}
const signedIn = u => !!u && !u.isAnonymous;

// 계정이 바뀔 때마다 cb(연결 | null). Google로 로그인한 사람만 연결을 받는다. 돌려주는 함수로 그만 듣는다.
// onAuthStateChanged는 익명 계정을 Google로 승격할 때(uid가 같음) 울리지 않으므로 onIdTokenChanged로 듣고,
// 토큰이 갱신될 때마다 울리는 것은 '로그인한 uid'가 바뀔 때만 넘기도록 거른다.
export function onAccount(cb, onError) {
  const { auth, fs } = base();
  let last;
  return onIdTokenChanged(auth, u => {
    const key = signedIn(u) ? u.uid : null;
    if (key === last) return;
    last = key;
    cb(key ? api(fs, u) : null);
  }, onError);
}

function api(fs, user) {

  const docApi = path => {
    const ref = doc(fs, fix(path));
    return {
      path, id: ref.id,
      get: async () => wrapDoc(await getDoc(ref)),
      set: d => setDoc(ref, d),
      update: d => updateDoc(ref, d),
      delete: () => deleteDoc(ref),
      // 분기 처리는 한 사람만 하도록 짧은 임대를 잡는다.
      acquire: async ({ holder, ttlMs = 30000 }) => {
        const lease = doc(fs, fix(path), "lease", "resolve");
        const acquired = await runTransaction(fs, async tx => {
          const cur = await tx.get(lease);
          if (cur.exists() && cur.data().holder !== holder && cur.data().until > Date.now()) return false;
          tx.set(lease, { holder, until: Date.now() + ttlMs });
          return true;
        });
        return { acquired };
      },
      onSnapshot: (next, error) => onSnapshot(ref, { includeMetadataChanges: false }, s => next(wrapDoc(s)), error),
    };
  };
  const queryApi = (path, q) => {
    const base = collection(fs, fix(path));
    const target = q.length ? query(base, ...q) : base;
    return {
      path,
      doc: id => docApi(path + "/" + id),
      orderBy: (by, dir) => queryApi(path, [...q, orderBy(by, dir)]),
      limit: n => queryApi(path, [...q, limit(n)]),
      get: async () => wrapQuery(await getDocs(target)),
      onSnapshot: (next, error) => onSnapshot(target, s => next(wrapQuery(s)), error),
    };
  };
  const g = (user.providerData || []).find(p => p.providerId === "google.com") || {};
  return { db: { doc: docApi, collection: p => queryApi(p, []) }, id: user.uid, canWrite: true,
    user: { uid: user.uid, name: user.displayName || g.displayName || user.email || "", email: user.email || g.email || "" } };
}

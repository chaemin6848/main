// 제1당 — 사이트용 온라인 저장소. 게임 코드가 쓰는 저장소 호출을 Firestore로 옮긴다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

export async function connect() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const user = await new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, u => {
      stop();
      if (u) resolve(u);
      else signInAnonymously(auth).then(c => resolve(c.user), reject);
    }, reject);
  });

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
  return { db: { doc: docApi, collection: p => queryApi(p, []) }, id: user.uid, canWrite: true };
}

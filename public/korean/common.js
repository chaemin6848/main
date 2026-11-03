/* 単語一枚(일본어 화자용 한국어 퀴즈) 공통 — 저장소, 레벨 이름, 한국어 뜻 다루기.
   단어 데이터는 /japanese/vocabulary.js(JLPT 단어 + 한국어 뜻)를 그대로 쓰고, 방향만 뒤집는다.
   저장 키는 한국어판과 섞이지 않게 nihongodic_ko_ 로 시작한다. */
const KO = {
  SCORE_KEY: "nihongodic_ko_correct_answers",
  SAVED_KEY: "nihongodic_ko_my_words",
  CHECKED_KEY: "nihongodic_ko_checked_words",
  TUTORIAL_KEY: "nihongodic_ko_tutorial_hidden",
  MAX_AGE: 60 * 60 * 24 * 365,
  LEVELS: ["N5", "N4", "N3", "N2", "N1"],
  // JLPT 레벨을 그대로 보여 주면 한국어 난이도로 오해할 수 있어 Lv.1~5로 부른다 (쉬운 일본어 단어 = 기초 어휘)
  levelName(level) { const i = KO.LEVELS.indexOf(level); return i >= 0 ? `Lv.${i + 1}` : level; },
  readCookie(name) { return document.cookie.split("; ").find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || ""; },
  get(name) { try { return localStorage.getItem(name); } catch (error) { return KO.readCookie(name) ? decodeURIComponent(KO.readCookie(name)) : null; } },
  set(name, value) {
    try { localStorage.setItem(name, value); }
    catch (error) { document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${KO.MAX_AGE}; Path=/; SameSite=Lax`; }
  },
  readSet(name) { try { const list = JSON.parse(KO.get(name) || "[]"); return new Set(Array.isArray(list) ? list : []); } catch (error) { return new Set(); } },
  saveSet(name, values) { KO.set(name, JSON.stringify([...values])); },
  readScore() { const n = Number.parseInt(KO.get(KO.SCORE_KEY), 10); return Number.isSafeInteger(n) && n >= 0 ? n : 0; },
  wordKey(word) { return `${word.level}:${word.word}:${word.reading || ""}`; },
  // N1~N3 일부 항목은 korean 칸에 영어 뜻이 들어 있다. 한글 뜻이 있는 단어만 쓴다.
  hasKorean(word) { return typeof word.korean === "string" && /[가-힣]/.test(word.korean); },
  meanings(value = "") { return value.split(/[,，、/;；]/).map((m) => m.trim()).filter((m) => /[가-힣]/.test(m)); },
  firstMeaning(value = "") { return KO.meanings(value)[0] || value.trim(); },
  // 표제어 앞뒤의 ~, 괄호 설명 — "~구", "(시간이) 걸리다" → "구", "걸리다"
  bare(value = "") { return value.normalize("NFKC").replace(/\([^)]*\)/g, "").replace(/[~～〜.!?。·]/g, "").replace(/\s/g, ""); }
};

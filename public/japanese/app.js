const state = { words: window.JLPT_VOCABULARY || [], level: "N5", current: null, seen: new Set(), score: 0, revealed: false };
const $ = (id) => document.getElementById(id);
const els = { buttons: document.querySelectorAll(".level-btn"), badge: $("level-badge"), count: $("word-count"), meaning: $("meaning"), gloss: $("english-gloss"), reading: $("part-of-speech"), form: $("answer-form"), answer: $("answer"), check: $("check-button"), feedback: $("feedback"), reveal: $("answer-reveal"), save: $("save-word-button"), hint: $("hint-button"), next: $("next-button"), score: $("score") };
const SCORE_COOKIE = "nihongodic_correct_answers";
const SCORE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const SAVED_WORDS_KEY = "nihongodic_my_words";
const SAVED_WORDS_MAX_AGE = 60 * 60 * 24 * 365;
const TUTORIAL_COOKIE = "nihongodic_tutorial_hidden";
const TUTORIAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readScoreCookie() {
  const cookie = document.cookie.split("; ").find((item) => item.startsWith(`${SCORE_COOKIE}=`));
  const score = Number.parseInt(cookie?.split("=")[1], 10);
  return Number.isSafeInteger(score) && score >= 0 ? score : 0;
}
function saveScoreCookie() {
  document.cookie = `${SCORE_COOKIE}=${state.score}; Max-Age=${SCORE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}
function wordKey(word) { return `${word.level}:${word.word}:${word.reading || ""}`; }
function readCookie(name) { return document.cookie.split("; ").find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || ""; }
function parseStoredList(value) {
  if (!value) return [];
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list : [];
  } catch (error) {
    try {
      const list = JSON.parse(decodeURIComponent(value));
      return Array.isArray(list) ? list : [];
    } catch (decodeError) { return []; }
  }
}
// 쿠키는 4KB 한도라 단어 50여 개에서 저장이 멈춥니다. localStorage에 저장하고, 예전 쿠키는 합친 뒤 지웁니다.
function savedWords() {
  let stored = null;
  try { stored = localStorage.getItem(SAVED_WORDS_KEY); } catch (error) {}
  const cookieValue = readCookie(SAVED_WORDS_KEY);
  const words = new Set([...parseStoredList(stored), ...parseStoredList(cookieValue)]);
  if (cookieValue) saveSavedWords(words);
  return words;
}
function saveSavedWords(words) {
  const value = JSON.stringify([...words]);
  try {
    localStorage.setItem(SAVED_WORDS_KEY, value);
    document.cookie = `${SAVED_WORDS_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch (error) { document.cookie = `${SAVED_WORDS_KEY}=${encodeURIComponent(value)}; Max-Age=${SAVED_WORDS_MAX_AGE}; Path=/; SameSite=Lax`; }
}
function openTutorial() {
  const dialog = $("tutorial-dialog");
  if (!dialog || readCookie(TUTORIAL_COOKIE) || localStorage.getItem(TUTORIAL_COOKIE)) return;
  dialog.showModal();
  $("tutorial-start").focus();
}
function saveTutorialPreference() {
  document.cookie = `${TUTORIAL_COOKIE}=1; Max-Age=${TUTORIAL_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  localStorage.setItem(TUTORIAL_COOKIE, "1");
}
function closeTutorial() {
  const dialog = $("tutorial-dialog");
  if (!dialog) return;
  if ($("tutorial-dismiss").checked) saveTutorialPreference();
  dialog.close();
}

// N1~N3의 일부 원본 항목은 korean 필드에 영어 뜻이 들어 있습니다.
// 문제 문구에는 실제 한국어 뜻을 가진 단어만 사용해 영어가 문제로
// 표시되는 일을 막습니다.
function hasKoreanMeaning(word) { return typeof word.korean === "string" && /[가-힣]/.test(word.korean); }
function pool() { return state.words.filter((word) => word.level === state.level && hasKoreanMeaning(word)); }
function setEnabled(enabled) { [els.answer, els.check, els.hint, els.next].forEach((item) => { item.disabled = !enabled; }); }
function normalise(value = "") { return value.normalize("NFKC").trim().replace(/\s/g, ""); }
function answerCandidates(value = "") {
  // ～ 나 괄호가 붙은 표제어(ほんの～, ～丁目)는 기호 없이 입력해도 정답으로 인정합니다.
  return [...new Set(value.split(/[,，、/;；]/).flatMap((candidate) => {
    const form = normalise(candidate);
    return [form, form.replace(/[~()]/g, ""), form.replace(/\([^)]*\)/g, "").replace(/~/g, "")];
  }))].filter(Boolean);
}
function displayMeaning(value = "") { return value.split(/[,，、/;；]/).map((candidate) => candidate.trim()).filter(Boolean)[0] || "뜻 정보 없음"; }
function meaningCandidates(value = "") {
  return answerCandidates(value).flatMap((candidate) => {
    const withoutNote = candidate.replace(/\([^)]*\)/g, "").replace(/[~～]/g, "");
    return withoutNote && withoutNote !== candidate ? [candidate, withoutNote] : [candidate];
  });
}
function hasJapanese(value) { return /[ぁ-ゖァ-ヺ一-龯々ー]/.test(value); }
function meaningForms(value) {
  const normalised = normalise(value).replace(/[~～.!?。]/g, "");
  const withoutParticles = normalised.replace(/(에서|으로|에게|부터|까지|을|를|이|가|은|는|도|에)$/, "");
  const stem = withoutParticles.replace(/(습니다|ㅂ니다|입니다|어요|아요|해요|한다|하는|하게|했고|하고|고|다|요)$/g, "");
  return [normalised, withoutParticles, stem].filter((form, index, forms) => form.length >= 2 && forms.indexOf(form) === index);
}
function translatedMeaningMatches(translated, meaning) {
  const translatedForms = new Set(meaningForms(translated));
  return meaningCandidates(meaning).some((candidate) => meaningForms(candidate).some((candidateForm) => translatedForms.has(candidateForm)));
}
async function analyseMeaning(answer, meaning) {
  if (!hasJapanese(answer) || /[가-힣]/.test(answer)) return { exists: false, correct: false };
  const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(answer)}&langpair=ja|ko`);
  if (!response.ok) throw new Error("Translation request failed");
  const data = await response.json();
  const translated = data.responseData?.translatedText || "";
  const exists = Boolean(translated && normalise(translated) !== answer && data.responseStatus === 200);
  return { exists, correct: exists && translatedMeaningMatches(translated, meaning) };
}
function displayAnswer() {
  const word = state.current; if (!word) return;
  els.reveal.replaceChildren();
  const answer = document.createElement("div");
  answer.innerHTML = '<span class="reveal-label">정답</span>';
  const japanese = document.createElement("strong"); japanese.lang = "ja"; japanese.id = "japanese-word"; japanese.textContent = word.word;
  const reading = document.createElement("span"); reading.textContent = word.reading ? `읽기 · ${word.reading}` : "";
  answer.append(japanese, reading);
  els.reveal.append(answer);
  if (word.example) {
    const example = document.createElement("div"); example.className = "example";
    const label = document.createElement("span"); label.className = "reveal-label"; label.textContent = "예문";
    const japaneseExample = document.createElement("p"); japaneseExample.lang = "ja"; japaneseExample.textContent = word.example;
    const koreanExample = document.createElement("p"); koreanExample.textContent = word.exampleKorean || "";
    example.append(label, japaneseExample, koreanExample); els.reveal.append(example);
  }
  els.reveal.hidden = false;
}
function updateSaveButton() {
  const saved = savedWords().has(wordKey(state.current));
  els.save.hidden = false; els.save.disabled = saved; els.save.textContent = saved ? "내 단어장에 추가됨" : "내 단어장에 추가";
}
function pickWord() {
  const choices = pool(); els.count.textContent = choices.length ? `${choices.length.toLocaleString()}개 중 랜덤` : "단어 데이터 미등록";
  if (!choices.length) {
    state.current = null; els.badge.textContent = `JLPT ${state.level}`; els.meaning.textContent = `${state.level} 한국어 뜻 단어를 찾을 수 없어요.`; els.gloss.textContent = "한국어 뜻이 있는 단어 데이터가 연결되면 퀴즈가 시작됩니다."; els.reading.textContent = ""; els.reveal.hidden = true; els.save.hidden = true; els.feedback.textContent = ""; setEnabled(false); return;
  }
  let candidates = choices.filter((word) => !state.seen.has(`${word.level}:${word.word}`));
  if (!candidates.length) { state.seen.clear(); candidates = choices; }
  state.current = candidates[Math.floor(Math.random() * candidates.length)]; state.seen.add(`${state.current.level}:${state.current.word}`); state.revealed = false;
  els.badge.textContent = `JLPT ${state.level}`; els.meaning.textContent = displayMeaning(state.current.korean); els.gloss.textContent = state.current.english ? `EN · ${state.current.english}` : ""; els.reading.textContent = ""; els.answer.value = ""; els.answer.placeholder = "한자 또는 히라가나로 입력하세요"; els.feedback.textContent = ""; els.feedback.className = "feedback"; els.reveal.hidden = true; els.save.hidden = true; setEnabled(true); els.answer.focus();
}
function selectLevel(level) { state.level = level; state.seen.clear(); els.buttons.forEach((button) => button.classList.toggle("active", button.dataset.level === level)); pickWord(); }
els.buttons.forEach((button) => button.addEventListener("click", () => selectLevel(button.dataset.level)));
els.form.addEventListener("submit", async (event) => { event.preventDefault(); if (!state.current || state.revealed) return; const answer = normalise(els.answer.value); const exact = answerCandidates(state.current.word).includes(answer) || answerCandidates(state.current.reading).includes(answer); let correct = exact; if (!correct && answer) { els.feedback.textContent = "번역 서비스로 확인 중이에요..."; els.feedback.className = "feedback"; els.check.disabled = true; try { const analysis = await analyseMeaning(answer, state.current.korean); correct = analysis.correct; if (!analysis.exists) { els.feedback.textContent = "번역 서비스에서 확인되지 않는 표현이에요. 표기를 다시 확인해 주세요."; els.feedback.className = "feedback incorrect"; return; } } catch (error) { els.feedback.textContent = "번역 서비스 확인에 실패했어요. 잠시 후 다시 시도해 주세요."; els.feedback.className = "feedback incorrect"; return; } finally { els.check.disabled = false; } } state.revealed = true; displayAnswer(); if (correct) { state.score += 1; els.score.textContent = state.score; saveScoreCookie(); els.feedback.textContent = "정답이에요! 잘했어요."; els.feedback.className = "feedback correct"; els.save.hidden = true; } else { els.feedback.textContent = "정답을 확인해 보세요."; els.feedback.className = "feedback incorrect"; updateSaveButton(); } });
els.save.addEventListener("click", () => { if (!state.current) return; const saved = savedWords(); saved.add(wordKey(state.current)); saveSavedWords(saved); updateSaveButton(); });
els.hint.addEventListener("click", () => { if (!state.current) return; const chars = [...state.current.word]; els.answer.placeholder = `힌트: ${chars[0]}${"○".repeat(Math.max(0, chars.length - 1))}`; });
els.next.addEventListener("click", pickWord);
state.score = readScoreCookie();
els.score.textContent = state.score;
pickWord();
$("tutorial-start")?.addEventListener("click", closeTutorial);
$("tutorial-close")?.addEventListener("click", closeTutorial);
$("tutorial-dismiss")?.addEventListener("change", (event) => { if (event.target.checked) saveTutorialPreference(); });
openTutorial();
// 로그인한 계정에서 더 새 기록을 받으면(/shared/sync.js) 맞힌 개수와 저장 버튼을 다시 그린다
window.addEventListener("nd:synced", () => { state.score = Math.max(state.score, readScoreCookie()); els.score.textContent = state.score; if (state.current) updateSaveButton(); });

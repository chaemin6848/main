const words = window.JLPT_VOCABULARY || [];
const state = { level: "all", query: "", lesson: 0, savedLevel: "" };
const pageSize = 20;
const CHECKED_WORDS_KEY = "nihongodic_checked_words";
const SAVED_WORDS_KEY = "nihongodic_my_words";
const STORAGE_MAX_AGE = 60 * 60 * 24 * 365;
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
function readStoredSet(name) {
  let stored = null;
  try { stored = localStorage.getItem(name); } catch (error) {}
  const cookieValue = readCookie(name);
  const values = new Set([...parseStoredList(stored), ...parseStoredList(cookieValue)]);
  if (cookieValue) saveStoredSet(name, values);
  return values;
}
function saveStoredSet(name, values) {
  const value = JSON.stringify([...values]);
  try {
    localStorage.setItem(name, value);
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch (error) { document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${STORAGE_MAX_AGE}; Path=/; SameSite=Lax`; }
}
const checkedWords = readStoredSet(CHECKED_WORDS_KEY);
const savedWordKeys = readStoredSet(SAVED_WORDS_KEY);
const list = document.getElementById("vocabulary-list");
const count = document.getElementById("list-count");
const search = document.getElementById("search");
const buttons = document.querySelectorAll(".level-btn");

function wordKey(word) { return `${word.level}:${word.word}:${word.reading || ""}`; }

function displayMeaning(value = "") { return value.split(/[,，、/;；]/).map((meaning) => meaning.trim()).filter(Boolean)[0] || "뜻 정보 없음"; }
function appendExample(row, word) {
  if (!word.example) return;
  const example = document.createElement("div"); example.className = "list-example";
  const japanese = document.createElement("p"); japanese.lang = "ja"; japanese.textContent = word.example;
  const korean = document.createElement("p"); korean.textContent = word.exampleKorean || "";
  example.append(japanese, korean); row.append(example);
}
function matches(word) {
  const query = state.query.trim().toLocaleLowerCase();
  const levelMatch = state.level === "all" || (state.level === "saved" ? savedWordKeys.has(wordKey(word)) : word.level === state.level);
  return levelMatch && (!query || [word.word, word.reading, word.korean, word.english, word.example, word.exampleKorean].some((value) => (value || "").toLocaleLowerCase().includes(query)));
}
function render() {
  const filtered = words.filter(matches);
  if (state.level === "saved") { renderSavedLevels(filtered); return; }
  const savedGroups = document.getElementById("saved-level-list");
  if (savedGroups) savedGroups.remove();
  list.hidden = false;
  const lessonCount = Math.ceil(filtered.length / pageSize);
  if (state.lesson > lessonCount) state.lesson = lessonCount;
  const start = state.lesson > 0 ? (state.lesson - 1) * pageSize : 0;
  const visibleWords = state.lesson > 0 ? filtered.slice(start, start + pageSize) : [];
  count.textContent = filtered.length ? (state.lesson > 0 ? `${filtered.length.toLocaleString()}개 단어 · ${state.lesson}단원 (${start + 1}-${Math.min(start + pageSize, filtered.length)})` : `${filtered.length.toLocaleString()}개 단어 · 단원을 선택하세요`) : "0개 단어";
  renderLessons(filtered);
  list.replaceChildren();
  if (!filtered.length) { const empty = document.createElement("li"); empty.className = "empty-list"; empty.textContent = "검색 결과가 없어요."; list.append(empty); count.after(list); return; }
  visibleWords.forEach((word) => {
    const row = document.createElement("li");
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.className = "word-check"; checkbox.checked = checkedWords.has(wordKey(word)); checkbox.setAttribute("aria-label", `${word.word} 학습 완료`);
    checkbox.addEventListener("change", () => { const key = wordKey(word); if (checkbox.checked) checkedWords.add(key); else checkedWords.delete(key); saveStoredSet(CHECKED_WORDS_KEY, checkedWords); row.classList.toggle("is-checked", checkbox.checked); });
    const wordBlock = document.createElement("div"); wordBlock.className = "list-word-block";
    const text = document.createElement("div");
    const japanese = document.createElement("strong"); japanese.className = "list-word"; japanese.lang = "ja"; japanese.textContent = word.word;
    const reading = document.createElement("span"); reading.className = "list-reading"; reading.lang = "ja"; reading.textContent = word.reading || "—";
    const level = document.createElement("span"); level.className = "list-level"; level.textContent = word.level;
    text.append(japanese, reading); wordBlock.append(text, level);
    const meaning = document.createElement("span"); meaning.className = "list-meaning"; meaning.textContent = displayMeaning(word.korean);
    const english = document.createElement("small"); english.textContent = word.english || ""; meaning.append(english); row.append(checkbox, wordBlock, meaning); appendExample(row, word); row.classList.toggle("is-checked", checkbox.checked); list.append(row);
  });
}
function createWordRow(word) {
  const row = document.createElement("li");
  const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.className = "word-check"; checkbox.checked = checkedWords.has(wordKey(word)); checkbox.setAttribute("aria-label", `${word.word} 학습 완료`);
  checkbox.addEventListener("change", () => { const key = wordKey(word); if (checkbox.checked) checkedWords.add(key); else checkedWords.delete(key); saveStoredSet(CHECKED_WORDS_KEY, checkedWords); row.classList.toggle("is-checked", checkbox.checked); });
  const wordBlock = document.createElement("div"); wordBlock.className = "list-word-block";
  const text = document.createElement("div");
  const japanese = document.createElement("strong"); japanese.className = "list-word"; japanese.lang = "ja"; japanese.textContent = word.word;
  const reading = document.createElement("span"); reading.className = "list-reading"; reading.lang = "ja"; reading.textContent = word.reading || "—";
  const level = document.createElement("span"); level.className = "list-level"; level.textContent = word.level;
  text.append(japanese, reading); wordBlock.append(text, level);
  const meaning = document.createElement("span"); meaning.className = "list-meaning"; meaning.textContent = displayMeaning(word.korean);
  const english = document.createElement("small"); english.textContent = word.english || ""; meaning.append(english); row.append(checkbox, wordBlock, meaning); appendExample(row, word); row.classList.toggle("is-checked", checkbox.checked);
  return row;
}
function renderSavedLevels(filtered) {
  const lessons = document.getElementById("lesson-list");
  if (lessons) lessons.remove();
  list.hidden = true;
  let groups = document.getElementById("saved-level-list");
  if (!groups) { groups = document.createElement("div"); groups.id = "saved-level-list"; groups.className = "saved-level-list"; count.after(groups); }
  groups.replaceChildren();
  ["N5", "N4", "N3", "N2", "N1"].forEach((level) => {
    const levelWords = filtered.filter((word) => word.level === level);
    if (!levelWords.length) return;
    const section = document.createElement("section"); section.className = "saved-level-group";
    const heading = document.createElement("button"); heading.type = "button"; heading.className = "lesson-button saved-level-button"; heading.classList.toggle("active", state.savedLevel === level); heading.innerHTML = `<strong>${level}</strong><small>${levelWords.length}개 단어</small>`; heading.setAttribute("aria-expanded", state.savedLevel === level ? "true" : "false");
    heading.addEventListener("click", () => { state.savedLevel = state.savedLevel === level ? "" : level; render(); }); section.append(heading);
    if (state.savedLevel === level) { const levelList = document.createElement("ul"); levelList.className = "vocabulary-list"; levelWords.forEach((word) => levelList.append(createWordRow(word))); section.append(levelList); }
    groups.append(section);
  });
  if (!filtered.length) { const empty = document.createElement("p"); empty.className = "empty-list"; empty.textContent = "내 단어장에 저장된 단어가 없어요."; groups.append(empty); }
  count.textContent = `${filtered.length.toLocaleString()}개 단어`;
}
function renderLessons(filtered) {
  let lessons = document.getElementById("lesson-list");
  if (!lessons) { lessons = document.createElement("div"); lessons.id = "lesson-list"; lessons.className = "lesson-list"; lessons.setAttribute("aria-label", "단어 단원"); count.after(lessons); }
  lessons.replaceChildren();
  const lessonCount = Math.ceil(filtered.length / pageSize);
  for (let index = 0; index < lessonCount; index += 1) {
    const group = document.createElement("section"); group.className = "lesson-group"; group.classList.toggle("is-active", state.lesson === index + 1);
    const button = document.createElement("button"); button.type = "button"; button.className = "lesson-button"; button.classList.toggle("active", state.lesson === index + 1);
    const start = index * pageSize + 1; const end = Math.min((index + 1) * pageSize, filtered.length);
    button.innerHTML = `<strong>${index + 1}단원</strong><small>${start}-${end}</small>`;
    button.setAttribute("aria-expanded", state.lesson === index + 1 ? "true" : "false");
    button.addEventListener("click", () => { state.lesson = state.lesson === index + 1 ? 0 : index + 1; render(); }); group.append(button);
    if (state.lesson === index + 1) group.append(list);
    lessons.append(group);
  }
}
buttons.forEach((button) => button.addEventListener("click", () => { state.level = button.dataset.level; state.lesson = 0; state.savedLevel = ""; buttons.forEach((item) => item.classList.toggle("active", item === button)); render(); }));
search.addEventListener("input", () => { state.query = search.value; state.lesson = 0; state.savedLevel = ""; render(); });
const correctAnswers = Number.parseInt(readCookie("nihongodic_correct_answers"), 10);
document.getElementById("score").textContent = Number.isSafeInteger(correctAnswers) && correctAnswers >= 0 ? correctAnswers : 0;
render();
// 로그인한 계정에서 더 새 기록을 받으면(/shared/sync.js) 체크와 내 단어장을 다시 읽어 그린다
window.addEventListener("nd:synced", () => {
  for (const [set, key] of [[checkedWords, CHECKED_WORDS_KEY], [savedWordKeys, SAVED_WORDS_KEY]]) { const next = readStoredSet(key); set.clear(); next.forEach((v) => set.add(v)); }
  const n = Number.parseInt(readCookie("nihongodic_correct_answers"), 10); if (Number.isSafeInteger(n) && n >= 0) document.getElementById("score").textContent = n;
  render();
});

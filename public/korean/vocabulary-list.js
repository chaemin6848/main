/* 単語一枚 단어 사전 — 한국어 표제어 + 일본어 뜻 (/japanese/vocabulary-list.js를 뒤집은 것) */
const words = (window.JLPT_VOCABULARY || []).filter(KO.hasKorean);
const state = { level: "all", query: "", lesson: 0, savedLevel: "" };
const pageSize = 20;
const checkedWords = KO.readSet(KO.CHECKED_KEY);
const savedWordKeys = KO.readSet(KO.SAVED_KEY);
const list = document.getElementById("vocabulary-list");
const count = document.getElementById("list-count");
const search = document.getElementById("search");
const buttons = document.querySelectorAll(".level-btn");

function el(tag, props = {}, text = "") { const node = document.createElement(tag); Object.assign(node, props); if (text) node.textContent = text; return node; }
function matches(word) {
  const query = state.query.trim().toLocaleLowerCase();
  const levelMatch = state.level === "all" || (state.level === "saved" ? savedWordKeys.has(KO.wordKey(word)) : word.level === state.level);
  return levelMatch && (!query || [word.korean, word.word, word.reading, word.english].some((value) => (value || "").toLocaleLowerCase().includes(query)));
}
function createWordRow(word) {
  const row = el("li");
  const key = KO.wordKey(word);
  const korean = KO.firstMeaning(word.korean);
  const checkbox = el("input", { type: "checkbox", className: "word-check", checked: checkedWords.has(key) });
  checkbox.setAttribute("aria-label", `${korean} 学習済み`);
  checkbox.addEventListener("change", () => { if (checkbox.checked) checkedWords.add(key); else checkedWords.delete(key); KO.saveSet(KO.CHECKED_KEY, checkedWords); row.classList.toggle("is-checked", checkbox.checked); });
  const wordBlock = el("div", { className: "list-word-block" });
  const text = el("div");
  text.append(el("strong", { className: "list-word", lang: "ko" }, korean));
  const others = KO.meanings(word.korean).slice(1);
  text.append(el("span", { className: "list-reading", lang: "ko" }, others.length ? others.join(", ") : "—"));
  wordBlock.append(text, el("span", { className: "list-level" }, KO.levelName(word.level)));
  const meaning = el("span", { className: "list-meaning", lang: "ja" }, word.reading && word.reading !== word.word ? `${word.word}（${word.reading}）` : word.word);
  meaning.append(el("small", {}, word.english || ""));
  row.append(checkbox, wordBlock, meaning);
  row.classList.toggle("is-checked", checkbox.checked);
  return row;
}
function render() {
  const filtered = words.filter(matches);
  if (state.level === "saved") { renderSavedLevels(filtered); return; }
  document.getElementById("saved-level-list")?.remove();
  list.hidden = false;
  const lessonCount = Math.ceil(filtered.length / pageSize);
  if (state.lesson > lessonCount) state.lesson = lessonCount;
  const start = state.lesson > 0 ? (state.lesson - 1) * pageSize : 0;
  const visibleWords = state.lesson > 0 ? filtered.slice(start, start + pageSize) : [];
  count.textContent = filtered.length ? (state.lesson > 0 ? `${filtered.length.toLocaleString()}語 · 第${state.lesson}課（${start + 1}-${Math.min(start + pageSize, filtered.length)}）` : `${filtered.length.toLocaleString()}語 · 課を選んでください`) : "0語";
  renderLessons(filtered);
  list.replaceChildren();
  if (!filtered.length) { list.append(el("li", { className: "empty-list" }, "検索結果がありません。")); count.after(list); return; }
  visibleWords.forEach((word) => list.append(createWordRow(word)));
}
function renderSavedLevels(filtered) {
  document.getElementById("lesson-list")?.remove();
  list.hidden = true;
  let groups = document.getElementById("saved-level-list");
  if (!groups) { groups = el("div", { id: "saved-level-list", className: "saved-level-list" }); count.after(groups); }
  groups.replaceChildren();
  KO.LEVELS.forEach((level) => {
    const levelWords = filtered.filter((word) => word.level === level);
    if (!levelWords.length) return;
    const section = el("section", { className: "saved-level-group" });
    const heading = el("button", { type: "button", className: "lesson-button saved-level-button" });
    heading.classList.toggle("active", state.savedLevel === level);
    heading.append(el("strong", {}, KO.levelName(level)), el("small", {}, `${levelWords.length}語`));
    heading.setAttribute("aria-expanded", state.savedLevel === level ? "true" : "false");
    heading.addEventListener("click", () => { state.savedLevel = state.savedLevel === level ? "" : level; render(); });
    section.append(heading);
    if (state.savedLevel === level) { const levelList = el("ul", { className: "vocabulary-list" }); levelWords.forEach((word) => levelList.append(createWordRow(word))); section.append(levelList); }
    groups.append(section);
  });
  if (!filtered.length) groups.append(el("p", { className: "empty-list" }, "マイ単語帳に保存された単語はありません。クイズで間違えた単語を追加できます。"));
  count.textContent = `${filtered.length.toLocaleString()}語`;
}
function renderLessons(filtered) {
  let lessons = document.getElementById("lesson-list");
  if (!lessons) { lessons = el("div", { id: "lesson-list", className: "lesson-list" }); lessons.setAttribute("aria-label", "単語の課"); count.after(lessons); }
  lessons.replaceChildren();
  const lessonCount = Math.ceil(filtered.length / pageSize);
  for (let index = 0; index < lessonCount; index += 1) {
    const group = el("section", { className: "lesson-group" });
    group.classList.toggle("is-active", state.lesson === index + 1);
    const button = el("button", { type: "button", className: "lesson-button" });
    button.classList.toggle("active", state.lesson === index + 1);
    button.append(el("strong", {}, `第${index + 1}課`), el("small", {}, `${index * pageSize + 1}-${Math.min((index + 1) * pageSize, filtered.length)}`));
    button.setAttribute("aria-expanded", state.lesson === index + 1 ? "true" : "false");
    button.addEventListener("click", () => { state.lesson = state.lesson === index + 1 ? 0 : index + 1; render(); });
    group.append(button);
    if (state.lesson === index + 1) group.append(list);
    lessons.append(group);
  }
}
buttons.forEach((button) => button.addEventListener("click", () => { state.level = button.dataset.level; state.lesson = 0; state.savedLevel = ""; buttons.forEach((item) => item.classList.toggle("active", item === button)); render(); }));
search.addEventListener("input", () => { state.query = search.value; state.lesson = 0; state.savedLevel = ""; render(); });
document.getElementById("score").textContent = KO.readScore();
render();

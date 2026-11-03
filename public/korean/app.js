/* 단어 한 장 일본어판 — 일본어 단어를 보고 한국어로 답하는 퀴즈 (/japanese/app.js의 방향을 뒤집은 것) */
const state = { words: (window.JLPT_VOCABULARY || []).filter(KO.hasKorean), level: "N5", current: null, seen: new Set(), score: 0, revealed: false };
const $ = (id) => document.getElementById(id);
const els = { buttons: document.querySelectorAll(".level-btn"), badge: $("level-badge"), count: $("word-count"), word: $("meaning"), reading: $("reading"), gloss: $("english-gloss"), form: $("answer-form"), answer: $("answer"), check: $("check-button"), feedback: $("feedback"), reveal: $("answer-reveal"), save: $("save-word-button"), hint: $("hint-button"), next: $("next-button"), score: $("score") };

/* ---------- 정답 판정 ---------- */
// 활용 어미를 떼어 어간끼리 비교한다: 밟다 / 밟아요 / 밟습니다 → 밟, 공부하다 / 공부해요 / 공부 → 공부
const ENDINGS = /(습니다|ㅂ니다|입니다|이에요|예요|이다|어요|아요|해요|해|하다|합니다|한다|요|다)$/;
function forms(value) {
  const full = KO.bare(value);
  const out = new Set([full]);
  const stem = full.replace(ENDINGS, "");
  if (stem && stem !== full) out.add(stem);
  return out;
}
function exactMatch(answer, word) {
  const given = forms(answer);
  return KO.meanings(word.korean).some((meaning) => [...forms(meaning)].some((form) => given.has(form)));
}
// 일본어 쪽 정답 후보: 표제어와 읽기 (～, 괄호 제외)
function japaneseForms(word) {
  return [word.word, word.reading].flatMap((value) => (value || "").split(/[,，、/;；]/))
    .map((value) => value.normalize("NFKC").replace(/\([^)]*\)/g, "").replace(/[~～〜]/g, "").trim())
    .filter((value) => value && (/[一-龯々]/.test(value) || value.length >= 2));
}
// 사전 뜻과 표기가 다를 때: 입력한 한국어를 일본어로 번역해 문제 단어가 나오면 정답으로 인정한다
async function analyseMeaning(answer, word) {
  if (!/[가-힣]/.test(answer)) return { exists: false, correct: false };
  const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(answer)}&langpair=ko|ja`);
  if (!response.ok) throw new Error("Translation request failed");
  const data = await response.json();
  const translated = (data.responseData?.translatedText || "").normalize("NFKC");
  const exists = Boolean(translated && data.responseStatus === 200 && !/[가-힣]/.test(translated));
  return { exists, correct: exists && japaneseForms(word).some((form) => translated.includes(form)) };
}

/* ---------- 화면 ---------- */
function pool() { return state.words.filter((word) => word.level === state.level); }
function setEnabled(enabled) { [els.answer, els.check, els.hint, els.next].forEach((item) => { item.disabled = !enabled; }); }
function el(tag, props = {}, text = "") { const node = document.createElement(tag); Object.assign(node, props); if (text) node.textContent = text; return node; }
function displayAnswer() {
  const word = state.current; if (!word) return;
  els.reveal.replaceChildren();
  const answer = el("div");
  answer.append(el("span", { className: "reveal-label" }, "正解"), el("strong", { lang: "ko", id: "japanese-word" }, KO.firstMeaning(word.korean)));
  const others = KO.meanings(word.korean).slice(1);
  if (others.length) answer.append(el("span", { className: "other-meanings", lang: "ko" }, `ほかに · ${others.join(", ")}`));
  els.reveal.append(answer);
  if (word.example && word.exampleKorean) {
    const example = el("div", { className: "example" });
    example.append(el("span", { className: "reveal-label" }, "例文"), el("p", { lang: "ko" }, word.exampleKorean), el("p", { lang: "ja" }, word.example));
    els.reveal.append(example);
  }
  els.reveal.hidden = false;
}
function updateSaveButton() {
  const saved = KO.readSet(KO.SAVED_KEY).has(KO.wordKey(state.current));
  els.save.hidden = false; els.save.disabled = saved; els.save.textContent = saved ? "マイ単語帳に追加済み" : "マイ単語帳に追加";
}
function feedback(text, kind = "") { els.feedback.textContent = text; els.feedback.className = `feedback ${kind}`.trim(); }
function pickWord() {
  const choices = pool();
  els.badge.textContent = KO.levelName(state.level);
  els.count.textContent = choices.length ? `${choices.length.toLocaleString()}語からランダム` : "単語データなし";
  if (!choices.length) {
    state.current = null; els.word.textContent = "このレベルの単語が見つかりません。"; els.reading.textContent = ""; els.gloss.textContent = "";
    els.reveal.hidden = true; els.save.hidden = true; feedback(""); setEnabled(false); return;
  }
  let candidates = choices.filter((word) => !state.seen.has(KO.wordKey(word)));
  if (!candidates.length) { state.seen.clear(); candidates = choices; }
  const word = candidates[Math.floor(Math.random() * candidates.length)];
  state.current = word; state.seen.add(KO.wordKey(word)); state.revealed = false;
  els.word.textContent = word.word;
  els.reading.textContent = word.reading && word.reading !== word.word ? word.reading : "";
  els.gloss.textContent = word.english ? `EN · ${word.english}` : "";
  els.answer.value = ""; els.answer.placeholder = "ハングルで入力してください";
  feedback(""); els.reveal.hidden = true; els.save.hidden = true; setEnabled(true); els.answer.focus();
}
function selectLevel(level) { state.level = level; state.seen.clear(); els.buttons.forEach((button) => button.classList.toggle("active", button.dataset.level === level)); pickWord(); }

els.buttons.forEach((button) => button.addEventListener("click", () => selectLevel(button.dataset.level)));
els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.current || state.revealed) return;
  const answer = els.answer.value.trim();
  if (!answer) { feedback("ハングルで答えを入力してください。", "incorrect"); return; }
  let correct = exactMatch(answer, state.current);
  if (!correct) {
    if (!/[가-힣]/.test(answer)) { feedback("ハングルで入力してください。韓国語キーボードを追加すると入力できます。", "incorrect"); return; }
    feedback("翻訳サービスで確認しています…"); els.check.disabled = true;
    try {
      const analysis = await analyseMeaning(answer, state.current);
      if (!analysis.exists) { feedback("翻訳サービスで確認できない表現です。つづりをもう一度確認してください。", "incorrect"); return; }
      correct = analysis.correct;
    } catch (error) { feedback("翻訳サービスに接続できませんでした。しばらくしてからもう一度お試しください。", "incorrect"); return; }
    finally { els.check.disabled = false; }
  }
  state.revealed = true; displayAnswer();
  if (correct) {
    state.score += 1; els.score.textContent = state.score; KO.set(KO.SCORE_KEY, String(state.score));
    feedback("正解です！ よくできました。", "correct"); els.save.hidden = true;
  } else { feedback("正解を確認してみましょう。", "incorrect"); updateSaveButton(); }
});
els.save.addEventListener("click", () => { if (!state.current) return; const saved = KO.readSet(KO.SAVED_KEY); saved.add(KO.wordKey(state.current)); KO.saveSet(KO.SAVED_KEY, saved); updateSaveButton(); });
els.hint.addEventListener("click", () => {
  if (!state.current) return;
  const chars = [...KO.firstMeaning(state.current.korean).replace(/[~～]/g, "")];
  els.answer.placeholder = `ヒント：${chars[0]}${chars.slice(1).map((c) => (c === " " ? " " : "○")).join("")}`;
});
els.next.addEventListener("click", pickWord);

/* ---------- 튜토리얼 ---------- */
const dialog = $("tutorial-dialog");
function closeTutorial() { if ($("tutorial-dismiss").checked) KO.set(KO.TUTORIAL_KEY, "1"); dialog.close(); }
$("tutorial-start").addEventListener("click", closeTutorial);
$("tutorial-close").addEventListener("click", closeTutorial);
$("tutorial-dismiss").addEventListener("change", (event) => { if (event.target.checked) KO.set(KO.TUTORIAL_KEY, "1"); });

state.score = KO.readScore();
els.score.textContent = state.score;
pickWord();
if (dialog && !KO.get(KO.TUTORIAL_KEY)) { dialog.showModal(); $("tutorial-start").focus(); }

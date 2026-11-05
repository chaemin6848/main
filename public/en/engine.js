/* Wordcard — 영어 화자용 단어 퀴즈·사전 공통 엔진 (/en/japanese, /en/korean).
   단어 한 장(/japanese)·単語一枚(/korean)과 같은 방식: 뜻을 보고 답을 입력한다. 여기서는 영어 뜻을 보고 일본어 또는 한국어로 답한다.
   페이지가 먼저 window.WORDCARD = { target: "ja" | "ko", page: "quiz" | "list" } 를 정한다.
   단어 데이터는 /japanese/vocabulary.js(JLPT 단어 + 한국어·영어 뜻)를 그대로 쓴다. */
(function () {
  const CFG = window.WORDCARD || {};
  const JA = CFG.target === "ja";
  const PREFIX = JA ? "nihongodic_enja_" : "nihongodic_enko_";
  const KEYS = { score: PREFIX + "correct_answers", saved: PREFIX + "my_words", checked: PREFIX + "checked_words", tutorial: PREFIX + "tutorial_hidden" };
  const MAX_AGE = 60 * 60 * 24 * 365;
  const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
  // 일본어는 영어권 학습자에게도 익숙한 JLPT 이름 그대로, 한국어는 JLPT가 한국어 난이도가 아니므로 Lv.1~5
  const levelName = (level) => (JA ? `JLPT ${level}` : `Lv.${LEVELS.indexOf(level) + 1}`);
  const shortLevel = (level) => (JA ? level : `Lv.${LEVELS.indexOf(level) + 1}`);

  /* ---------- 저장 ---------- */
  function readCookie(name) { return document.cookie.split("; ").find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || ""; }
  function get(name) { try { return localStorage.getItem(name); } catch (error) { const c = readCookie(name); return c ? decodeURIComponent(c) : null; } }
  function set(name, value) {
    try { localStorage.setItem(name, value); }
    catch (error) { document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax`; }
  }
  function readSet(name) { try { const list = JSON.parse(get(name) || "[]"); return new Set(Array.isArray(list) ? list : []); } catch (error) { return new Set(); } }
  function saveSet(name, values) { set(name, JSON.stringify([...values])); }
  function readScore() { const n = Number.parseInt(get(KEYS.score), 10); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
  const wordKey = (word) => `${word.level}:${word.word}:${word.reading || ""}`;

  /* ---------- 뜻 다루기 ---------- */
  const split = (value = "") => value.split(/[,，、/;；]/).map((m) => m.trim()).filter(Boolean);
  const koMeanings = (value = "") => split(value).filter((m) => /[가-힣]/.test(m));
  const koFirst = (value = "") => koMeanings(value)[0] || value.trim();
  const hasKorean = (word) => typeof word.korean === "string" && /[가-힣]/.test(word.korean);
  const hasEnglish = (word) => typeof word.english === "string" && /[A-Za-z]/.test(word.english);

  // 영어 뜻 비교용: 소문자, 괄호 설명·앞의 to/a/the·끝 문장부호를 뗀다 ("to cool (down)" → "cool")
  function enForms(value = "") {
    return split(value.toLowerCase().replace(/\([^)]*\)/g, "")).map((m) => m.replace(/^(to|a|an|the)\s+/, "").replace(/[.!?~"']/g, "").replace(/\s+/g, " ").trim()).filter((m) => m.length >= 2);
  }
  function englishMatches(translated, english) {
    const given = enForms(translated);
    const want = enForms(english);
    return given.some((g) => want.some((w) => g === w || (w.length >= 3 && new RegExp(`(^|\\W)${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`).test(g))));
  }

  /* ---------- 일본어 답: 가나·한자, 또는 로마자 ---------- */
  const H2R = { "あ":"a","い":"i","う":"u","え":"e","お":"o","か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko","が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go",
    "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so","ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo","た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
    "だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do","な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no","は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
    "ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo","ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po","ま":"ma","み":"mi","む":"mu","め":"me","も":"mo",
    "や":"ya","ゆ":"yu","よ":"yo","ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro","わ":"wa","ゐ":"i","ゑ":"e","を":"o","ん":"n","ゔ":"vu",
    "ぁ":"a","ぃ":"i","ぅ":"u","ぇ":"e","ぉ":"o","ゃ":"ya","ゅ":"yu","ょ":"yo","ゎ":"wa" };
  const YOON = { "ゃ":"a","ゅ":"u","ょ":"o" };
  const toHira = (s = "") => s.normalize("NFKC").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  function toRomaji(kana = "") {
    const s = toHira(kana);
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i], next = s[i + 1];
      if (c === "っ") { const r = H2R[next] || ""; out += r.startsWith("ch") ? "t" : r[0] || ""; continue; }
      if (c === "ー") { const v = out.match(/[aeiou]$/); out += v ? v[0] : ""; continue; }
      if (next && YOON[next] && H2R[c] && /i$/.test(H2R[c])) {
        const base = H2R[c];
        out += /^(shi|chi|ji)$/.test(base) ? base.slice(0, -1) + YOON[next] : base.slice(0, -1) + "y" + YOON[next];
        i++; continue;
      }
      out += H2R[c] != null ? H2R[c] : c;
    }
    return out;
  }
  // 훈령식·헵번식, 장음 표기(ou, ō), ん(nn, n') 차이를 한 형태로 맞춘다
  function romajiKey(value = "") {
    return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[\s\-'’.~]/g, "")
      .replace(/sy([auo])/g, "sh$1").replace(/(ty|cy)([auo])/g, "ch$2").replace(/(zy|jy|dy)([auo])/g, "j$2")
      .replace(/si/g, "shi").replace(/ti/g, "chi").replace(/tu/g, "tsu").replace(/(?<![sc])hu/g, "fu").replace(/zi|di/g, "ji").replace(/du/g, "zu")
      .replace(/wo/g, "o").replace(/tch/g, "cch").replace(/nn/g, "n").replace(/m(?=[bpm])/g, "n")
      .replace(/ou|oo/g, "o").replace(/uu/g, "u").replace(/aa/g, "a").replace(/ii/g, "i").replace(/ee/g, "e");
  }
  const jaNorm = (value = "") => value.normalize("NFKC").trim().replace(/\s/g, "");
  function jaCandidates(value = "") {
    return [...new Set(split(value).flatMap((c) => { const f = jaNorm(c); return [f, f.replace(/[~～〜()（）]/g, ""), f.replace(/[(（][^)）]*[)）]/g, "").replace(/[~～〜]/g, "")]; }))].filter(Boolean);
  }
  function jaExact(answer, word) {
    const a = jaNorm(answer);
    if (!a) return false;
    if (/^[\x20-\x7eÀ-ſ]+$/.test(answer.trim())) {
      // 로마자로 답한 경우: 읽기를 로마자로 바꿔 비교
      const key = romajiKey(a);
      // 끝의 は는 조사처럼 wa로도 읽는다 (こんにちは → konnichiwa)
      return jaCandidates(word.reading || word.word).some((r) => /[ぁ-ゖァ-ヺ]/.test(r) && [toRomaji(r), toRomaji(r).replace(/ha$/, "wa")].some((x) => romajiKey(x) === key));
    }
    const ah = toHira(a);
    return jaCandidates(word.word).includes(a) || jaCandidates(word.reading).some((r) => toHira(r) === ah) || jaCandidates(word.word).some((w) => toHira(w) === ah);
  }

  /* ---------- 한국어 답: 활용 어미를 떼고 어간 비교 ---------- */
  const KO_END = /(습니다|ㅂ니다|입니다|이에요|예요|이다|어요|아요|해요|해|하다|합니다|한다|요|다)$/;
  const koBare = (value = "") => value.normalize("NFKC").replace(/\([^)]*\)/g, "").replace(/[~～〜.!?。·]/g, "").replace(/\s/g, "");
  function koForms(value) { const full = koBare(value); const out = new Set([full]); const stem = full.replace(KO_END, ""); if (stem && stem !== full) out.add(stem); return out; }
  function koExact(answer, word) { const given = koForms(answer); return koMeanings(word.korean).some((m) => [...koForms(m)].some((f) => given.has(f))); }

  // 사전과 표기가 달라도 뜻이 같으면 정답: 답을 영어로 번역해 문제의 영어 뜻과 비교한다
  async function translateCheck(answer, word) {
    const pair = JA ? "ja|en" : "ko|en";
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(answer)}&langpair=${pair}`);
    if (!response.ok) throw new Error("Translation request failed");
    const data = await response.json();
    const translated = (data.responseData?.translatedText || "").trim();
    const exists = Boolean(translated && data.responseStatus === 200 && /[A-Za-z]/.test(translated) && translated.toLowerCase() !== answer.toLowerCase());
    return { exists, correct: exists && englishMatches(translated, word.english) };
  }

  const words = (window.JLPT_VOCABULARY || []).filter((w) => hasEnglish(w) && (JA || hasKorean(w)));
  const $ = (id) => document.getElementById(id);
  function el(tag, props = {}, text = "") { const node = document.createElement(tag); Object.assign(node, props); if (text) node.textContent = text; return node; }

  /* ====================== 퀴즈 ====================== */
  function quiz() {
    const state = { level: "N5", current: null, seen: new Set(), score: readScore(), revealed: false };
    const els = { buttons: document.querySelectorAll(".level-btn"), badge: $("level-badge"), count: $("word-count"), prompt: $("meaning"), form: $("answer-form"), answer: $("answer"), check: $("check-button"), feedback: $("feedback"), reveal: $("answer-reveal"), save: $("save-word-button"), hint: $("hint-button"), next: $("next-button"), score: $("score") };
    const PLACEHOLDER = JA ? "Type in kana, kanji or romaji" : "Type in Hangul";
    const pool = () => words.filter((w) => w.level === state.level);
    const setEnabled = (on) => [els.answer, els.check, els.hint, els.next].forEach((b) => { b.disabled = !on; });
    const feedback = (text, kind = "") => { els.feedback.textContent = text; els.feedback.className = `feedback ${kind}`.trim(); };

    function displayAnswer() {
      const w = state.current; els.reveal.replaceChildren();
      const box = el("div");
      box.append(el("span", { className: "reveal-label" }, "Answer"));
      if (JA) {
        box.append(el("strong", { lang: "ja", id: "japanese-word" }, w.word));
        const reading = w.reading && w.reading !== w.word ? w.reading : "";
        box.append(el("span", { className: "other-meanings", lang: "ja" }, [reading, toRomaji(w.reading || w.word)].filter(Boolean).join(" · ")));
      } else {
        box.append(el("strong", { lang: "ko", id: "japanese-word" }, koFirst(w.korean)));
        const others = koMeanings(w.korean).slice(1);
        if (others.length) box.append(el("span", { className: "other-meanings", lang: "ko" }, `Also · ${others.join(", ")}`));
      }
      els.reveal.append(box);
      if (JA && w.example) {
        const ex = el("div", { className: "example" });
        ex.append(el("span", { className: "reveal-label" }, "Example"), el("p", { lang: "ja" }, w.example));
        els.reveal.append(ex);
      }
      els.reveal.hidden = false;
    }
    function updateSave() { const saved = readSet(KEYS.saved).has(wordKey(state.current)); els.save.hidden = false; els.save.disabled = saved; els.save.textContent = saved ? "Saved to My words" : "Save to My words"; }
    function pick() {
      const choices = pool();
      els.badge.textContent = levelName(state.level);
      els.count.textContent = choices.length ? `Random from ${choices.length.toLocaleString("en")} words` : "No words";
      if (!choices.length) { state.current = null; els.prompt.textContent = "No words at this level yet."; setEnabled(false); return; }
      let candidates = choices.filter((w) => !state.seen.has(wordKey(w)));
      if (!candidates.length) { state.seen.clear(); candidates = choices; }
      const w = candidates[Math.floor(Math.random() * candidates.length)];
      state.current = w; state.seen.add(wordKey(w)); state.revealed = false;
      els.prompt.textContent = w.english;
      els.answer.value = ""; els.answer.placeholder = PLACEHOLDER;
      feedback(""); els.reveal.hidden = true; els.save.hidden = true; setEnabled(true); els.answer.focus();
    }
    els.buttons.forEach((b) => b.addEventListener("click", () => { state.level = b.dataset.level; state.seen.clear(); els.buttons.forEach((x) => x.classList.toggle("active", x === b)); pick(); }));
    els.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.current || state.revealed) return;
      const answer = els.answer.value.trim();
      if (!answer) { feedback(JA ? "Type your answer in Japanese or romaji." : "Type your answer in Hangul.", "incorrect"); return; }
      let correct = JA ? jaExact(answer, state.current) : koExact(answer, state.current);
      const native = JA ? /[ぁ-ゖァ-ヺ一-龯々]/.test(answer) : /[가-힣]/.test(answer);
      if (!correct && !native && !JA) { feedback("Please type in Hangul. Add a Korean keyboard on your device to type it.", "incorrect"); return; }
      if (!correct && native) {
        feedback("Checking with a translation service…"); els.check.disabled = true;
        try {
          const r = await translateCheck(answer, state.current);
          if (!r.exists) { feedback("The translation service doesn't recognise that. Check the spelling and try again.", "incorrect"); return; }
          correct = r.correct;
        } catch (error) { feedback("Couldn't reach the translation service. Please try again in a moment.", "incorrect"); return; }
        finally { els.check.disabled = false; }
      }
      state.revealed = true; displayAnswer();
      if (correct) { state.score += 1; els.score.textContent = state.score; set(KEYS.score, String(state.score)); feedback("Correct! Nice work.", "correct"); els.save.hidden = true; }
      else { feedback("Here's the answer — give it another look.", "incorrect"); updateSave(); }
    });
    els.save.addEventListener("click", () => { if (!state.current) return; const s = readSet(KEYS.saved); s.add(wordKey(state.current)); saveSet(KEYS.saved, s); updateSave(); });
    els.hint.addEventListener("click", () => {
      const w = state.current; if (!w) return;
      if (JA) {
        const chars = [...w.word];
        const r = toRomaji(w.reading || w.word);
        els.answer.placeholder = `Hint: ${chars[0]}${"○".repeat(Math.max(0, chars.length - 1))} · ${r.slice(0, 2)}…`;
      } else {
        const chars = [...koFirst(w.korean).replace(/[~～]/g, "")];
        els.answer.placeholder = `Hint: ${chars[0]}${chars.slice(1).map((c) => (c === " " ? " " : "○")).join("")}`;
      }
    });
    els.next.addEventListener("click", pick);
    const dialog = $("tutorial-dialog");
    const close = () => { if ($("tutorial-dismiss").checked) set(KEYS.tutorial, "1"); dialog.close(); };
    $("tutorial-start").addEventListener("click", close);
    $("tutorial-close").addEventListener("click", close);
    $("tutorial-dismiss").addEventListener("change", (e) => { if (e.target.checked) set(KEYS.tutorial, "1"); });
    els.score.textContent = state.score;
    // 로그인한 계정에서 더 새 기록을 받으면(/shared/sync.js) 맞힌 개수와 저장 버튼을 다시 그린다
    window.addEventListener("nd:synced", () => { state.score = Math.max(state.score, readScore()); els.score.textContent = state.score; if (state.current) updateSave(); });
    pick();
    if (dialog && !get(KEYS.tutorial)) { dialog.showModal(); $("tutorial-start").focus(); }
  }

  /* ====================== 단어 사전 ====================== */
  function list() {
    const state = { level: "all", query: "", lesson: 0, savedLevel: "" };
    const pageSize = 20;
    const checked = readSet(KEYS.checked), saved = readSet(KEYS.saved);
    const listEl = $("vocabulary-list"), count = $("list-count"), search = $("search"), buttons = document.querySelectorAll(".level-btn");
    function matches(w) {
      const q = state.query.trim().toLocaleLowerCase();
      const lv = state.level === "all" || (state.level === "saved" ? saved.has(wordKey(w)) : w.level === state.level);
      const fields = JA ? [w.word, w.reading, w.english, toRomaji(w.reading || "")] : [w.korean, w.english];
      return lv && (!q || fields.some((v) => (v || "").toLocaleLowerCase().includes(q)));
    }
    function row(w) {
      const li = el("li"), key = wordKey(w);
      const head = JA ? w.word : koFirst(w.korean);
      const box = el("input", { type: "checkbox", className: "word-check", checked: checked.has(key) });
      box.setAttribute("aria-label", `Mark ${head} as learned`);
      box.addEventListener("change", () => { if (box.checked) checked.add(key); else checked.delete(key); saveSet(KEYS.checked, checked); li.classList.toggle("is-checked", box.checked); });
      const block = el("div", { className: "list-word-block" }), text = el("div");
      text.append(el("strong", { className: "list-word", lang: CFG.target }, head));
      if (JA) text.append(el("span", { className: "list-reading", lang: "ja" }, [w.reading && w.reading !== w.word ? w.reading : "", toRomaji(w.reading || w.word)].filter(Boolean).join(" · ")));
      else { const others = koMeanings(w.korean).slice(1); text.append(el("span", { className: "list-reading", lang: "ko" }, others.length ? others.join(", ") : "—")); }
      block.append(text, el("span", { className: "list-level" }, shortLevel(w.level)));
      li.append(box, block, el("span", { className: "list-meaning", lang: "en" }, w.english));
      if (JA && w.example) { const ex = el("div", { className: "list-example" }); ex.append(el("p", { lang: "ja" }, w.example)); li.append(ex); }
      li.classList.toggle("is-checked", box.checked);
      return li;
    }
    function render() {
      const filtered = words.filter(matches);
      if (state.level === "saved") { renderSaved(filtered); return; }
      $("saved-level-list")?.remove();
      listEl.hidden = false;
      const lessons = Math.ceil(filtered.length / pageSize);
      if (state.lesson > lessons) state.lesson = lessons;
      const start = state.lesson > 0 ? (state.lesson - 1) * pageSize : 0;
      count.textContent = filtered.length ? (state.lesson > 0 ? `${filtered.length.toLocaleString("en")} words · Lesson ${state.lesson} (${start + 1}–${Math.min(start + pageSize, filtered.length)})` : `${filtered.length.toLocaleString("en")} words · pick a lesson`) : "0 words";
      renderLessons(filtered);
      listEl.replaceChildren();
      if (!filtered.length) { listEl.append(el("li", { className: "empty-list" }, "No matches.")); count.after(listEl); return; }
      (state.lesson > 0 ? filtered.slice(start, start + pageSize) : []).forEach((w) => listEl.append(row(w)));
    }
    function renderSaved(filtered) {
      $("lesson-list")?.remove();
      listEl.hidden = true;
      let groups = $("saved-level-list");
      if (!groups) { groups = el("div", { id: "saved-level-list", className: "saved-level-list" }); count.after(groups); }
      groups.replaceChildren();
      LEVELS.forEach((level) => {
        const lw = filtered.filter((w) => w.level === level);
        if (!lw.length) return;
        const section = el("section", { className: "saved-level-group" });
        const head = el("button", { type: "button", className: "lesson-button saved-level-button" });
        head.classList.toggle("active", state.savedLevel === level);
        head.append(el("strong", {}, shortLevel(level)), el("small", {}, `${lw.length} words`));
        head.setAttribute("aria-expanded", state.savedLevel === level ? "true" : "false");
        head.addEventListener("click", () => { state.savedLevel = state.savedLevel === level ? "" : level; render(); });
        section.append(head);
        if (state.savedLevel === level) { const ul = el("ul", { className: "vocabulary-list" }); lw.forEach((w) => ul.append(row(w))); section.append(ul); }
        groups.append(section);
      });
      if (!filtered.length) groups.append(el("p", { className: "empty-list" }, "No saved words yet. Save words you miss in the quiz."));
      count.textContent = `${filtered.length.toLocaleString("en")} words`;
    }
    function renderLessons(filtered) {
      let lessons = $("lesson-list");
      if (!lessons) { lessons = el("div", { id: "lesson-list", className: "lesson-list" }); lessons.setAttribute("aria-label", "Lessons"); count.after(lessons); }
      lessons.replaceChildren();
      const n = Math.ceil(filtered.length / pageSize);
      for (let i = 0; i < n; i++) {
        const group = el("section", { className: "lesson-group" });
        group.classList.toggle("is-active", state.lesson === i + 1);
        const b = el("button", { type: "button", className: "lesson-button" });
        b.classList.toggle("active", state.lesson === i + 1);
        b.append(el("strong", {}, `Lesson ${i + 1}`), el("small", {}, `${i * pageSize + 1}–${Math.min((i + 1) * pageSize, filtered.length)}`));
        b.setAttribute("aria-expanded", state.lesson === i + 1 ? "true" : "false");
        b.addEventListener("click", () => { state.lesson = state.lesson === i + 1 ? 0 : i + 1; render(); });
        group.append(b);
        if (state.lesson === i + 1) group.append(listEl);
        lessons.append(group);
      }
    }
    buttons.forEach((b) => b.addEventListener("click", () => { state.level = b.dataset.level; state.lesson = 0; state.savedLevel = ""; buttons.forEach((x) => x.classList.toggle("active", x === b)); render(); }));
    search.addEventListener("input", () => { state.query = search.value; state.lesson = 0; state.savedLevel = ""; render(); });
    $("score").textContent = readScore();
    // 로그인한 계정에서 더 새 기록을 받으면(/shared/sync.js) 체크와 My words를 다시 읽어 그린다
    window.addEventListener("nd:synced", () => {
      for (const [s, k] of [[checked, KEYS.checked], [saved, KEYS.saved]]) { const next = readSet(k); s.clear(); next.forEach((v) => s.add(v)); }
      $("score").textContent = readScore(); render();
    });
    render();
  }

  window.Wordcard = { toRomaji, romajiKey, jaExact, koExact, englishMatches };
  if (CFG.page === "quiz") quiz(); else if (CFG.page === "list") list();
})();

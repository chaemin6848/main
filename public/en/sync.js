// Wordcard (/en/japanese, /en/korean): 로그인하면 My words·완료 체크·맞힌 개수·튜토리얼 숨김을 계정에 저장해 기기 사이에 맞춘다 (/shared/sync.js).
import { syncTool } from "/shared/sync.js";
const JA = (window.WORDCARD || {}).target === "ja";
const P = JA ? "nihongodic_enja_" : "nihongodic_enko_";
syncTool(JA ? "wordcardEnJa" : "wordcardEnKo", [
  { name: "saved", type: "set", local: P + "my_words" },
  { name: "checked", type: "set", local: P + "checked_words" },
  { name: "score", type: "max", local: P + "correct_answers" },
  { name: "tutorial", type: "flag", local: P + "tutorial_hidden" },
]);

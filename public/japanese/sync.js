// 단어 한 장: 로그인하면 내 단어장·학습 완료 체크·맞힌 개수·튜토리얼 숨김을 계정에 저장해 기기 사이에 맞춘다.
// 퀴즈(index.html)와 단어 목록(vocabulary-list.html)이 같은 칸을 함께 쓴다. 동작은 /shared/sync.js 참고.
import { syncTool } from "/shared/sync.js";
syncTool("wordcard", [
  { name: "saved", type: "set", local: "nihongodic_my_words" },
  { name: "checked", type: "set", local: "nihongodic_checked_words" },
  { name: "score", type: "max", cookie: "nihongodic_correct_answers" },
  { name: "tutorial", type: "flag", local: "nihongodic_tutorial_hidden" },
]);

// 単語一枚: 로그인하면 マイ単語帳·学習済みチェック·正解数·チュートリアル非表示를 계정에 저장해 기기 사이에 맞춘다 (/shared/sync.js).
import { syncTool } from "/shared/sync.js";
syncTool("wordcardKo", [
  { name: "saved", type: "set", local: "nihongodic_ko_my_words" },
  { name: "checked", type: "set", local: "nihongodic_ko_checked_words" },
  { name: "score", type: "max", local: "nihongodic_ko_correct_answers" },
  { name: "tutorial", type: "flag", local: "nihongodic_ko_tutorial_hidden" },
]);

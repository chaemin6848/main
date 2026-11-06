/* 일유알리미 영어 번역 (한국어·영어만 지원).
   문장은 원문 그대로 키로 찾고, 일정 칸처럼 날짜와 짧은 낱말이 섞인 글은 아래 낱말 사전으로 낱말마다 바꾼다. */
(function () {
  var EN = {
    /* head */
    "개인정보처리방침": "Privacy policy",
    "일유알리미 | 2027년 4월 입학 일본 대학 유학생전형 일정": "Japan Admissions Tracker | April 2027 international student admission dates",
    "구제국대학, 소케이, MARCH, 칸칸도리츠 등 일본 대학 사비유학생전형의 출원·면접·합격발표 일정을 정리했습니다. 지망 학부만 골라 캘린더로 볼 수 있어요.": "Application, interview and result dates for privately financed international student admissions at Japan's former imperial universities, Waseda/Keio, MARCH, Kan-Kan-Do-Ritsu and more. Pick your target faculties and view them on a calendar.",
    "일유알리미 | 일본 대학 유학생전형 일정": "Japan Admissions Tracker | International student admission dates",
    "2027년 4월 입학 일본 대학 사비유학생전형 출원·면접·합격발표 일정표와 캘린더": "Schedule and calendar of applications, interviews and results for April 2027 entry to Japanese universities",
    /* header */
    "일유알리미": "Japan Admissions Tracker",
    "2027년 4월 입학 일본 대학 유학생전형 일정. 구제국 · 소케이 · 조리ICU · MARCH · 칸칸도리츠의 私費外国人留学生入試 일정입니다. ☆로 지망 대학·학부를 고르면 캘린더에 그 일정만 표시됩니다. 학부별 일정이 다른 대학은 이름을 누르면 펼쳐집니다.":
      "Admission dates for April 2027 entry. Covers the 私費外国人留学生入試 (privately financed international student exams) at the former imperial universities, Waseda/Keio, Sophia/TUS/ICU, MARCH and Kan-Kan-Do-Ritsu. Star (☆) the universities or faculties you are aiming for and the calendar shows only those. Universities whose faculties have different dates expand when you tap the name.",
    "면책 공지": "Disclaimer",
    "이 페이지의 일정은 각 대학 모집요항과 공개 자료를 바탕으로 개인이 정리한 참고용 정보이며, 대학의 공식 안내가 아닙니다. 날짜·출원 자격·제출 방법은 변경되거나 잘못 옮겨졌을 수 있으니, 출원 전 반드시 각 대학의 최신 공식 모집요항으로 확인하세요. 이 정보를 이용해 생긴 불이익에 대해서는 책임지지 않습니다.":
      "These dates were compiled by an individual from each university's application guidelines and public sources, for reference only. They are not official university information. Dates, eligibility and submission methods may change or may have been copied incorrectly, so always check the latest official guidelines (募集要項) before applying. No responsibility is taken for any loss arising from use of this information.",
    "면책 공지 닫기": "Close disclaimer",
    "보기 선택": "Choose view",
    "캘린더": "Calendar",
    "기본 일정표": "Schedule table",
    "선택 초기화": "Clear selection",
    "쿠키 설정": "Cookie settings",
    "안내": "Notes",
    "2027년 4월 입학 사비유학생 입시 기준입니다. 학부마다 날짜가 다른 곳은 범위나 대표 학부로 적었습니다.": "Based on privately financed international student admissions for April 2027 entry. Where dates differ by faculty, a range or a representative faculty is shown.",
    "상태(출원 중·예정·마감)는 이 페이지를 연 날짜를 기준으로 자동 계산됩니다.": "Status (open, upcoming, closed) is calculated automatically from the date you open this page.",
    "학부마다 일정이 다른 대학은 대학 이름을 누르면 학부 목록이 펼쳐집니다. 학부별로 ☆를 눌러 지망을 고르면 캘린더에 그 학부 일정이 들어갑니다.": "For universities whose faculties have different dates, tap the university name to expand its faculties. Star (☆) a faculty to add its dates to the calendar.",
    "필착(도착 기준)과 소인유효(발송 기준)는 대학마다 다릅니다. 출원 전 반드시 각 대학 공식 요항으로 재확인하세요.": "Whether documents must arrive by the deadline (必着) or be postmarked by it (消印有効) differs by university. Always double-check each university's official guidelines before applying.",
    "모바일에서는 캘린더 날짜를 누르면 그날 일정만 아래에 표시됩니다.": "On mobile, tap a calendar date to list only that day's events below.",
    "쿠키에는 고른 지망 대학 목록과 동의 여부만 저장되며, 이 브라우저 밖으로 보내지 않습니다. 보관 기간은 1년입니다.": "The cookie stores only your selected universities and your consent choice, and never leaves this browser. It is kept for one year.",
    "로그인하면 고른 지망 목록이 계정에도 저장되어 다른 기기에서도 이어집니다. 로그아웃해도 이 기기의 선택은 그대로입니다.": "If you log in, your selection is also saved to your account and carries over to other devices. Logging out keeps the selection on this device.",
    "출원": "Apply",
    "면접·시험": "Interview / exam",
    "합격발표": "Results",
    "출원 중": "Open",
    "오늘 마감": "Closes today",
    "출원 예정": "Upcoming",
    "출원 마감": "Closed",
    "확인 필요": "Check guidelines",
    "· ☆ = 지망 선택": "· ☆ = mark as target",
    "출처: 게이오·와세다·도쿄대 2027 모집요항, 그 밖에는 JPSS 및 각 대학 공지 (2026년 10월 조사). 날짜는 일본 시간.": "Sources: 2027 application guidelines of Keio, Waseda and the University of Tokyo; JPSS and university announcements for the rest (checked October 2026). All times are Japan time.",
    "쿠키 사용 동의": "Cookie consent",
    "지망 대학 선택을 다음 방문 때도 유지하려면 이 브라우저에 쿠키를 저장합니다. 저장 항목은 선택한 대학 목록과 동의 여부뿐이고, 1년 뒤 만료됩니다.": "To keep your selected universities for your next visit, a cookie is stored in this browser. It holds only your selection and your consent choice, and expires after one year.",
    "거부해도 페이지는 그대로 쓸 수 있지만, 창을 닫으면 선택이 사라집니다.": "You can still use the page if you decline, but your selection is lost when you close the window.",
    "거부": "Decline",
    "동의": "Accept",
    "이 브라우저가 쿠키 저장을 막고 있어 선택은 이번 방문에만 유지됩니다.": "This browser is blocking cookies, so your selection is kept for this visit only.",
    /* table */
    "지망": "Target",
    "대학": "University",
    "상태": "Status",
    "출원기간": "Application",
    "비고": "Notes",
    /* calendar */
    "대학을 누르면 학부 목록이 펼쳐집니다. 학부별로 지망을 고르면 캘린더에 그 학부 일정이 들어갑니다.": "Tap a university to expand its faculties. Pick a faculty and its dates appear on the calendar.",
    "아직 고른 지망이 없습니다. 위 목록에서 대학이나 학부를 누르면 여기에 출원·면접·발표 일정이 표시됩니다.": "No targets selected yet. Tap a university or faculty above to show its application, interview and result dates here.",
    "일": "Sun", "월": "Mon", "화": "Tue", "수": "Wed", "목": "Thu", "금": "Fri", "토": "Sat",
    "‹ 이전": "‹ Prev",
    "다음 ›": "Next ›",
    "이번 달 전체 보기": "Show whole month",
    "이 날에는 지망 일정이 없습니다.": "No target events on this day.",
    "이번 달에는 지망 일정이 없습니다.": "No target events this month.",
    "7일 안의 출원 일정": "Application dates in the next 7 days",
    /* tiers */
    "구제국대학": "Former imperial universities",
    "소케이": "Waseda · Keio",
    "조치 · 도쿄이과 · ICU": "Sophia · Tokyo Univ. of Science · ICU",
    "칸칸도리츠": "Kan-Kan-Do-Ritsu",
    /* notes (비고) */
    "EJU 이용 선발(4월 입학). 내일 불필요": "EJU-based selection (April entry). No visit to Japan required.",
    "Ⅰ형. 문 11/28→12/2, 법 12/5→12/11, 경영 12/5→12/22": "Type I. Arts & Letters 11/28→12/2, Law 12/5→12/11, Business 12/5→12/22",
    "경영학부는 면접 없음": "No interview for the College of Business Administration",
    "경제·법·이공은 면접 없이 서류로 결정. 수속 1/22–2/8": "Economics, Law and Science & Technology decide on documents only, no interview. Enrollment procedures 1/22–2/8",
    "경제·정책창조·사회안전·시스템이공·환경도시공·화학생명공은 시험 없음": "No exam for Economics, Policy Studies, Societal Safety Sciences, Systems Science & Eng., Environmental & Urban Eng., and Chemistry, Materials & Bioengineering",
    "공·이·예술공학부는 2/27 면접만": "Engineering, Science and Design: interview on 2/27 only",
    "교육·정보·이는 1차 12/22. 공학부는 모집 안 함": "Education, Informatics and Science: 1st-round results 12/22. School of Engineering does not recruit.",
    "문화정보 구두시문, 법 면접, 상 서류만. 서울 시험장 있음. 수속 2/4": "Culture & Information Science: oral exam; Law: interview; Commerce: documents only. Seoul test site available. Procedures 2/4",
    "법 면접 9/18·발표 10/1, 정경 면접 9/27·발표 10/1, 문·문구 발표 9/25": "Law interview 9/18, results 10/1; Political Science & Economics interview 9/27, results 10/1; Letters / Culture, Media & Society results 9/25",
    "법·국제·총합정책·이·공·생명환경만": "Law, International Studies, Policy Studies, Science, Engineering and Biological & Environmental Sciences only",
    "법·문·경제·사회·총합정보": "Law, Letters, Economics, Sociology, Informatics",
    "소인유효. 수속 1차 2/15": "Postmark deadline. First procedure deadline 2/15",
    "수속 1/28": "Procedures 1/28",
    "수속 12/8": "Procedures 12/8",
    "수속마감 1/8": "Procedure deadline 1/8",
    "외국인입시. 수속 10/22": "International student exam. Procedures 10/22",
    "외국학교졸업 제1종. 1차 결과 1/25 발송. 수속 3/11–3/15": "Foreign school graduates, Type 1. 1st-round results sent 1/25. Procedures 3/11–3/15",
    "이문화커뮤니케이션(본고사, 11/14 시험)·법 국제비즈니스법 글로벌코스는 9/25–10/2 출원, 12/7 발표. 서류는 11/24까지 도착해야 함": "Intercultural Communication (exam on 11/14) and the Law Global Course in International Business Law: apply 9/25–10/2, results 12/7. Others: documents must arrive by 11/24.",
    "이학부(생물)·공·기초공 2/25 시험+2/26 구두시문. 경제 1차 3/1, 의학과 1차 2/6": "Science (Biology), Engineering and Engineering Science: exam 2/25 + oral exam 2/26. Economics 1st round 3/1, Medicine 1st round 2/6",
    "출원자격심사(법·경제 ~10/9, 공 10/14–10/16)를 통과한 사람만 본출원. 경제 검정료 12/18–1/7, 1차 결과 1/22 우송": "Only applicants who passed eligibility screening (Law/Economics by 10/9, Engineering 10/14–10/16) may apply. Economics exam fee 12/18–1/7; 1st-round results mailed 1/22",
    "신학부는 출원 9/1–9/8, 시험 10/24": "Theology: apply 9/1–9/8, exam 10/24",
    "수험표 인쇄 1/29. 수속마감 3/15": "Print admission ticket 1/29. Enrollment deadline 3/15",
    "1일 시험 학과 (신·외국어 등)": "One-day exam depts. (Theology, Foreign Studies, etc.)",
    "2단계 학과 (법·문 등)": "Two-stage depts. (Law, Humanities, etc.)",
    "면접·구두시문 학부 (법·문화정보·신 등)": "Interview / oral-exam faculties (Law, Culture & Information Science, Theology, etc.)",
    "서류만 학부 (상 등)": "Documents-only faculties (Commerce, etc.)",
    "그 외 학부 (서류전형)": "Other faculties (document screening)",
    "이문화커뮤니케이션 (본고사)": "Intercultural Communication (exam)",
    "법 국제비즈니스법 글로벌코스": "Law: Global Course in International Business Law",
    "경영 (면접 없음)": "Business Administration (no interview)",
    "이공 외 학부": "Faculties other than Science & Eng."
  };

  /* 일정 칸·일정 이름용 낱말 사전. 띄어쓰기가 있는 구절을 먼저 바꾸고, 남은 한글 낱말을 통째로 찾아 바꾼다 */
  var PHRASE = {
    "1차 결과 발송": "1st-round results sent", "1차 발표": "1st-round results", "1차 시험": "1st-round exam", "2차 시험": "2nd-round exam",
    "1차 합격자": "1st-round passers", "11월 하순": "late Nov.", "이후 우송": "or later by mail", "심사결과 우송": "screening results mailed",
    "Web 출원 시작": "Web application opens", "Web 출원 마감": "Web application closes", "Web 마감": "Web deadline",
    "출원 시작": "application opens", "출원 마감": "application closes", "검정료 결제 시작": "exam fee payment opens",
    "서류 필착 마감": "documents must arrive", "서류 소인 마감": "documents postmark deadline", "서류 우송 마감": "documents mail deadline", "서류 도착 기한": "documents arrival deadline",
    "자격심사 시작": "eligibility screening opens", "자격심사 마감": "eligibility screening closes",
    "서류 발송 시작": "documents mailing opens", "서류 업로드 마감": "documents upload deadline", "결과 우송": "results mailed", "일본어 시험": "Japanese exam",
    "최종 발표": "final results", "온라인 면접": "online interview", "대면 면접": "in-person interview",
    "면접 없음": "no interview", "시험 없음": "no exam", "요항 확인": "see guidelines", "본출원 확인": "Check main application",
    "그 외": "others", "법은 없음": "none for Law", "대부분 학부": "most faculties", "일부": "some",
    "(오늘)": "(today)", "(온라인)": "(online)", "(대면)": "(in person)", "1차": "1st round", "2차": "2nd round",
    "도쿄이과 1기": "Tokyo Univ. of Science (Round 1)", "도쿄이과 2기": "Tokyo Univ. of Science (Round 2)",
    "간사이 9월": "Kansai (Sept.)", "간사이 11월": "Kansai (Nov.)",
    "간세이가쿠인 Ⅰ기": "Kwansei Gakuin (Round I)", "간세이가쿠인 Ⅱ기": "Kwansei Gakuin (Round II)",
    "도시샤 1기": "Doshisha (Round 1)", "도시샤 2기": "Doshisha (Round 2)",
    "리쓰메이칸 전기": "Ritsumeikan (Early)", "리쓰메이칸 후기": "Ritsumeikan (Late)",
    "의학부 의학과": "Medicine (School of Medicine)", "이학부 생물": "Science: Biology"
  };
  var WORD = {
    "도쿄대": "Univ. of Tokyo", "교토대": "Kyoto Univ.", "오사카대": "Osaka Univ.", "도호쿠대": "Tohoku Univ.", "나고야대": "Nagoya Univ.",
    "규슈대": "Kyushu Univ.", "홋카이도대": "Hokkaido Univ.", "와세다": "Waseda", "게이오": "Keio", "조치": "Sophia", "메이지": "Meiji",
    "아오야마": "Aoyama Gakuin", "릿쿄": "Rikkyo", "추오": "Chuo", "호세이": "Hosei",
    "출원": "application", "시작": "opens", "마감": "closes", "발표": "results", "면접": "interview", "시험": "exam", "필기": "written exam",
    "소론문": "short essay", "구두시문": "oral exam", "본고사": "main exam", "수학": "math", "수학시험": "math exam", "이과": "science",
    "정오": "noon", "업로드": "upload", "통과자": "who passed", "일본어": "Japanese", "필착": "(must arrive)", "소인유효": "(postmark)", "서류": "documents", "우송": "mail", "검정료": "exam fee", "자격심사": "eligibility screening",
    "심사결과": "screening results", "없음": "none", "서류전형": "document screening", "최종": "final", "경": "approx.", "건축": "Architecture",
    "일부": "some", "대부분": "most", "등": "etc.", "외": "others", "그": "",
    "학부": "faculty", "공학부": "Engineering", "법학부": "Law", "경제학부": "Economics", "의학과": "Medicine",
    "문": "Letters", "법": "Law", "상": "Commerce", "이": "Science", "공": "Eng.", "의": "Medicine", "치": "Dentistry", "약": "Pharmacy", "농": "Agriculture",
    "신": "Theology", "경영": "Business", "경제": "Economics", "교육": "Education", "정보": "Informatics", "정경": "Pol. Sci. & Econ.", "문구": "Culture, Media & Society",
    "이공": "Science & Eng.", "기초공": "Engineering Science", "생물": "Biology", "생명이학": "Biological Sciences", "보건": "Health Sciences",
    "인간과학": "Human Sciences", "외국어": "Foreign Studies", "정치경제": "Political Science & Economics", "사회과학": "Social Sciences",
    "문화구상": "Culture, Media & Society", "스포츠과학": "Sport Sciences", "기간": "Fundamental", "창조": "Creative", "선진": "Advanced",
    "공창": "Interdisciplinary Eng.", "예술공": "Design", "선진공": "Advanced Engineering", "창역": "Science & Tech. (Noda)",
    "사회": "Sociology", "총합정보": "Informatics", "정책창조": "Policy Studies", "사회안전": "Societal Safety Sciences",
    "시스템이공": "Systems Science & Eng.", "환경도시공": "Environmental & Urban Eng.", "화학생명공": "Chemistry, Materials & Bioeng.",
    "인간건강": "Health & Well-being", "비즈니스데이터사이언스": "Business Data Science",
    "산사": "Social Sciences", "국관": "International Relations", "디자인아트": "Design & Art", "산업사회": "Social Sciences", "국제관계": "International Relations",
    "정책과학": "Policy Science", "종합심리": "Comprehensive Psychology", "영상": "Image Arts & Sciences", "스포츠건강": "Sport & Health Science",
    "식매니지먼트": "Gastronomy Management", "정보이공": "Information Science & Eng.", "생명과학": "Life Sciences",
    "문화정보": "Culture & Information Science", "국제": "International Studies", "총합정책": "Policy Studies", "생명환경": "Biological & Environmental Sciences"
  };
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  var PH = new RegExp(Object.keys(PHRASE).sort(function (a, b) { return b.length - a.length; }).map(esc).join("|"), "g");
  function gloss(s) {
    var r = s.replace(/(\d+)시경/g, "approx. $1:00").replace(/(\d+)시/g, "$1:00");
    r = r.replace(PH, function (m) { return PHRASE[m]; });
    r = r.replace(/[가-힣]+/g, function (w) { return WORD[w] != null ? WORD[w] : (EN[w] != null ? EN[w] : w); });
    r = r.replace(/\s{2,}/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
    r = r.replace(/ · ([a-z])/g, function (_, c) { return " · " + c.toUpperCase(); });
    return r.charAt(0).toUpperCase() + r.slice(1);
  }
  for (var k in PHRASE) if (!(k in EN) && /^[^\d(]/.test(k) && k.indexOf("Ⅰ") < 0) EN[k] = PHRASE[k].charAt(0).toUpperCase() + PHRASE[k].slice(1);
  for (var w in WORD) if (!(w in EN) && w.length > 1) EN[w] = WORD[w].charAt(0).toUpperCase() + WORD[w].slice(1);
  ND.add("en", EN);
  ND.pat("en", [
    [/^지망 (\d+)개( · .+)?$/, function (_, n, rest) {
      var tail = { " · 쿠키 저장 중": " · saved in cookie", " · 이 환경에서는 쿠키 저장 불가": " · cookies unavailable here", " · 저장 안 함": " · not saved", " · 계정에 저장 중": " · saved to your account" };
      return n + " selected" + (rest ? (tail[rest] || rest) : "");
    }],
    [/^지망 (\d+)개 학부$/, "$1 faculties selected"],
    [/^학부 (\d+)개 · 눌러서 선택$/, "$1 faculties · tap to choose"],
    [/^일부 (.+)$/, function (_, l) { return "Some " + ND.t(l).toLowerCase(); }],
    [/^(.+) 지망 선택$/, "Mark $1 as target"],
    [/^(.+) 지망 해제$/, "Unmark $1"],
    [/^(.+) 학부 펼치기$/, "Show faculties of $1"],
    [/^(\d+)월 (\d+)일 일정 보기$/, function (_, m, d) { return "Show events on " + m + "/" + d; }],
    [/^(\d+\/\d+) 일정$/, "Events on $1"],
    [/^일정 미확인으로 캘린더에 표시되지 않는 지망: (.+)$/, function (_, list) { return "Targets not shown on the calendar because dates are unconfirmed: " + gloss(list); }]
  ]);
  // 낱말 바꿈 뒤에도 한글이 남으면(=사전에 없는 문장) 어설픈 섞어 쓰기 대신 원문을 둔다
  ND.fallback("en", function (s) { if (!/[\uac00-\ud7a3]/.test(s)) return null; var r = gloss(s); return /[\uac00-\ud7a3]/.test(r) ? null : r; });
  // 일본어 화면(마이페이지 등)에서 일유알리미 일정을 보일 때 쓰는 영어 번역. 문장 사전 → 낱말 사전 순서, 못 바꾸면 원문
  window.ALARM_EN = function (s) { if (EN[s] != null) return EN[s]; var r = gloss(String(s)); return /[\uac00-\ud7a3]/.test(r) ? s : r; };
})();

# nihongodic.com

Cloudflare Workers(정적 자산)로 배포되는 사이트. `main`에 올라가면 바로 배포된다.
빌드 단계는 없다. `public/` 폴더가 그대로 사이트다(`wrangler.jsonc`).

## 폴더
- `public/index.html`: 메인. 분류는 **01 단어 / 02 EJU · 유학 / 03 게임** 세 개
- `public/words/`, `public/eju/`, `public/games/`: 분류별 묶음 페이지(위쪽 메뉴의 세 아이콘이 여기로 온다)
- `public/<도구>/`: 각 도구 (japanese, korean, en/*, japanworld, alarm, politics, jeildang, pokemon)
- `public/japanese/jlpt/`: **생성물**. `tools/jlpt/build.py`가 만든다. 직접 고치지 말 것
- `public/shared/nav.js`: 모든 페이지 위쪽 공통 메뉴 + 한/일/영 번역 엔진 + 로그인 버튼
- `public/shared/i18n-home.js`: 메인과 묶음 페이지 번역(키는 한국어 원문)
- `public/shared/og/`: 공유 미리보기 이미지. **생성물**(`tools/og/build.js`)
- `public/_headers`: 보안 헤더와 도구별 CSP. 외부 스크립트를 새로 쓰면 해당 경로 CSP에 추가해야 한다
- `public/_redirects`: 예전 주소와 끝 `/` 붙이기. 주소를 옮기면 반드시 여기에 301을 남긴다
- `firestore.rules`: Firestore 보안 규칙. 저장소에서 고친 뒤 Firebase 콘솔에 붙여 넣어 게시해야 적용된다
- `desktop/`: 제1당 스팀용 데스크톱판(Electron)
- `public/judge/`, `public/yukyung/`: 개인용 페이지(검색 제외). 메뉴·사이트맵에 넣지 않는다

## 공통 파일은 여러 작업이 함께 고친다
`nav.js`, `i18n-home.js`, `index.html`, `_headers`, `_redirects`, `sitemap.xml`은 동시에 여러 작업이 고치다가
덮어쓰는 일이 실제로 있었다.
- 작업 시작 전과 푸시 직전에 `git pull --rebase origin main`
- 파일 전체를 다시 쓰지 말고 필요한 줄만 고친다
- 커밋은 작게, 하나의 목적만

## 도구를 새로 넣을 때 체크리스트
1. 메인 `index.html`의 알맞은 분류와 그 분류의 묶음 페이지에 카드 추가
2. `nav.js`의 `GROUPS[].tools`와 `TOOLS`(지원 언어)에 경로 추가
3. 새 글자는 `i18n-home.js`에 일·영 번역 추가
4. `sitemap.xml`에 주소 추가, `_redirects`에 `/<도구>  /<도구>/  301`
5. 페이지 `<head>`: description, canonical, og:title/description/url/image
   (이미지는 `tools/og/images.json`에 항목을 넣고 다시 생성)
6. `<body>` 바로 안에 `<script src="/shared/nav.js" data-langs="ko"></script>`(지원 언어에 맞게)

## 점검 (푸시 전에 돌리고, GitHub Actions도 같은 것을 돌린다)
```bash
python3 tools/check/links.py     # 사이트 안 깨진 링크
node tools/check/smoke.js        # 모든 페이지를 360px로 열어 JS 오류·가로 넘침·메뉴 확인
```

## 생성기
```bash
python3 tools/jlpt/build.py                  # vocabulary.js를 고친 뒤: JLPT 정적 페이지 + sitemap
node tools/og/build.js <글꼴 폴더>            # 공유 이미지. 글꼴은 npm @fontsource/noto-sans-kr·jp를 풀어 둔 폴더
python3 tools/i18n-build.py <번역표.tsv>      # 번역표 → ND.add JS
```

## 정기적으로 갱신해야 하는 내용
- 일유알리미(`/alarm/`): 입학 연도별 출원 일정. 다음 연도 모집요강이 나오면 갱신
- 나가타초 노트(`/politics/`): 지지율·의석 데이터 기준일
- 갱신하면 화면의 "데이터 기준일"도 함께 바꾼다

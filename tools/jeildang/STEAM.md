# 제1당 스팀 출시 안내

데스크톱판은 `desktop/`에 있다. `public/`의 웹 게임을 Electron으로 그대로 감싸고, 스팀이 켜져 있으면 steamworks.js로 도전과제를 연다.

## 지금 되는 것 (2026-11)

- `public/jeildang/`을 인터넷 없이 띄운다(`app://game/jeildang/`). 혼자 하기, 튜토리얼, 개표 연출, 효과음, 도전과제가 그대로 돈다.
- 사이트 공통 메뉴와 온라인 멀티(방 만들기·참가)는 숨기고, 첫 화면에 언어 선택을 둔다.
- 스팀이 켜져 있으면 연결하고 오버레이를 켠다. 게임 안 도전과제를 얻으면 같은 이름의 스팀 도전과제를 연다. 스팀이 없어도 게임은 돈다.
- F11로 전체 화면. 창 최소 크기는 1024×640, 기본 1280×800(스팀덱 화면 크기).
- 저장: 혼자 하기 판과 도전과제는 Electron 사용자 데이터 폴더의 Local Storage에 남는다.

## 아직 안 되는 것

- 온라인 멀티: 지금 멀티는 Firebase 익명 로그인이라 데스크톱 주소(`app://`)에서는 쓸 수 없다. 스팀판 멀티는 스팀 로그인 티켓으로 Firebase 맞춤 토큰을 받는 서버(Cloud Functions)가 필요하다. 같은 작업에서 분기 처리를 서버로 옮겨 조작을 막는다. Firebase 유료 요금제(Blaze) 전환이 필요하므로 운영자 결정 뒤 진행한다.
- 스팀 클라우드: 아래 '자동 클라우드' 설정으로 저장 폴더를 동기화할 수 있으나 실제 스팀에서 확인하지 않았다.
- 실제 스팀 클라이언트에서 도전과제가 열리는지는 앱 ID를 받은 뒤 확인해야 한다(이 저장소의 자동 점검은 스팀 없이 돌린다).

## 개발과 점검

```bash
cd desktop
npm install
npm start
```

자동 점검(창을 띄워 게임과 스팀 연결부가 뜨는지만 보고 끝냄, 리눅스 서버에서는 xvfb 필요):

```bash
cd desktop
xvfb-run -a npx electron . --smoke --no-sandbox
```

`steam_appid.txt`의 480은 Valve가 개발용으로 여는 예제 앱(Spacewar)이다. 스팀을 켜 둔 PC에서 `npm start`를 하면 Spacewar로 연결돼 오버레이까지 확인할 수 있다. 실제 앱 ID를 받으면 이 파일의 숫자를 바꾼다(환경 변수 `STEAM_APP_ID`가 있으면 그 값이 먼저).

## 빌드

```bash
cd desktop
npm run dist:win     # Windows (Windows PC에서)
npm run dist:linux   # Linux / 스팀덱
npm run dist:mac     # macOS (Mac에서)
```

결과물은 `desktop/dist/`에 폴더째로 나온다(설치 파일이 아니라 실행 폴더). 스팀에는 이 폴더를 깊이(depot)로 올린다.

## 운영자가 할 일 (순서대로)

1. **Steamworks 가입과 앱 등록**: partner.steamgames.com에서 가입하고 앱 등록비(앱마다 100달러)를 낸다. 세금·계좌 정보를 넣으면 앱 ID가 나온다.
2. **앱 ID 반영**: `desktop/steam_appid.txt`를 받은 앱 ID로 바꾼다.
3. **도전과제 등록**: Steamworks → 앱 관리 → 도전과제에 아래 16개를 같은 API 이름으로 만든다. 아이콘(64×64, 잠김/열림 두 장)이 필요하다.

   | API 이름 | 이름 | 조건 |
   |---|---|---|
   | ACH_TUTORIAL | 첫걸음 | 튜토리얼을 끝까지 마친다 |
   | ACH_FIRST_WIN | 제1당 | 한 판에서 이긴다 |
   | ACH_PM | 정권 교체 | 우리 당이 정부를 맡는다 |
   | ACH_MAJORITY | 단독 과반 | 마지막 총선을 단독 과반으로 마친다 |
   | ACH_COALITION | 연맹 정부 | 마지막 총선을 연맹 합산 과반으로 마친다 |
   | ACH_UNDERDOG | 군소정당의 반란 | 가상 공화국에서 군소정당으로 이긴다 |
   | ACH_LAWMAKER | 입법왕 | 한 판에서 우리 법안을 5건 통과시킨다 |
   | ACH_CRISIS | 위기 관리 | 정부일 때 대책으로 사건이 번지는 것을 막는다 |
   | ACH_DEFY | 정면 돌파 | 의혹 사건에서 정면 돌파에 성공한다 |
   | ACH_TWO_TERMS | 장기 집권 | 이어 한 판에서 두 임기 연속 이긴다 |
   | ACH_SCENARIO | 시나리오 정복 | 시나리오 하나를 성공한다 |
   | ACH_WIN_KR | 여의도의 주인 | 한국 모드에서 이긴다 |
   | ACH_WIN_JP | 나가타초의 주인 | 일본 모드에서 이긴다 |
   | ACH_WIN_US | 캐피톨 힐의 주인 | 미국 모드에서 이긴다 |
   | ACH_WIN_UK | 웨스트민스터의 주인 | 영국 모드에서 이긴다 |
   | ACH_WIN_FR | 부르봉궁의 주인 | 프랑스 모드에서 이긴다 |

4. **스팀 클라우드(자동 클라우드)**: 앱 관리 → 스팀 클라우드에서 자동 클라우드를 켜고, 루트를 Windows는 `WinAppDataRoaming`, 경로는 `First Party/Local Storage`, 패턴 `*`로 둔다. Linux는 `LinuxXdgConfigHome`의 같은 경로.
5. **깊이(depot)와 실행 설정**: Windows·Linux depot을 만들고 `npm run dist:*` 결과 폴더를 SteamPipe로 올린다. 실행 파일은 `First Party.exe`(Windows), `first-party`(Linux).
6. **스토어 페이지**: 캡슐 이미지, 스크린샷 5장 이상, 트레일러, 설명(한·일·영), 등급 설문(IARC). 출시 2주 전에는 '출시 예정'으로 공개해야 하지만, 찜하기를 모으려면 몇 달 일찍 연다.
7. **출시 전 정리**: `PHOTOS.md`의 배경 사진과 `AUDIO.md`의 배경음악을 상업적 이용이 가능한 것으로 바꾸고 출처를 남긴다. 국가 모드의 실제 정당 이름을 어떻게 할지 정한다.

# 제1당 안드로이드 앱 (Play 스토어)

게임 파일을 **앱 안에 넣고** WebView로 띄우는 앱이다(1.1.0부터. 1.0.x는 사이트를 크롬으로 띄우는 TWA였다).

- 패키지 이름: `com.nihongodic.jeildang` (1.0.x와 같다. 같은 업로드 키로 서명하면 그대로 업데이트된다)
- 앱 안에 들어가는 것: `public/jeildang/`(`play/`, `sw.js` 제외), `public/shared/`(`og/` 제외), `public/privacy.html`.
  빌드할 때 `app/build.gradle`의 `copySite`가 복사한다. **사이트에 배포해도 앱은 바뀌지 않는다.** 게임을 고쳤으면 `versionCode`를 올려 다시 빌드·업로드한다.
- 화면 주소는 `https://appassets.androidplatform.net/jeildang/`(앱 안 파일). 앱 안에 없는 주소(마이페이지 등)와 바깥 링크는 휴대폰 브라우저로 연다.
- 페이지에 `window.JDAndroid`가 열린다. 게임(`index.html`, `nav.js`, `account.js`)은 이걸 보고
  사이트 메뉴 없음, 체험판 제한 없음, 서비스 워커 안 씀, 게임 화면에서만 광고 배너로 돈다.
- 혼자 하기는 인터넷 없이 된다. 멀티플레이·로그인은 인터넷이 필요하다(Firebase는 사이트와 같은 프로젝트).

## 운영자가 채울 값 (`app/build.gradle` 위쪽)

| 값 | 어디서 | 비어 있으면 |
|---|---|---|
| `ADMOB_APP_ID` | AdMob → 앱 → 앱 설정의 앱 ID (`ca-app-pub-…~…`) | 지금은 Google **시험용** ID. 시험 광고만 나오고 수익 없음 |
| `ADMOB_BANNER_ID` | AdMob → 앱 → 광고 단위 → 배너 (`ca-app-pub-…/…`) | 위와 같음 |
| `GOOGLE_WEB_CLIENT_ID` | Firebase 콘솔 → Authentication → 로그인 방법 → Google → 웹 SDK 구성의 웹 클라이언트 ID | 앱에서는 이메일 로그인만 보인다 |

Google 로그인을 켤 때는 Firebase 콘솔 → 프로젝트 설정 → 내 앱에 **Android 앱**(`com.nihongodic.jeildang`)을 추가하고
업로드 키와 Play 앱 서명 키의 **SHA-1** 지문을 넣는다(`keytool -list -v -keystore jeildang-upload.keystore -alias upload`, Play Console → 앱 무결성).

AdMob을 쓰면 사이트 루트에 `app-ads.txt`가 있어야 한다(AdMob 게시자 ID 한 줄). Play 스토어 등록 정보의 웹사이트는 `https://nihongodic.com`.

## 빌드

준비물: JDK 17, Android SDK(platforms;android-36, build-tools 35). `local.properties`에 `sdk.dir=…`

```bash
cd android
./gradlew bundleRelease assembleRelease
```

결과물(서명 전):
- `app/build/outputs/bundle/release/app-release.aab`: Play에 올리는 파일
- `app/build/outputs/apk/release/app-release-unsigned.apk`: 휴대폰 시험용(아래처럼 서명)

서명 (업로드 키 `jeildang-upload.keystore`, 별칭 `upload`. **저장소에는 없다.** 운영자가 따로 보관):

```bash
jarsigner -keystore jeildang-upload.keystore -sigalg SHA256withRSA -digestalg SHA-256 app/build/outputs/bundle/release/app-release.aab upload
zipalign -f -p 4 app/build/outputs/apk/release/app-release-unsigned.apk aligned.apk
apksigner sign --ks jeildang-upload.keystore --ks-key-alias upload --out jeildang-test.apk aligned.apk
```

## Play Console

1. 앱 콘텐츠 → **광고**: '광고 포함'
2. 앱 콘텐츠 → **데이터 보안**: 기기 또는 기타 ID(광고 ID)·대략적 위치(IP)를 '광고 또는 마케팅'·'분석' 목적으로 수집, 제3자(Google AdMob)와 공유. 로그인 이메일·이름, 게임 기록(Firebase)은 기존대로
3. 개인정보처리방침: https://nihongodic.com/privacy.html (AdMob 항목 있음)
4. 새 개인 계정은 테스터 12명 이상이 14일 동안 비공개 테스트를 해야 프로덕션 출시를 신청할 수 있다
5. 스토어 이미지: `store/play-icon-512.png`, `store/feature-1024x500.png`

## 아이콘

`node tools/jeildang/app/icons.js` → 스토어용은 `android/store/`. 앱 아이콘(mipmap)은 1.0.x 때 만든 것을 그대로 쓴다.

## 지금 상태 (2026-11-26)

- 1.1.0(versionCode 12): 앱 안에 게임을 넣은 첫 버전(AdMob 시험용 ID)
- 1.1.1(versionCode 13): 실제 AdMob 앱 ID·배너 단위. Google 로그인은 아직 꺼짐(이메일만)
- 1.1.2(versionCode 14): 계정 상자에 '계정 삭제'(Play 계정 삭제 정책). 웹 안내 주소 https://nihongodic.com/account/delete/
- 웹(`/jeildang/`)은 체험판, 1.0.x(TWA)용 앱 화면 `/jeildang/play/`는 업데이트하지 않은 테스터를 위해 당분간 둔다

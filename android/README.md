# 제1당 안드로이드 앱 (Play 스토어)

웹 게임(https://nihongodic.com/jeildang/)을 크롬으로 전체 화면 실행하는 **TWA(Trusted Web Activity)** 앱이다.
Google의 Bubblewrap으로 만든 프로젝트이고, 게임 코드는 앱에 들어 있지 않다. 사이트에 배포하면 앱도 바로 바뀐다.

- 패키지 이름: `com.nihongodic.jeildang`
- 시작 주소: `/jeildang/?source=app`
- 오프라인: 한 번 연 뒤에는 인터넷 없이도 혼자 하기가 된다(`public/jeildang/sw.js`). 멀티플레이·로그인은 인터넷이 필요하다.
- Google 로그인: 크롬 안에서 돌아서 사이트와 똑같이 된다.

## 준비물 (내 PC)

- JDK 17, Node.js
- Bubblewrap CLI: `npm i -g @bubblewrap/cli` (처음 실행할 때 Android SDK를 받을지 묻는다. 받게 둔다)

## 지금 상태 (2026-11-25)

- 버전 1.0.0(versionCode 1) AAB와 시험용 APK를 만들어 운영자에게 전달했다. 업로드 키(`jeildang-upload.keystore`, 별칭 `upload`)와 비밀번호도 함께 전달했다. **저장소에는 없다.** 다음 빌드부터는 이 키로 서명해야 한다.
- 업로드 키 SHA-256 지문: `E6:6B:E8:B3:C5:62:0D:DE:27:DE:EF:73:89:FE:6B:90:40:92:9B:FE:52:18:BC:B2:05:D2:61:D2:C7:92:FE:5A` (이미 `public/.well-known/assetlinks.json`에 들어 있다. Play 앱 서명 키 지문은 첫 업로드 뒤 더한다)
- 최소 안드로이드 7.0(API 24). TWA 라이브러리(androidbrowserhelper)가 24 이상을 요구한다.
- **androidbrowserhelper 는 2.8.0 이상을 쓴다.** 2.7.x 는 Chrome 152 이상에서 시작 화면 이미지를 넘길 때 거부당해(앱이 그 파일 권한을 안 가짐) 앱이 켜지자마자 꺼진다. Bubblewrap 으로 프로젝트를 다시 만들면 2.7.x 가 들어가니 `app/build.gradle`에서 꼭 올린다.
- Bubblewrap 템플릿이 고쳐 줘야 하는 것(다시 만들면 되돌아온다): 안드로이드 8.0 화면 방향 지정(`LauncherActivity.java`), 보존 규칙 없는 코드 축소(`minifyEnabled`), 빈 `versionName`.

## 1. 업로드 키 만들기 (한 번만 — 이미 만들었으면 건너뛴다)

```bash
cd android
keytool -genkeypair -v -keystore jeildang-upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

- 키 파일과 비밀번호는 **저장소에 올리지 않는다**(`.gitignore`에 있음). 잃어버리면 Play Console에서 업로드 키 재설정을 신청해야 하니 안전한 곳에 따로 보관한다.

## 2. 빌드

```bash
cd android
bubblewrap build
```

결과물:
- `app-release-bundle.aab`: Play 스토어에 올리는 파일
- `app-release-signed.apk`: 휴대폰에 직접 설치해 시험하는 파일

아이콘·이름·색을 바꾸려면 `twa-manifest.json`을 고친 뒤 `bubblewrap update`를 하고 다시 빌드한다. 올릴 때마다 `appVersionCode`를 1씩 올린다.

## 3. Play Console

1. 개발자 계정 가입(25달러, 본인 인증)
2. 앱 만들기 → 게임 → 무료/유료 선택
3. **Play 앱 서명** 사용(기본값). 처음 `.aab`를 비공개 테스트 트랙에 올린다
4. 새 개인 계정은 **테스터 12명 이상이 14일 동안** 비공개 테스트를 해야 프로덕션 출시를 신청할 수 있다
5. 스토어 등록 정보:
   - 아이콘 `store/play-icon-512.png`, 그래픽 이미지 `store/feature-1024x500.png`
   - 휴대폰 스크린샷 2장 이상
   - 설명(한·일·영)
   - 개인정보처리방침: https://nihongodic.com/privacy.html
6. 콘텐츠 등급(IARC 설문, 한국 등급 포함), 데이터 보안 양식(로그인 이메일·이름, 게임 기록 → Firebase), 타깃층, 광고 여부

## 4. 사이트와 앱 잇기 (주소창 없애기)

이 단계를 안 하면 앱 위쪽에 주소창이 보인다.

1. Play Console → 테스트 및 출시 → 앱 무결성 → **앱 서명 키 인증서의 SHA-256 지문**을 복사한다
2. 직접 설치한 APK로도 시험하려면 업로드 키 지문도 함께 넣는다: `keytool -list -v -keystore jeildang-upload.keystore -alias upload`
3. 저장소 루트에서 확인 파일을 만든다:
   ```bash
   python3 tools/jeildang/app/assetlinks.py <앱 서명 키 지문> [업로드 키 지문]
   ```
4. `public/.well-known/assetlinks.json`을 커밋해 배포한 뒤, https://nihongodic.com/.well-known/assetlinks.json 이 열리는지 확인한다
5. 확인 도구: https://developers.google.com/digital-asset-links/tools/generator

## 아이콘 다시 만들기

```bash
node tools/jeildang/app/icons.js
```

사이트용 아이콘은 `public/jeildang/app/`, 스토어용은 `android/store/`에 나온다.

## 아직 정하지 않은 것

- 무료/유료와 완전판 결제(Google Play 결제 연동). 결제를 넣으면 TWA에서 Digital Goods API를 쓰도록 이 프로젝트를 고쳐야 한다.
- 실제 정당 이름 처리와 출처가 불분명한 배경 사진 교체(스팀판과 같은 숙제).

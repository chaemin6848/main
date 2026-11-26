#!/usr/bin/env python3
"""제1당 앱 화면(public/jeildang/play/)을 웹 화면(public/jeildang/index.html)에서 만든다.

웹(/jeildang/)은 누구나 여는 체험판, 앱(/jeildang/play/)은 안드로이드 앱(TWA)이 여는 전체판이다.
게임 코드는 하나만 두고 이 스크립트가 앱 화면으로 바꿔 쓴다. index.html 을 고친 뒤 꼭 다시 돌린다
(GitHub Actions 가 --check 로 어긋났는지 본다).
  - <base href="/jeildang/"> 로 상대 주소(엔진·번역·지도·사진)를 웹 화면과 같은 파일로
  - 검색 제외, 앱용 manifest(play/manifest.json, 시작 주소 /jeildang/play/?source=app)
  - 공통 메뉴는 앱 모드(nav.js data-app): 사이트 메뉴 없이 언어·로그인만 → 체험판 제한도 걸리지 않는다
  - 브라우저로 열면 웹 체험판으로 보낸다(앱이 띄웠을 때만, document.referrer 가 android-app:// 일 때 연다)
사용: python3 tools/jeildang/app/build_play.py [--check]
"""
import json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.join(ROOT, 'public/jeildang/index.html')
OUT = os.path.join(ROOT, 'public/jeildang/play/index.html')
MAN_SRC = os.path.join(ROOT, 'public/jeildang/manifest.json')
MAN_OUT = os.path.join(ROOT, 'public/jeildang/play/manifest.json')

GUARD = '''<script>
/* 앱 화면은 안드로이드 앱(TWA)에서만 연다. 크롬은 앱이 띄운 첫 페이지의 document.referrer 를 android-app://<패키지> 로 준다.
   주소(?source=app)는 누구나 붙일 수 있으니 믿지 않는다. 같은 탭에서 다시 불러와도(언어 바꾸기) 되게 sessionStorage 에 기억한다.
   웹판(/jeildang/)이 앱에서 열린 걸 알아채고 넘겨 줄 때도 같은 표시를 남긴다. 아니면 웹판으로 보낸다 */
(function(){var ok=false;try{if(document.referrer.indexOf('android-app://com.nihongodic.jeildang')===0)sessionStorage.setItem('jd-app','1');ok=sessionStorage.getItem('jd-app')==='1'}catch(e){}
if(!ok)location.replace('/jeildang/')})();
</script>'''


def one(s, a, b):
    if s.count(a) != 1: sys.exit('build_play: index.html 에서 다음 부분을 정확히 한 번 찾지 못했습니다: ' + a[:60])
    return s.replace(a, b)


def build():
    s = open(SRC, encoding='utf-8').read()
    s = one(s, '<!doctype html>\n', '<!doctype html>\n<!-- 생성물: tools/jeildang/app/build_play.py 가 public/jeildang/index.html 로 만든다. 직접 고치지 말 것 -->\n')
    s = one(s, '<meta charset="UTF-8">\n', '<meta charset="UTF-8">\n<base href="/jeildang/">\n<meta name="robots" content="noindex">\n' + GUARD + '\n')
    s = one(s, '<link rel="manifest" href="manifest.json">', '<link rel="manifest" href="play/manifest.json">')
    # 웹 화면의 '앱이면 앱 화면으로 보내기'는 빼고, 공통 메뉴를 앱 모드로
    a = s.index('<!-- app-redirect -->'); b = s.index('<!-- /app-redirect -->') + len('<!-- /app-redirect -->\n')
    s = s[:a] + s[b:]
    s = one(s, '<script src="/shared/nav.js"></script>', '<script src="/shared/nav.js" data-app></script>')
    m = json.load(open(MAN_SRC, encoding='utf-8'))
    m.update({'id': '/jeildang/play/', 'start_url': '/jeildang/play/?source=app'})
    return s, json.dumps(m, ensure_ascii=False, indent=2) + '\n'


html, man = build()
if '--check' in sys.argv:
    cur = [open(p, encoding='utf-8').read() if os.path.exists(p) else '' for p in (OUT, MAN_OUT)]
    if cur != [html, man]:
        sys.exit('public/jeildang/play/ 가 index.html 과 맞지 않습니다. python3 tools/jeildang/app/build_play.py 를 돌려 커밋하세요.')
    print('play/ 최신')
else:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    open(MAN_OUT, 'w', encoding='utf-8').write(man)
    print('만듦: public/jeildang/play/index.html, play/manifest.json')

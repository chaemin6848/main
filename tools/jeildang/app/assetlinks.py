#!/usr/bin/env python3
"""앱과 사이트를 잇는 확인 파일 public/.well-known/assetlinks.json 을 만든다.

TWA 앱이 주소창 없이 전체 화면으로 뜨려면, nihongodic.com 이 이 앱(패키지 이름 + 서명 지문)을 자기 앱이라고 밝혀야 한다.
지문은 Play Console → 앱 → 테스트 및 출시 → 앱 무결성 → 앱 서명 키 인증서의 'SHA-256 인증서 지문'.
(Play 앱 서명을 쓰면 업로드 키가 아니라 Google 이 다시 서명한 '앱 서명 키' 지문이어야 한다. 둘 다 넣어 두면 직접 설치한 테스트 빌드도 된다.)

사용: python3 tools/jeildang/app/assetlinks.py AA:BB:...:FF [다른 지문 ...]
"""
import json, os, re, sys

fps = [a.upper() for a in sys.argv[1:]]
if not fps or not all(re.fullmatch(r'([0-9A-F]{2}:){31}[0-9A-F]{2}', f) for f in fps):
    sys.exit(__doc__)
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
out = os.path.join(root, 'public', '.well-known', 'assetlinks.json')
os.makedirs(os.path.dirname(out), exist_ok=True)
data = [{'relation': ['delegate_permission/common.handle_all_urls'],
         'target': {'namespace': 'android_app', 'package_name': 'com.nihongodic.jeildang', 'sha256_cert_fingerprints': fps}}]
json.dump(data, open(out, 'w'), indent=2)
print('만들었습니다:', os.path.normpath(out))

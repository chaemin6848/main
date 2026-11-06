#!/usr/bin/env python3
"""사이트 안 링크 점검: public/ 의 모든 HTML에서 href·src가 가리키는 내부 주소가 실제로 있는지 본다.
있다고 보는 경우: 파일이 있음 / 폴더에 index.html이 있음 / .html을 붙이면 있음 / _redirects에 적힌 주소.
사용: python3 tools/check/links.py   (깨진 링크가 있으면 종료 코드 1)"""
import os, re, sys, html
from urllib.parse import urlsplit, unquote
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'public')
redirects = []
for line in open(os.path.join(ROOT, '_redirects'), encoding='utf-8'):
    line = line.split('#')[0].split()
    if len(line) >= 2: redirects.append(line[0])

def redirected(p):
    for r in redirects:
        if r.endswith('*') and p.startswith(r[:-1]): return True
        if p == r or p.rstrip('/') == r.rstrip('/'): return True
    return False

def exists(p):
    f = os.path.join(ROOT, unquote(p).lstrip('/'))
    if p.endswith('/'): return os.path.isfile(os.path.join(f, 'index.html'))
    return os.path.isfile(f) or os.path.isfile(f + '.html') or os.path.isfile(os.path.join(f, 'index.html'))

bad = []
for dp, _, fs in os.walk(ROOT):
    for fn in fs:
        if not fn.endswith('.html') or fn.startswith('naver'): continue
        path = os.path.join(dp, fn); rel = '/' + os.path.relpath(path, ROOT).replace(os.sep, '/')
        base = rel.rsplit('/', 1)[0] + '/'
        src = open(path, encoding='utf-8').read()
        src = re.sub(r'<script\b[^>]*>(?!\s*</script>).*?</script>', '', src, flags=re.S)  # 인라인 스크립트 속 문자열은 빼고 본다
        for m in re.finditer(r'\b(?:href|src)="([^"]+)"', src):
            u = html.unescape(m.group(1))
            if re.match(r'^(?:[a-z]+:|//|#|\{|\$)', u, re.I) or '${' in u or "'+" in u: continue
            p = urlsplit(u).path
            if not p: continue
            if not p.startswith('/'): p = os.path.normpath(base + p).replace(os.sep, '/') + ('/' if p.endswith('/') else '')
            if not (exists(p) or redirected(p)): bad.append(f'{rel}: {u}')
for b in sorted(set(bad)): print('깨진 링크', b)
print(f'{len(set(bad))}개 깨진 링크')
sys.exit(1 if bad else 0)

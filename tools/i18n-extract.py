#!/usr/bin/env python3
"""페이지의 <script> 안 한국어 문자열·템플릿을 화면 텍스트 단위로 뽑는다.
템플릿의 ${...}는 {0},{1}... 로 바꾸고, HTML 태그 경계에서 자른다 (화면에서는 태그마다 텍스트 노드가 나뉘므로).
정적 HTML 본문의 텍스트도 함께 뽑는다. 결과: 한 줄에 키 하나 (JSON 배열)."""
import re, sys, json
H = re.compile('[가-힣]')

def scan(js):
    """JS에서 문자열/템플릿 리터럴 내용을 뽑는다. 템플릿은 (조각 리스트) 로, ${}는 None 자리표시."""
    out = []; i = 0; n = len(js)
    def skip_str(i, q):
        buf = []; i += 1
        while i < n and js[i] != q:
            if js[i] == '\\': buf.append(js[i:i+2]); i += 2; continue
            if js[i] == '\n': break
            buf.append(js[i]); i += 1
        return i + 1, ''.join(buf)
    def tmpl(i):
        # js[i] == '`'
        parts = []; buf = []; i += 1
        while i < n and js[i] != '`':
            if js[i] == '\\': buf.append(js[i+1]); i += 2; continue
            if js[i] == '$' and i + 1 < n and js[i+1] == '{':
                parts.append(''.join(buf)); buf = []; parts.append(None)
                i = expr(i + 2)
                continue
            buf.append(js[i]); i += 1
        parts.append(''.join(buf))
        out.append(('t', parts))
        return i + 1
    def expr(i):
        depth = 1
        while i < n:
            c = js[i]
            if c in '"\'':
                i, v = skip_str(i, c); out.append(('s', v)); continue
            if c == '`': i = tmpl(i); continue
            if c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0: return i + 1
            i += 1
        return i
    prev = ''
    while i < n:
        c = js[i]
        if js.startswith('//', i) and prev not in ('\\',):
            j = js.find('\n', i); i = n if j < 0 else j; continue
        if js.startswith('/*', i):
            j = js.find('*/', i); i = n if j < 0 else j + 2; continue
        if c in '"\'':
            i, v = skip_str(i, c); out.append(('s', v)); prev = c; continue
        if c == '`': i = tmpl(i); prev = c; continue
        prev = c; i += 1
    return out

TAG = re.compile(r'<[^>]*>')
ATTR = re.compile(r'(?:title|aria-label|placeholder|alt|data-l|data-label)\s*=\s*"([^"]*)"')
def segments(text):
    keys = []
    for a in ATTR.findall(text):
        if H.search(a): keys.append(a.strip())
    for seg in TAG.split(text):
        seg = seg.strip()
        if seg and H.search(seg): keys.append(seg)
    return keys

def from_template(parts):
    s = ''; k = 0
    for p in parts:
        if p is None: s += '\x00'
        else: s += p
    keys = []
    for seg in segments(s):
        idx = [0]
        def rep(m):
            r = '{%d}' % idx[0]; idx[0] += 1; return r
        keys.append(re.sub('\x00', rep, seg))
    # 태그 속성 안 ${}도 같은 방식
    return keys

def main(paths):
    """HTML은 본문과 인라인 <script>를, .js 파일(예: engine.js)은 파일 전체를 훑는다."""
    keys = []; codes = []
    for path in paths:
        src = open(path, encoding='utf-8').read()
        if path.endswith('.js'): codes.append(src); continue
        body = re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>|<!--[\s\S]*?-->', '', src)
        keys += segments(body)
        codes += [m.group(1) for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', src)]
    for code in codes:
        for kind, v in scan(code):
            if kind == 's':
                if H.search(v): keys += segments(v) if '<' in v else [v.strip()]
            else:
                if any(p and H.search(p) for p in v): keys += from_template(v)
    seen = set(); res = []
    for k in keys:
        k = re.sub(r'\s+', ' ', k).strip()
        if k and k not in seen: seen.add(k); res.append(k)
    for k in res: print(json.dumps(k, ensure_ascii=False))

if __name__ == '__main__': main(sys.argv[1:])

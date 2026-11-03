#!/usr/bin/env python3
"""번역표(TSV: 한국어\t日本語\tEnglish)를 ND.add / ND.pat 호출로 된 JS로 바꾼다.
{0},{1}… 자리가 있는 줄은 정규식 패턴이 되고, 나머지는 그대로 찾는 사전이 된다.
사용: i18n-build.py 번역표.tsv [덧붙일.js] > 출력.js"""
import sys, re, json
rows = []
for line in open(sys.argv[1], encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#'): continue
    k, ja, en = (line.split('\t') + ['', ''])[:3]
    rows.append((k, ja or None, en or None))
static = {}; pats = []
# "· 연대 중"처럼 앞에 가운뎃점이 붙은 조각은 화면에서 목록을 조각낼 때 점 없이도 찾을 수 있게 한 벌 더 넣는다
extra = []
for k, ja, en in rows:
    if k.startswith('· '):
        strip = lambda v: None if v is None else re.sub(r'^\s*[·・]\s*', '', v)
        extra.append((k[2:], strip(ja), strip(en)))
have = {r[0] for r in rows}
rows += [e for e in extra if e[0] not in have]
for k, ja, en in rows:
    if re.search(r'\{\d\}', k):
        parts = re.split(r'(\{\d\})', k)
        rx = ''.join('(.*?)' if re.fullmatch(r'\{\d\}', p) else re.escape(p).replace('/', '\\/') for p in parts)
        order = [int(p[1]) for p in parts if re.fullmatch(r'\{\d\}', p)]
        def rep(s):
            if s is None: return None
            return re.sub(r'\{(\d)\}', lambda m: '$%d' % (order.index(int(m.group(1))) + 1), s.replace('$', '$$'))
        weight = len(re.sub(r'\{\d\}', '', k))
        pats.append((weight, rx, rep(ja), rep(en)))
    else:
        static[k] = [ja, en]
pats.sort(key=lambda x: -x[0])
out = ['/* 자동 생성: tools/i18n-build.py ' + sys.argv[1].split('/')[-1] + ' — 직접 고치지 말고 번역표를 고친 뒤 다시 만든다 */',
       'ND.add(' + json.dumps(static, ensure_ascii=False, indent=0) + ');',
       'ND.pat([']
out.append(',\n'.join('[/^%s$/,%s,%s]' % (rx, json.dumps(ja, ensure_ascii=False), json.dumps(en, ensure_ascii=False)) for _, rx, ja, en in pats))
out.append(']);')
if len(sys.argv) > 2: out.append(open(sys.argv[2], encoding='utf-8').read())
print('\n'.join(out))

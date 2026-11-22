"""제1당 지도 만들기 공통 부분.

나라별 스크립트(build_<나라>.py)는 단위(시군구·시정촌·카운티·선거구 …)마다 아래 값을 모아 write() 에 넘긴다.
  id      단위 코드 (문자열, 나라 안에서 겹치지 않게)
  region  게임 지역 id (engine.js COUNTRIES.<나라>.regions)
  w       유권자 비중을 잴 값 (유효표 수 등)
  m       성향: 진보 쪽 득표 − 보수 쪽 득표 비율 (−1~1)
  names   [한국어, 日本語, English] 화면 이름
          또는 [이름, 묶음 키] — 이름이 세 언어에서 같을 때 (미국 카운티 등). 묶음(주·지방) 이름은 write(groups=)로 한 번만 적는다
  geom    GeoJSON geometry (평면 좌표). 지도에 그리지 않는 단위(재외국민 선거구 등)는 None

결과
  public/jeildang/maps/<나라>.js   화면용: SVG 경로·이름·출처 (그 나라 판을 열 때만 불러온다)
  public/jeildang/units.js         엔진용: 나라별 단위 표 (이 파일 안의 <나라> 항목만 바꾼다)
"""
import json, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))


def rings(g):
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        for ring in poly: yield ring


def write(country, units, credit, basis, width=1000, y_up=True, frames=None, digits=1, groups=None):
    """units: dict 목록. credit: [ko, ja, en] 출처 문구. basis: [ko, ja, en] 성향 기준 (예: 2022년 대선 기준). y_up: 입력 좌표의 y가 위로 커지면 True.
    frames: 지도에 그릴 보조선(예: 떨어진 섬을 옮겨 그린 칸) [[x0,y0,x1,y1], ...] (입력 좌표)"""
    xs, ys = [], []
    for u in units:
        if not u['geom']: continue
        for ring in rings(u['geom']):
            for x, y in ring: xs.append(x); ys.append(y)
    for f in frames or []:
        xs += [f[0], f[2]]; ys += [f[1], f[3]]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    k = width / (x1 - x0); H = round((y1 - y0) * k)
    q = 10 ** digits
    P = (lambda x, y: (round((x - x0) * k * q) / q, round((y1 - y) * k * q) / q)) if y_up else \
        (lambda x, y: (round((x - x0) * k * q) / q, round((y - y0) * k * q) / q))
    fmt = lambda v: ('%g' % v)

    def path(g):
        out = []
        for ring in rings(g):
            pts = [P(x, y) for x, y in ring]
            ded = [pts[0]] + [p for i, p in enumerate(pts[1:], 1) if p != pts[i - 1]]
            if len(ded) < 3: continue
            s = 'M%s %s' % (fmt(ded[0][0]), fmt(ded[0][1]))
            px, py = ded[0]
            for x, y in ded[1:]:
                s += 'l%s %s' % (fmt(round((x - px) * q) / q), fmt(round((y - py) * q) / q)); px, py = x, y
            out.append(s + 'z')
        return ''.join(out)

    M = {'w': width, 'h': H, 'paths': {}, 'names': {}, 'credit': credit, 'basis': basis}
    if groups: M['groups'] = groups   # {키: [한국어, 日本語, English]} — 화면은 '이름 (묶음)' 으로 보인다
    if frames:
        M['frames'] = []
        for f in frames:
            a, b = P(f[0], f[1]), P(f[2], f[3])
            M['frames'].append([min(a[0], b[0]), min(a[1], b[1]), abs(b[0] - a[0]), abs(b[1] - a[1])])
    for u in units:
        if u['geom']: M['paths'][u['id']] = path(u['geom'])
        M['names'][u['id']] = u['names']
    os.makedirs(os.path.join(ROOT, 'public/jeildang/maps'), exist_ok=True)
    with open(os.path.join(ROOT, 'public/jeildang/maps/%s.js' % country), 'w', encoding='utf-8') as o:
        o.write('// 제1당 %s 지도 (tools/jeildang/maps/build_%s.py 로 만든 파일, 손으로 고치지 않는다). 출처는 credit 항목과 tools/jeildang/MAPS.md\n' % (country, country))
        o.write('(function(r){var M=%s;if(typeof module!=="undefined"&&module.exports)module.exports=M;else (r.JD_MAPS=r.JD_MAPS||{}).%s=M})(this);\n'
                % (json.dumps(M, ensure_ascii=False, separators=(',', ':')), country))

    # 엔진용 표: 지역:코드,비중,성향;코드,비중,성향|지역:…   (비중은 나라 전체 10만분율)
    tot = sum(u['w'] for u in units)
    by = {}
    for u in units: by.setdefault(u['region'], []).append(u)
    def fm(v):
        t = ('%.3f' % v).rstrip('0').rstrip('.')
        t = re.sub(r'^(-?)0\.', r'\1.', t)
        return '0' if t in ('', '-', '-0') else t
    line = '|'.join(r + ':' + ';'.join('%s,%d,%s' % (u['id'], max(1, round(u['w'] / tot * 1e5)), fm(u['m'])) for u in us)
                    for r, us in by.items())
    upath = os.path.join(ROOT, 'public/jeildang/units.js')
    data = {}
    if os.path.exists(upath):
        m = re.search(r'var U=(\{.*?\});', open(upath, encoding='utf-8').read(), re.S)
        if m: data = json.loads(m.group(1))
    data[country] = line
    with open(upath, 'w', encoding='utf-8') as o:
        o.write('// 제1당 지도 단위 표 (tools/jeildang/maps/build_*.py 가 만든다. 손으로 고치지 않는다)\n')
        o.write('// 나라: "지역:코드,유권자 비중(10만분율),성향;…|지역:…". 성향은 진보 쪽 − 보수 쪽 득표 비율. 자세한 내용은 tools/jeildang/MAPS.md\n')
        o.write('(function(r){var U=%s;if(typeof module!=="undefined"&&module.exports)module.exports=U;else r.JD_UNITS=U})(this);\n'
                % json.dumps(dict(sorted(data.items())), ensure_ascii=False, separators=(',', ':')))
    print('%s: 단위 %d곳 (지도 %d곳), maps/%s.js %d KB, units %d KB' % (country, len(units), len(M['paths']), country,
          os.path.getsize(os.path.join(ROOT, 'public/jeildang/maps/%s.js' % country)) // 1024, len(line) // 1024))

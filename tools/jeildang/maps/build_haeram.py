#!/usr/bin/env python3
"""제1당 가상 해람 공화국 지도를 만든다. 실제 자료가 없으므로 섬 모양·시군구·성향을 시드값으로 생성한다.

  - 본섬 하나와 작은 섬 셋. 본섬을 점 약 170개의 보로노이 칸으로 나눠 시군구로 쓴다 (수도 근처는 칸을 촘촘하게)
  - 지역: 한별 수도권(서쪽 가운데 수도 둘레), 너른 신도시권(그 바깥 고리), 북방 접경(북쪽), 동해 공단(동쪽 해안),
          남녘 항만(남쪽 해안), 서들 농촌(서쪽·남서쪽 들판), 섬·산간(가운데 산지와 작은 섬들)
  - 성향: 이웃과 섞어 부드럽게 만든 무작위 값 (−0.35~0.35). 유권자 비중: 수도에 가까울수록 크다
  - 이름: 순우리말 음절을 이어 만든 가상의 지명 (영어는 로마자, 일본어는 가타카나)
사용: build_haeram.py [시드]
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import write
from hangul import rr, kana
from shapely.geometry import Point, Polygon, MultiPoint, mapping
from shapely.ops import voronoi_diagram, unary_union

seed = int(sys.argv[1]) if len(sys.argv) > 1 else 7
R = random.Random(seed)


def blob(cx, cy, r, waves, n=360):
    ph = [R.uniform(0, 2 * math.pi) for _ in waves]
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        k = 1 + sum(a * math.sin((j + 2) * t + ph[j]) for j, a in enumerate(waves))
        pts.append((cx + r * k * math.cos(t) * 1.1, cy + r * k * math.sin(t) * 1.35))
    return Polygon(pts).buffer(0)


main = blob(0, 0, 1.0, [.13, .09, .07, .05, .04, .03, .025, .02, .015, .012])
# 남동쪽 반도와 북서쪽 곶을 붙인다
main = unary_union([main, blob(.75, -.95, .38, [.15, .1, .06]), blob(-.8, .9, .3, [.15, .08, .05])]).buffer(.02).buffer(-.02)
islands = [blob(1.45, -1.05, .16, [.12, .08]), blob(-1.4, -.85, .12, [.1, .06]), blob(.2, -1.75, .1, [.1, .05])]

CAP = (-.35, .1); MOUNT = (.3, .3)
pts = []
while len(pts) < 190:
    x, y = R.uniform(-1.3, 1.3), R.uniform(-1.6, 1.6)
    if not main.contains(Point(x, y)): continue
    d = math.hypot(x - CAP[0], y - CAP[1])
    if R.random() < .12 + .88 * math.exp(-d * 3.2): pts.append((x, y))
cells = voronoi_diagram(MultiPoint(pts), envelope=main.envelope.buffer(.5))
units = []
for c in cells.geoms:
    g = c.intersection(main)
    if g.is_empty or g.area < 1e-4: continue
    units.append({'geom': g})
for isl in islands: units.append({'geom': isl, 'island': True})


def region(u):
    if u.get('island'): return 'seom'
    x, y = u['geom'].centroid.x, u['geom'].centroid.y
    d = math.hypot(x - CAP[0], y - CAP[1])
    if d < .28: return 'hanbyeol'
    if math.hypot(x - MOUNT[0], y - MOUNT[1]) < .3: return 'seom'
    if y > .95: return 'bukbang'
    if d < .62: return 'neoreun'
    if x > .55: return 'donghae'
    if y < -.6: return 'namnyeok'
    return 'seodeul'


for u in units:
    u['region'] = region(u)
    c = u['geom'].centroid; d = math.hypot(c.x - CAP[0], c.y - CAP[1])
    u['w'] = round(1000 * math.exp(-d * 1.6) * R.uniform(.6, 1.4) + 30)
    u['raw'] = R.gauss(0, .22)
# 이웃과 섞어 부드럽게
for u in units:
    nb = [v['raw'] for v in units if v is not u and v['geom'].distance(u['geom']) < 1e-6]
    u['m'] = max(-.35, min(.35, (u['raw'] + sum(nb)) / (1 + len(nb)) * 1.4))

# 이름: 순우리말 음절 두 개 + 시·군·구
A = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '하', '고', '노', '도', '모', '보', '소', '오', '조', '호', '구', '누', '두', '무', '부', '수', '우', '주', '새', '해', '달', '별', '솔', '들', '물', '불', '빛', '샘', '숲', '봄', '늘', '온', '한', '윤', '란', '린', '은', '금', '진', '연', '안']
used = set()
def name(urban):
    while True:
        n = R.choice(A) + R.choice(A)
        if n not in used and n[0] != n[1]: used.add(n); break
    suf = '구' if urban == 2 else '시' if urban == 1 else '군'
    return n, suf
SUF = {'구': ('gu', '区'), '시': ('si', '市'), '군': ('gun', '郡')}
GROUP = {'hanbyeol': ['한별 수도권', 'ハンビョル首都圏', 'Hanbyeol Capital'], 'neoreun': ['너른 신도시권', 'ノルン新都市圏', 'Neoreun New Towns'],
         'donghae': ['동해 공단', 'トンヘ工業地帯', 'Donghae Industrial'], 'namnyeok': ['남녘 항만', 'ナムニョク港湾', 'Namnyeok Ports'],
         'seodeul': ['서들 농촌', 'ソドゥル農村', 'Seodeul Farmland'], 'bukbang': ['북방 접경', '北方国境', 'Bukbang Border'],
         'seom': ['섬·산간', '島・山間', 'Islands & Highlands']}
out = []
for i, u in enumerate(sorted(units, key=lambda u: (-u['geom'].centroid.y, u['geom'].centroid.x))):
    urban = 2 if u['region'] == 'hanbyeol' else 1 if u['region'] in ('neoreun', 'namnyeok', 'donghae') and u['w'] > 250 else 0
    stem, suf = name(urban)
    ko = stem + suf
    en = rr(stem).capitalize() + '-' + SUF[suf][0]
    ja = kana(stem) + SUF[suf][1]
    out.append({'id': 'h%03d' % i, 'region': u['region'], 'w': u['w'], 'm': u['m'], 'names': [ko, ja, en], 'geom': mapping(u['geom'])})

from collections import Counter
print('지역별 칸 수', dict(Counter(u['region'] for u in out)))
write('haeram', out, ['가상의 나라입니다. 지도와 성향은 무작위로 만들었습니다.', '架空の国です。地図と傾向は無作為に作成しました。', 'A fictional country. The map and leanings are randomly generated.'],
      ['가상 자료', '架空のデータ', 'fictional data'], width=800)

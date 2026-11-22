#!/usr/bin/env python3
"""제1당 프랑스 모드 지도(데파르트망 101곳 + 지도 밖 해외 영토·재외국민 6곳)를 만든다.

입력 (내려받는 법은 tools/jeildang/MAPS.md):
  1. 경계: gregoiredavid/france-geojson 의 departements-avec-outre-mer.geojson
           (IGN Admin Express COG 2018, Licence Ouverte. 해외 데파르트망은 본토 옆으로 옮겨 그린 판)
  2. 2024년 총선 1차 투표 선거구별 득표: Uriopass/legislatives_2024_data 의 results_csv/*.csv (CC0, 내무부 발표 결과)
가공:
  - 하원 선거구(577곳) 경계는 출처·이용 조건이 분명한 자료가 없어, 선거구 결과를 데파르트망별로 합친다
  - 성향 = (좌파: UG·FI·SOC·COM·ECO·VEC·DVG·EXG − 우파: RN·UXD·LR·DVD·REC·EXD·DSV) ÷ 둘의 합. 중도(ENS·HOR·DVC·UDI 등)는 뺀다
    해외 영토의 지역주의(REG) 후보는 대부분 좌파 계열이라 좌파로 센다
  - 해외 데파르트망 5곳은 본토 왼쪽 아래 칸으로 줄여 옮겨 그린다
  - 데파르트망은 행정 레지옹대로 게임 7개 지역에 나눈다. 해외 영토·재외국민은 '해외 영토·재외' 지역(지도에는 해외 데파르트망 5곳만)
사용: build_fr.py departements-avec-outre-mer.geojson results_csv폴더
"""
import csv, glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import write

geo_path, res_dir = sys.argv[1], sys.argv[2].rstrip('/')
LEFT = {'UG', 'FI', 'SOC', 'COM', 'ECO', 'VEC', 'DVG', 'EXG', 'RDG'}
RIGHT = {'RN', 'UXD', 'LR', 'DVD', 'REC', 'EXD', 'DSV'}

REG = {}   # 데파르트망 → (행정 레지옹 키, 게임 지역)
def put(keys, rk, gid):
    for k in keys.split(): REG[k] = (rk, gid)
put('75 77 78 91 92 93 94 95', 'IDF', 'hanbyeol')
put('02 59 60 62 80', 'HDF', 'neoreun'); put('08 10 51 52 54 55 57 67 68 88', 'GES', 'neoreun'); put('21 25 39 58 70 71 89 90', 'BFC', 'neoreun')
put('22 29 35 56', 'BRE', 'donghae'); put('44 49 53 72 85', 'PDL', 'donghae'); put('14 27 50 61 76', 'NOR', 'donghae'); put('18 28 36 37 41 45', 'CVL', 'donghae')
put('16 17 19 23 24 33 40 47 64 79 86 87', 'NAQ', 'namnyeok'); put('09 11 12 30 31 32 34 46 48 65 66 81 82', 'OCC', 'namnyeok')
put('01 03 07 15 26 38 42 43 63 69 73 74', 'ARA', 'seodeul')
put('04 05 06 13 83 84', 'PAC', 'bukbang'); put('2A 2B', 'COR', 'bukbang')
put('971 972 973 974 976 975 986 987 988 ZX ZZ', 'OM', 'seom')
GROUP = {'IDF': ['일드프랑스', 'イル＝ド＝フランス', 'Île-de-France'], 'HDF': ['오드프랑스', 'オー＝ド＝フランス', 'Hauts-de-France'],
         'GES': ['그랑테스트', 'グラン・テスト', 'Grand Est'], 'BFC': ['부르고뉴프랑슈콩테', 'ブルゴーニュ＝フランシュ＝コンテ', 'Bourgogne-Franche-Comté'],
         'BRE': ['브르타뉴', 'ブルターニュ', 'Brittany'], 'PDL': ['페이드라루아르', 'ペイ・ド・ラ・ロワール', 'Pays de la Loire'],
         'NOR': ['노르망디', 'ノルマンディー', 'Normandy'], 'CVL': ['상트르발드루아르', 'サントル＝ヴァル・ド・ロワール', 'Centre-Val de Loire'],
         'NAQ': ['누벨아키텐', 'ヌーヴェル＝アキテーヌ', 'Nouvelle-Aquitaine'], 'OCC': ['옥시타니', 'オクシタニー', 'Occitanie'],
         'ARA': ['오베르뉴론알프', 'オーヴェルニュ＝ローヌ＝アルプ', 'Auvergne-Rhône-Alpes'],
         'PAC': ['프로방스알프코트다쥐르', 'プロヴァンス＝アルプ＝コート・ダジュール', "Provence-Alpes-Côte d'Azur"],
         'COR': ['코르스', 'コルス', 'Corsica'], 'OM': ['해외', '海外', 'Overseas']}
NOGEO = {'975': 'Saint-Pierre-et-Miquelon', '986': 'Wallis-et-Futuna', '987': 'Polynésie française', '988': 'Nouvelle-Calédonie',
         'ZX': 'Saint-Martin / Saint-Barthélemy', 'ZZ': 'Français établis hors de France'}

votes = {}
for f in glob.glob(res_dir + '/*.csv'):
    dep = os.path.basename(f).split('_')[0]
    a = votes.setdefault(dep, [0, 0, 0])
    for r in csv.DictReader(open(f, encoding='utf-8')):
        v = int(r['Voix'] or 0); a[2] += v
        # 해외에서는 지역주의(REG) 후보 대부분이 좌파 계열이라 좌파로 센다 (본토의 코르시카 자치주의는 뺀다)
        if r['Nuance'] in LEFT or (r['Nuance'] == 'REG' and dep[:2] in ('97', 'ZX')): a[0] += v
        elif r['Nuance'] in RIGHT: a[1] += v
# 결과 파일의 해외 코드 → 데파르트망 코드 (2024 결과는 971~976 그대로)
units = []
for f in json.load(open(geo_path))['features']:
    code, nom = f['properties']['code'], f['properties']['nom']
    l, r, t = votes[code]
    units.append({'id': code, 'region': REG[code][1], 'w': t, 'm': (l - r) / max(l + r, 1), 'names': [nom, REG[code][0]], 'geom': f['geometry']})
for code, nom in NOGEO.items():
    l, r, t = votes[code]
    units.append({'id': code, 'region': 'seom', 'w': t, 'm': (l - r) / max(l + r, 1), 'names': [nom, 'OM'], 'geom': None})
assert sum(u['w'] for u in units) == sum(v[2] for v in votes.values()), '빠진 결과가 있다'

# 위경도 → 평면 (위도 46.5도 기준)
import math
K = math.cos(math.radians(46.5))
def proj(g):
    def ring(rr): return [[x * K, y] for x, y in rr]
    if g['type'] == 'Polygon': return {'type': 'Polygon', 'coordinates': [ring(r) for r in g['coordinates']]}
    return {'type': 'MultiPolygon', 'coordinates': [[ring(r) for r in p] for p in g['coordinates']]}
for u in units:
    if u['geom']: u['geom'] = proj(u['geom'])

# 해외 데파르트망을 비스케이만 서쪽 빈 바다의 칸(가로 1.9, 세로 1.5, 평면 단위)에 맞춰 옮긴다
def pts(g):
    for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
        for ring in poly:
            for p in ring: yield p
def move(g, box):
    xs, ys = zip(*pts(g)); bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
    k = min((box[2] - box[0]) / (bx1 - bx0), (box[3] - box[1]) / (by1 - by0)) * .9
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2; ox, oy = (bx0 + bx1) / 2, (by0 + by1) / 2
    f = lambda p: [cx + (p[0] - ox) * k, cy + (p[1] - oy) * k]
    if g['type'] == 'Polygon': return {'type': 'Polygon', 'coordinates': [[f(p) for p in r] for r in g['coordinates']]}
    return {'type': 'MultiPolygon', 'coordinates': [[[f(p) for p in r] for r in poly] for poly in g['coordinates']]}
frames = []
for i, code in enumerate(['971', '972', '973', '974', '976']):
    x0 = -9.2 * K + (i % 2) * 2.0; y0 = 46.2 - (i // 2) * 1.7
    box = [x0, y0, x0 + 1.9, y0 + 1.5]; frames.append(box)
    u = next(u for u in units if u['id'] == code); u['geom'] = move(u['geom'], box)

write('fr', units, ['경계: IGN Admin Express(Licence Ouverte), gregoiredavid/france-geojson 가공 · 성향: 2024년 총선 1차 투표 득표(내무부, Uriopass/legislatives_2024_data, CC0) · 해외 데파르트망은 옮겨 그림',
                    '境界: IGN Admin Express（Licence Ouverte）、gregoiredavid/france-geojson 加工 · 傾向: 2024年総選挙 第1回投票の得票（内務省、Uriopass/legislatives_2024_data, CC0） · 海外県は移動して表示',
                    'Boundaries: IGN Admin Express (Licence Ouverte), processed by gregoiredavid/france-geojson · Leanings: 2024 legislative election first-round votes (Interior Ministry, Uriopass/legislatives_2024_data, CC0) · Overseas departments shown inset'],
      ['2024년 총선 1차 투표 기준', '2024年総選挙第1回投票基準', 'based on the 2024 legislative first round'], groups=GROUP, digits=1, frames=frames)

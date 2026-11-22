#!/usr/bin/env python3
"""제1당 영국 모드 지도(2024년 하원 선거구 650곳)를 만든다.

입력 (내려받는 법은 tools/jeildang/MAPS.md):
  1. 경계: 영국 통계청(ONS) Westminster Parliamentary Constituencies (July 2024) UK BUC 셰이프파일
     (Open Government Licence v3.0. Contains OS data © Crown copyright and database right 2024)
     → mapshaper 로 단순화한 GeoJSON (영국 국가 격자 좌표, 미터)
  2. 2024년 총선 선거구별 득표: 하원 도서관(House of Commons Library) 결과표 results.csv (Open Parliament Licence)
가공:
  - 성향 = (노동+자민+녹색+SNP+웨일스당 − 보수+리폼) ÷ 둘의 합. 북아일랜드는 (신페인+SDLP+연합당 − DUP+UUP) ÷ 둘의 합
  - 지방(region) 그대로 게임 7개 지역에 나눈다: 런던 75, 잉글랜드 남부(남동·남서·동부) 210, 미들랜드 104,
    잉글랜드 북부(북서·요크셔·북동) 154, 스코틀랜드 57, 웨일스 32, 북아일랜드 18
사용: build_uk.py uk.geojson results.csv
"""
import csv, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import write, write_targets

geo_path, res_path = sys.argv[1], sys.argv[2]
REGION = {'London': 'hanbyeol', 'South East': 'neoreun', 'South West': 'neoreun', 'East of England': 'neoreun',
          'East Midlands': 'donghae', 'West Midlands': 'donghae', 'North West': 'namnyeok', 'Yorkshire and The Humber': 'namnyeok',
          'North East': 'namnyeok', 'Scotland': 'seodeul', 'Wales': 'bukbang', 'Northern Ireland': 'seom'}
GROUP = {'London': ['런던', 'ロンドン', 'London'], 'South East': ['잉글랜드 남동부', 'イングランド南東部', 'South East'],
         'South West': ['잉글랜드 남서부', 'イングランド南西部', 'South West'], 'East of England': ['잉글랜드 동부', 'イングランド東部', 'East of England'],
         'East Midlands': ['이스트미들랜즈', 'イースト・ミッドランズ', 'East Midlands'], 'West Midlands': ['웨스트미들랜즈', 'ウェスト・ミッドランズ', 'West Midlands'],
         'North West': ['잉글랜드 북서부', 'イングランド北西部', 'North West'], 'Yorkshire and The Humber': ['요크셔 험버', 'ヨークシャー・アンド・ハンバー', 'Yorkshire'],
         'North East': ['잉글랜드 북동부', 'イングランド北東部', 'North East'], 'Scotland': ['스코틀랜드', 'スコットランド', 'Scotland'],
         'Wales': ['웨일스', 'ウェールズ', 'Wales'], 'Northern Ireland': ['북아일랜드', '北アイルランド', 'Northern Ireland']}
num = lambda r, k: float(r.get(k) or 0)

GAME = {'Lab': 'lab', 'Con': 'con', 'LD': 'ld', 'SNP': 'snp', 'RUK': 'reform', 'Green': 'green', 'PC': 'plaid'}
OTHER = ('DUP', 'SF', 'SDLP', 'UUP', 'APNI', 'All other candidates')
targets = {}
res = {}
for r in csv.DictReader(open(res_path, encoding='utf-8-sig')):
    t = targets.setdefault(REGION[r['Region name']], {})
    for k, gid in GAME.items(): t[gid] = t.get(gid, 0) + num(r, k)
    t['ind'] = t.get('ind', 0) + sum(num(r, k) for k in OTHER)
    if r['Country name'] == 'Northern Ireland':
        pro = num(r, 'SF') + num(r, 'SDLP') + num(r, 'APNI'); con = num(r, 'DUP') + num(r, 'UUP')
    else:
        pro = sum(num(r, k) for k in ('Lab', 'LD', 'Green', 'SNP', 'PC')); con = num(r, 'Con') + num(r, 'RUK')
    v = max(num(r, 'Valid votes'), 1)
    sh = {gid: num(r, k) / v for k, gid in GAME.items()}; sh['ind'] = sum(num(r, k) for k in OTHER) / v
    res[r['ONS ID']] = (pro, con, num(r, 'Valid votes'), r['Constituency name'], r['Region name'], sh)

units = []
for f in json.load(open(geo_path))['features']:
    p = f['properties']; cid = p['PCON24CD']
    pro, con, valid, name, region, sh = res[cid]
    units.append({'id': cid, 'region': REGION[region], 'w': valid, 'm': (pro - con) / max(pro + con, 1),
                  'names': [name, region], 'geom': f['geometry'], 'shares': sh})
assert len(units) == 650

write('uk', units, ['경계: 영국 통계청 ONS(Open Government Licence v3.0, OS 데이터 © Crown copyright and database right 2024) · 성향: 2024년 총선 선거구별 득표(하원 도서관, Open Parliament Licence)',
                    '境界: 英国国家統計局 ONS（Open Government Licence v3.0、OS データ © Crown copyright and database right 2024） · 傾向: 2024年総選挙 選挙区別得票（庶民院図書館、Open Parliament Licence）',
                    'Boundaries: Office for National Statistics (Open Government Licence v3.0; contains OS data © Crown copyright and database right 2024) · Leanings: 2024 general election results by constituency (House of Commons Library, Open Parliament Licence)'],
      ['2024년 총선 기준', '2024年総選挙基準', 'based on the 2024 general election'], groups=GROUP, width=700)
for r, d in targets.items():
    tot = sum(d.values()); targets[r] = {k: v / tot for k, v in d.items()}
write_targets('uk', targets)

#!/usr/bin/env python3
"""제1당 미국 모드 지도(카운티 약 3,140곳)를 만든다.

입력 (내려받는 법은 tools/jeildang/MAPS.md):
  1. 경계: us-atlas@3 의 counties-albers-10m.json (미국 인구조사국 지도를 앨버스 투영, 알래스카·하와이를 옮겨 그림. 퍼블릭 도메인)
     → mapshaper 로 GeoJSON 으로 바꾼 파일
  2. 2024년 대선 카운티별 득표: tonmcg/US_County_Level_Election_Results_08-24 의 2024_US_County_Level_Presidential_Results.csv (MIT)
가공:
  - 성향 = (해리스 − 트럼프) ÷ 둘의 합
  - 주는 2020년 하원 의석 배분 그대로 게임 7개 지역에 나눈다 (북동부 76, 오대호 62, 중부 평원 29, 남동부 85, 중남부 79, 태평양 71, 산악 33)
  - 알래스카(결과가 주 하원 선거구 단위)와 코네티컷(2022년 카운티 → 계획 지역 개편)은 주 전체 결과를 카운티에 고르게 나눈다
  - 워싱턴 D.C.는 하원 투표권이 없어 뺀다
사용: build_us.py counties.geojson results.csv  (GeoJSON 은 속성 fips 에 카운티 코드)
"""
import csv, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import write

geo_path, res_path = sys.argv[1], sys.argv[2]

# 주 FIPS → (약자, 한국어, 日本語, 게임 지역)
ST = {
    '09': ('CT', '코네티컷', 'コネチカット', 'hanbyeol'), '23': ('ME', '메인', 'メイン', 'hanbyeol'), '25': ('MA', '매사추세츠', 'マサチューセッツ', 'hanbyeol'),
    '33': ('NH', '뉴햄프셔', 'ニューハンプシャー', 'hanbyeol'), '34': ('NJ', '뉴저지', 'ニュージャージー', 'hanbyeol'), '36': ('NY', '뉴욕', 'ニューヨーク', 'hanbyeol'),
    '42': ('PA', '펜실베이니아', 'ペンシルベニア', 'hanbyeol'), '44': ('RI', '로드아일랜드', 'ロードアイランド', 'hanbyeol'), '50': ('VT', '버몬트', 'バーモント', 'hanbyeol'),
    '17': ('IL', '일리노이', 'イリノイ', 'neoreun'), '18': ('IN', '인디애나', 'インディアナ', 'neoreun'), '26': ('MI', '미시간', 'ミシガン', 'neoreun'),
    '39': ('OH', '오하이오', 'オハイオ', 'neoreun'), '55': ('WI', '위스콘신', 'ウィスコンシン', 'neoreun'),
    '19': ('IA', '아이오와', 'アイオワ', 'donghae'), '20': ('KS', '캔자스', 'カンザス', 'donghae'), '27': ('MN', '미네소타', 'ミネソタ', 'donghae'),
    '29': ('MO', '미주리', 'ミズーリ', 'donghae'), '31': ('NE', '네브래스카', 'ネブラスカ', 'donghae'), '38': ('ND', '노스다코타', 'ノースダコタ', 'donghae'),
    '46': ('SD', '사우스다코타', 'サウスダコタ', 'donghae'),
    '10': ('DE', '델라웨어', 'デラウェア', 'namnyeok'), '12': ('FL', '플로리다', 'フロリダ', 'namnyeok'), '13': ('GA', '조지아', 'ジョージア', 'namnyeok'),
    '24': ('MD', '메릴랜드', 'メリーランド', 'namnyeok'), '37': ('NC', '노스캐롤라이나', 'ノースカロライナ', 'namnyeok'), '45': ('SC', '사우스캐롤라이나', 'サウスカロライナ', 'namnyeok'),
    '51': ('VA', '버지니아', 'バージニア', 'namnyeok'), '54': ('WV', '웨스트버지니아', 'ウェストバージニア', 'namnyeok'),
    '01': ('AL', '앨라배마', 'アラバマ', 'seodeul'), '05': ('AR', '아칸소', 'アーカンソー', 'seodeul'), '21': ('KY', '켄터키', 'ケンタッキー', 'seodeul'),
    '22': ('LA', '루이지애나', 'ルイジアナ', 'seodeul'), '28': ('MS', '미시시피', 'ミシシッピ', 'seodeul'), '40': ('OK', '오클라호마', 'オクラホマ', 'seodeul'),
    '47': ('TN', '테네시', 'テネシー', 'seodeul'), '48': ('TX', '텍사스', 'テキサス', 'seodeul'),
    '02': ('AK', '알래스카', 'アラスカ', 'bukbang'), '06': ('CA', '캘리포니아', 'カリフォルニア', 'bukbang'), '15': ('HI', '하와이', 'ハワイ', 'bukbang'),
    '41': ('OR', '오리건', 'オレゴン', 'bukbang'), '53': ('WA', '워싱턴', 'ワシントン', 'bukbang'),
    '04': ('AZ', '애리조나', 'アリゾナ', 'seom'), '08': ('CO', '콜로라도', 'コロラド', 'seom'), '16': ('ID', '아이다호', 'アイダホ', 'seom'),
    '30': ('MT', '몬태나', 'モンタナ', 'seom'), '32': ('NV', '네바다', 'ネバダ', 'seom'), '35': ('NM', '뉴멕시코', 'ニューメキシコ', 'seom'),
    '49': ('UT', '유타', 'ユタ', 'seom'), '56': ('WY', '와이오밍', 'ワイオミング', 'seom'),
}

res, state = {}, {}
for r in csv.DictReader(open(res_path, encoding='utf-8')):
    f = r['county_fips'].zfill(5)
    d, g, t = float(r['votes_dem']), float(r['votes_gop']), float(r['total_votes'])
    res[f] = (d, g, t, r['county_name'])
    s = state.setdefault(f[:2], [0, 0, 0]); s[0] += d; s[1] += g; s[2] += t

geo = json.load(open(geo_path))['features']
# 결과가 없는 카운티(알래스카·코네티컷 등)는 주 결과를 그 주의 빈 카운티 수로 나눈다
missing = {}
for f in geo:
    fid = f['properties']['fips']
    if fid[:2] in ST and fid not in res: missing.setdefault(fid[:2], []).append(fid)

units = []
for f in geo:
    fid = f['properties']['fips']
    st = fid[:2]
    if st not in ST: continue                                    # D.C. 등
    ab, ko, ja, region = ST[st]
    name = f['properties'].get('name', fid)
    if fid in res:
        d, g, t, nm = res[fid]
    else:
        sd, sg, stt = state[st]; n = len(missing[st])
        d, g, t, nm = sd / n, sg / n, stt / n, name + (' Borough' if st == '02' else ' County')
    units.append({'id': fid, 'region': region, 'w': max(t, 1), 'm': (d - g) / max(d + g, 1),
                  'names': [nm, ab], 'geom': f['geometry']})

write('us', units, ['경계: 미국 인구조사국(us-atlas, 퍼블릭 도메인) · 성향: 2024년 대선 카운티별 득표(tonmcg/US_County_Level_Election_Results_08-24, MIT) · 알래스카·하와이는 옮겨 그림',
                    '境界: 米国国勢調査局（us-atlas、パブリックドメイン） · 傾向: 2024年大統領選 郡別得票（tonmcg/US_County_Level_Election_Results_08-24, MIT） · アラスカ・ハワイは移動して表示',
                    'Boundaries: US Census Bureau (us-atlas, public domain) · Leanings: 2024 presidential vote by county (tonmcg/US_County_Level_Election_Results_08-24, MIT) · Alaska and Hawaii shown inset'],
      ['2024년 대선 기준', '2024年大統領選基準', 'based on the 2024 presidential election'], y_up=False,
      groups={v[0]: [v[1], v[2] + '州', v[0]] for v in ST.values()})

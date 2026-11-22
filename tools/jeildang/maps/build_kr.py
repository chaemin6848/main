#!/usr/bin/env python3
"""제1당 한국 모드 지도(제22대 국회의원선거 지역구 254곳)를 만든다.

입력 (내려받는 법은 tools/jeildang/MAPS.md):
  1. 선거구 경계: OhmyNews/2024_22_elec_map 의 2024_22_Elec_simplify.json
     (통계청 행정동 경계를 254개 선거구로 합친 것, MIT. 원자료는 공공누리 제1유형)
  2. 2024년 4월 10일 22대 총선 지역구 후보별 득표: YangSeungWon/polis-korea 의 data/results/22nd-general-2024.json
     (중앙선거관리위원회 공공데이터 OpenAPI 결과를 정리한 것)
가공:
  - 성향 = (민주·진보·녹색정의·새로운미래 계열 − 국민의힘·개혁신당·자유통일 계열) ÷ 둘의 합 (지역구 후보 득표)
  - 지역구 하나가 의석 하나다. 엔진은 한국을 지역구마다 1위가 1석을 가지는 소선거구제로 계산한다
  - 지역별 정당 득표율(지역구 후보 득표 합)을 판 시작 판세의 목표로 units.js 의 _targets 에 넣는다
이름: 한국어는 '시도 선거구 약칭', 영어는 로마자 표기법 + A/B/C, 일본어는 시도 한자 + 가타카나 + 甲乙丙
사용: build_kr.py 2024_22_Elec_simplify.json 22nd-general-2024.json
"""
import json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hangul import rr, kana
from common import write, write_targets

geo_path, res_path = sys.argv[1], sys.argv[2]
REGION = {'서울': 'hanbyeol', '경기': 'neoreun', '인천': 'neoreun', '부산': 'donghae', '울산': 'donghae', '경남': 'donghae',
          '대구': 'namnyeok', '경북': 'namnyeok', '광주': 'seodeul', '전북': 'seodeul', '전남': 'seodeul',
          '대전': 'bukbang', '세종': 'bukbang', '충북': 'bukbang', '충남': 'bukbang', '강원': 'seom', '제주': 'seom'}
SHORT = {'서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전',
         '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남',
         '전북특별자치도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남', '제주특별자치도': '제주'}
SIDO_EN = {'서울': 'Seoul', '부산': 'Busan', '대구': 'Daegu', '인천': 'Incheon', '광주': 'Gwangju', '대전': 'Daejeon', '울산': 'Ulsan',
           '세종': 'Sejong', '경기': 'Gyeonggi', '강원': 'Gangwon', '충북': 'N. Chungcheong', '충남': 'S. Chungcheong', '전북': 'N. Jeolla',
           '전남': 'S. Jeolla', '경북': 'N. Gyeongsang', '경남': 'S. Gyeongsang', '제주': 'Jeju'}
SIDO_JA = {'서울': 'ソウル', '부산': '釜山', '대구': '大邱', '인천': '仁川', '광주': '光州', '대전': '大田', '울산': '蔚山', '세종': '世宗',
           '경기': '京畿', '강원': '江原', '충북': '忠北', '충남': '忠南', '전북': '全北', '전남': '全南', '경북': '慶北', '경남': '慶南', '제주': '済州'}
PROG = {'더불어민주당', '진보당', '녹색정의당', '새로운미래', '조국혁신당', '노동당', '정의당'}
CONS = {'국민의힘', '개혁신당', '자유통일당', '내일로미래로', '우리공화당'}
ORD = {'갑': ('A', '甲'), '을': ('B', '乙'), '병': ('C', '丙'), '정': ('D', '丁'), '무': ('E', '戊')}
SUF = {'시': ('si', '市'), '군': ('gun', '郡'), '구': ('gu', '区')}
norm = lambda s: re.sub('[시군구]', '', s).replace('세종특별자치', '세종')


def names(sd, full):
    """'중구성동구갑' → 영어 'Jung-gu Seongdong-gu A (Seoul)', 일본어 'ソウル チュン区ソンドン区甲'"""
    if sd == '세종': full = full.replace('세종특별자치시', '세종시')
    m = re.fullmatch(r'(.*?)([갑을병정무]?)', full); body, o = m.group(1), m.group(2)
    parts = re.findall(r'.+?[시군구]', body) or [body]
    en = ' '.join(rr(p[:-1]).capitalize() + '-' + SUF[p[-1]][0] for p in parts)
    ja = ''.join(kana(p[:-1]) + SUF[p[-1]][1] for p in parts)
    if o: en += ' ' + ORD[o][0]; ja += ORD[o][1]
    return en + ' (' + SIDO_EN[sd] + ')', SIDO_JA[sd] + ' ' + ja


# 게임 정당 id (그 밖의 당·무소속은 ind)
GAME = {'더불어민주당': 'dem', '국민의힘': 'ppp', '조국혁신당': 'rebuild', '진보당': 'jinbo', '개혁신당': 'reform'}
targets = {}
res = {}
for r in json.load(open(res_path, encoding='utf-8'))['races']:
    if r['scope'] == 'district':
        t = targets.setdefault(REGION[SHORT[r['sido']]], {})
        for c in r['candidates']:
            k = GAME.get(c['party'], 'ind'); t[k] = t.get(k, 0) + c['votes']
    if r['scope'] != 'district': continue
    sd = SHORT[r['sido']]
    pro = sum(c['votes'] for c in r['candidates'] if c['party'] in PROG)
    con = sum(c['votes'] for c in r['candidates'] if c['party'] in CONS)
    sh = {}
    for c in r['candidates']: k = GAME.get(c['party'], 'ind'); sh[k] = sh.get(k, 0) + c['votes'] / max(r['valid_votes'], 1)
    res[(sd, norm(r['district']))] = (pro, con, r['valid_votes'], r['district'], sh)

# 위경도 → 평면 (위도 36.5도 기준). 1.5km² 보다 작은 섬은 지운다(독도는 남긴다)
K = math.cos(math.radians(36.5))
def proj(g):
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    out = []
    for poly in polys:
        ring = poly[0]
        xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
        area = 0.5 * abs(sum(xs[i] * ys[i + 1] - xs[i + 1] * ys[i] for i in range(len(ring) - 1))) * 111.32 * 110.57 * K
        if area < 1.5 and not (min(xs) > 131.5): continue
        out.append([[[x * K, y] for x, y in ring]])
    if not out:   # 작은 섬만 있으면 가장 큰 것 하나
        out = [[[[x * K, y] for x, y in max(polys, key=lambda p: len(p[0]))[0]]]]
    return {'type': 'MultiPolygon', 'coordinates': out}


units = []
for f in sorted(json.load(open(geo_path, encoding='utf-8'))['features'], key=lambda f: f['properties']['SGG_Code']):
    p = f['properties']; sd = p['SIDO']
    pro, con, valid, full, sh = res[(sd, norm(p['SGG']))]
    en, ja = names(sd, full)
    units.append({'id': p['SGG_Code'], 'region': REGION[sd], 'w': valid, 'm': (pro - con) / max(pro + con, 1),
                  'names': [p['SIDO_SGG'], ja, en], 'geom': proj(f['geometry']), 'shares': sh})
assert len(units) == 254
write('kr', units, ['경계: 오마이뉴스 22대 총선 선거구 지도(통계청 행정동 경계 기반, MIT) · 성향: 2024년 22대 총선 지역구 득표(중앙선거관리위원회)',
                    '境界: オーマイニュース第22代総選挙選挙区地図（韓国統計庁の行政洞境界に基づく、MIT） · 傾向: 2024年第22代総選挙 選挙区得票（中央選挙管理委員会）',
                    'Boundaries: OhmyNews 22nd general election district map (from Statistics Korea boundaries, MIT) · Leanings: 2024 general election district votes (NEC)'],
      ['2024년 22대 총선 기준', '2024年第22代総選挙基準', 'based on the 2024 general election'])
for r, d in targets.items():
    tot = sum(d.values()); targets[r] = {k: v / tot for k, v in d.items()}
write_targets('kr', targets)

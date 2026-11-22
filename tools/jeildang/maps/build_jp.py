#!/usr/bin/env python3
"""제1당 일본 모드 지도(시정촌·정령시 행정구 약 1,890곳)를 만든다.

입력 (내려받는 법은 tools/jeildang/MAPS.md):
  1. 경계: smartnews-smri/japan-topography 의 data/municipality/geojson/s0010/N03-21_210101.json
           (국토교통성 국토수치정보 행정구역 2021년 1월 1일, 1% 단순화)
  2. 2024년 중의원 선거 비례대표 시정촌별 득표: yhoriuchi/jelec2024lh 의 output/pr_data.csv (MIT)
가공:
  - 성향 = (입헌민주+공산+레이와+사민 − 자민+공명+참정+일본보수) ÷ 둘의 합
  - 하마마쓰시는 2024년에 구가 재편돼 시 전체를 한 단위로 묶는다
  - 표가 없는 곳(북방 영토 마을, 소속 미정지)은 뺀다
  - 독도(일본 자료의 '다케시마', 시마네현 오키노시마정에 들어 있음)는 그리지 않는다
  - 오키나와현과 아마미 제도는 동해 북쪽 빈 바다로 옮겨 그리고 점선 칸을 두른다. 오가사와라 등 먼 섬은 그리지 않는다(단위는 남는다)
  - 시정촌 이름의 한국어·영어 표기는 pykakasi 자동 독음이라 틀린 곳이 있을 수 있다. 도도부현은 표로 적는다
사용: MAPSHAPER=mapshaper경로 build_jp.py N03-21_210101.json pr_data.csv 작업폴더
"""
import csv, json, math, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import write
from hangul import kana2hangul, hepburn_simple
from shapely.geometry import mapping, Polygon
from shapely.ops import unary_union
import pykakasi

geo_path, pr_path, work = sys.argv[1], sys.argv[2], sys.argv[3]
KK = pykakasi.kakasi()

REGION = {}
for pref in ['東京都']: REGION[pref] = 'hanbyeol'
for pref in ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '神奈川県']: REGION[pref] = 'neoreun'
for pref in ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県']: REGION[pref] = 'donghae'
for pref in ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県']: REGION[pref] = 'namnyeok'
for pref in ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県']: REGION[pref] = 'seodeul'
for pref in ['鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県']: REGION[pref] = 'bukbang'
for pref in ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']: REGION[pref] = 'seom'

# 도도부현 이름은 자동 독음 대신 표로 적는다 (한국어 표기·영어 표기)
PREFS = ('北海道 홋카이도 Hokkaido|青森県 아오모리현 Aomori|岩手県 이와테현 Iwate|宮城県 미야기현 Miyagi|秋田県 아키타현 Akita|山形県 야마가타현 Yamagata|'
         '福島県 후쿠시마현 Fukushima|茨城県 이바라키현 Ibaraki|栃木県 도치기현 Tochigi|群馬県 군마현 Gunma|埼玉県 사이타마현 Saitama|千葉県 지바현 Chiba|'
         '東京都 도쿄도 Tokyo|神奈川県 가나가와현 Kanagawa|新潟県 니가타현 Niigata|富山県 도야마현 Toyama|石川県 이시카와현 Ishikawa|福井県 후쿠이현 Fukui|'
         '山梨県 야마나시현 Yamanashi|長野県 나가노현 Nagano|岐阜県 기후현 Gifu|静岡県 시즈오카현 Shizuoka|愛知県 아이치현 Aichi|三重県 미에현 Mie|'
         '滋賀県 시가현 Shiga|京都府 교토부 Kyoto|大阪府 오사카부 Osaka|兵庫県 효고현 Hyogo|奈良県 나라현 Nara|和歌山県 와카야마현 Wakayama|'
         '鳥取県 돗토리현 Tottori|島根県 시마네현 Shimane|岡山県 오카야마현 Okayama|広島県 히로시마현 Hiroshima|山口県 야마구치현 Yamaguchi|'
         '徳島県 도쿠시마현 Tokushima|香川県 가가와현 Kagawa|愛媛県 에히메현 Ehime|高知県 고치현 Kochi|福岡県 후쿠오카현 Fukuoka|佐賀県 사가현 Saga|'
         '長崎県 나가사키현 Nagasaki|熊本県 구마모토현 Kumamoto|大分県 오이타현 Oita|宮崎県 미야자키현 Miyazaki|鹿児島県 가고시마현 Kagoshima|沖縄県 오키나와현 Okinawa')
PREF_KO, PREF_EN = {}, {}
for x in PREFS.split('|'):
    j, k, e = x.split(' '); PREF_KO[j] = k; PREF_EN[j] = e
assert set(PREF_KO) == set(REGION)

PROG = {'立憲民主党', '日本共産党', 'れいわ新選組', 'れいわ\n新選組', '社会民主党'}
CONS = {'自由民主党', '公明党', '参政党', '日本保守党'}


def norm(s):
    s = re.sub(r'[\s　]', '', s); s = re.sub(r'第[０-９0-9]+区$', '', s)
    s = s.replace('鯵', '鰺').replace('ケ', 'ヶ').replace('檮', '梼').replace('佐伯氏', '佐伯市')
    if s.startswith('浜松市'): s = '浜松市'
    return s


votes = {}
for r in csv.DictReader(open(pr_path, encoding='utf-8-sig')):
    if '合計' in r['municipality']: continue
    k = (r['prefecture'], norm(r['municipality']))
    a = votes.setdefault(k, [0.0, 0.0, 0.0])
    v = float(r['votes'] or 0)
    a[2] += v
    if r['parties'] in PROG: a[0] += v
    elif r['parties'] in CONS: a[1] += v

# --- 경계: 위경도 → 평면(km, 가로는 위도 36도 기준으로 줄임), 오키나와 옮기기
LAT0 = 36.0; CX = math.cos(math.radians(LAT0)) * 111.32; CY = 110.57
OKI = (5.6, 16.6)   # 오키나와를 옮기는 양 (경도, 위도)
proj = lambda lon, lat: (lon * CX, lat * CY)


def transform(geom, pref):
    polys = []
    for poly in (geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]):
        ring = poly[0]
        lon = sum(p[0] for p in ring) / len(ring); lat = sum(p[1] for p in ring) / len(ring)
        if pref == '島根県' and lon > 131.6: continue                 # 독도
        if lat < 30.5 and lon > 134: continue                       # 오가사와라·오키노토리·미나미토리
        if pref == '沖縄県' and lon > 130: continue                  # 다이토 제도 (칸이 너무 커진다)
        # 오키나와현과 가고시마현 아마미 제도(북위 29도 아래)를 함께 옮긴다
        dx, dy = OKI if pref == '沖縄県' or (pref == '鹿児島県' and lat < 29.0) else (0, 0)
        polys.append(Polygon([proj(x + dx, y + dy) for x, y in ring]).buffer(0))
    return unary_union(polys) if polys else None


g = json.load(open(geo_path))
units = {}
for f in g['features']:
    p = f['properties']; pref = p['N03_001']
    city = p['N03_003'] or ''
    nm = city + (p['N03_004'] or '') if city.endswith('市') else (p['N03_004'] or '')
    key = (pref, norm(nm))
    if key not in votes: continue                                   # 북방 영토 마을·소속 미정지
    uid = '22130' if key == ('静岡県', '浜松市') else p['N03_007']
    geom = transform(f['geometry'], pref)
    u = units.setdefault(uid, {'key': key, 'pref': pref, 'city': city if city.endswith('市') else '', 'ward': p['N03_004'] or '', 'geoms': []})
    if uid == '22130': u['city'], u['ward'] = '', '浜松市'
    if geom is not None and not geom.is_empty: u['geoms'].append(geom)

# mapshaper 로 단순화 (이웃끼리 경계를 공유해 틈이 생기지 않는다)
os.makedirs(work, exist_ok=True)
fc = {'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'properties': {'id': uid}, 'geometry': mapping(unary_union(u['geoms']))} for uid, u in units.items() if u['geoms']]}
json.dump(fc, open(os.path.join(work, 'jp-in.json'), 'w'))
ms = os.environ.get('MAPSHAPER', 'mapshaper')
subprocess.run([ms, '-i', os.path.join(work, 'jp-in.json'), '-simplify', '6%', 'keep-shapes', 'planar',
                '-filter-islands', 'min-area=0.5', '-o', os.path.join(work, 'jp-out.json'), 'format=geojson', 'precision=0.01'], check=True)
simp = {f['properties']['id']: f['geometry'] for f in json.load(open(os.path.join(work, 'jp-out.json')))['features']}


# 자동 독음이 틀리는 곳 (찾을 때마다 더한다)
FIX = {'鹿児島': 'かごしま', '豊田': 'とよた', '豊島': 'としま'}
def reading(kanji):
    if kanji in FIX:
        h = FIX[kanji]; return h, ''.join(x['hepburn'] for x in KK.convert(h))
    r = KK.convert(kanji)
    return ''.join(x['hira'] for x in r), ''.join(x['hepburn'] for x in r)


SUF_KO = {'市': '시', '区': '구', '町': '정', '村': '촌'}
def part(name):
    stem, suf = name[:-1], name[-1]
    h, e = reading(stem)
    return kana2hangul(h) + SUF_KO.get(suf, ''), hepburn_simple(e).capitalize()


out = []
for uid, u in sorted(units.items()):
    pro, con, tot = votes[u['key']]
    if u['city'] and u['ward']:                    # 정령시 행정구
        c, w = part(u['city']), part(u['ward'])
        ko, en, ja = c[0] + ' ' + w[0], c[1] + ' (' + w[1] + '-ku)', u['city'] + u['ward']
    else:
        nm = u['city'] or u['ward']
        ko, en = part(nm); ja = nm
    out.append({'id': uid, 'region': REGION[u['pref']], 'w': tot, 'm': (pro - con) / max(pro + con, 1),
                'names': [ko + ' (' + PREF_KO[u['pref']] + ')', ja + '（' + u['pref'] + '）', en + ', ' + PREF_EN[u['pref']]],
                'geom': simp.get(uid)})

# 오키나와 칸 (옮긴 좌표 기준)
x0, y0 = proj(122.8 + OKI[0], 23.9 + OKI[1]); x1, y1 = proj(130.2 + OKI[0], 29.0 + OKI[1])
write('jp', out, ['경계: 국토교통성 국토수치정보(행정구역)를 가공(smartnews-smri/japan-topography) · 성향: 2024년 중의원 선거 비례대표 시정촌별 득표(yhoriuchi/jelec2024lh, MIT) · 오키나와는 옮겨 그림',
                  '境界: 国土交通省 国土数値情報（行政区域）を加工（smartnews-smri/japan-topography） · 傾向: 2024年衆院選 比例代表 市区町村別得票（yhoriuchi/jelec2024lh, MIT） · 沖縄は移動して表示',
                  'Boundaries: MLIT National Land Numerical Information (administrative areas), processed by smartnews-smri/japan-topography · Leanings: 2024 House of Representatives PR votes by municipality (yhoriuchi/jelec2024lh, MIT) · Okinawa shown inset'],
      ['2024년 중의원 선거 비례대표 기준', '2024年衆院選比例代表基準', 'based on 2024 general election PR votes'],
      frames=[[x0, y0, x1, y1]])

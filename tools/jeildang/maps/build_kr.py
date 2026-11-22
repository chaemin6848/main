#!/usr/bin/env python3
"""제1당 한국 모드 지도(시군구 250곳)를 만든다.

입력 (내려받는 법은 tools/jeildang/MAPS.md):
  1. 시군구 경계  : admdongkor 의 parquet/sgg_20220309.parquet 를 GeoJSON 으로 바꾸고
                    mapshaper 로 단순화한 파일 (EPSG:5179, 미터 단위)
  2. 2022년 대선  : presidentialElection2022SouthKoreaEmdmap 의 data.csv · gu.csv · sido.csv
출력: public/jeildang/maps/kr.js, public/jeildang/units.js 의 kr 항목 (common.py)
이름: 영어는 로마자 표기법, 일본어는 시도 한자 + 가타카나

사용: build_kr.py 단순화.geojson 대선자료_폴더
"""
import csv, json, sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hangul import rr, kana
from common import write

geo_path, src = sys.argv[1], sys.argv[2].rstrip('/') + '/'
REGION = {  # 시도 → 게임 지역 (engine.js COUNTRIES.kr.regions)
    '서울특별시': 'hanbyeol',
    '경기도': 'neoreun', '인천광역시': 'neoreun',
    '부산광역시': 'donghae', '울산광역시': 'donghae', '경상남도': 'donghae',
    '대구광역시': 'namnyeok', '경상북도': 'namnyeok',
    '광주광역시': 'seodeul', '전라북도': 'seodeul', '전라남도': 'seodeul',
    '대전광역시': 'bukbang', '세종특별자치시': 'bukbang', '충청북도': 'bukbang', '충청남도': 'bukbang',
    '강원도': 'seom', '제주특별자치도': 'seom',
}
SHORT = {'서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '광주광역시': '광주',
         '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기', '강원도': '강원',
         '충청북도': '충북', '충청남도': '충남', '전라북도': '전북', '전라남도': '전남', '경상북도': '경북',
         '경상남도': '경남', '제주특별자치도': '제주'}

SIDO_EN = {'서울': 'Seoul', '부산': 'Busan', '대구': 'Daegu', '인천': 'Incheon', '광주': 'Gwangju', '대전': 'Daejeon', '울산': 'Ulsan',
           '세종': 'Sejong', '경기': 'Gyeonggi', '강원': 'Gangwon', '충북': 'N. Chungcheong', '충남': 'S. Chungcheong', '전북': 'N. Jeolla',
           '전남': 'S. Jeolla', '경북': 'N. Gyeongsang', '경남': 'S. Gyeongsang', '제주': 'Jeju'}
SIDO_JA = {'서울': 'ソウル', '부산': '釜山', '대구': '大邱', '인천': '仁川', '광주': '光州', '대전': '大田', '울산': '蔚山', '세종': '世宗',
           '경기': '京畿', '강원': '江原', '충북': '忠北', '충남': '忠南', '전북': '全北', '전남': '全南', '경북': '慶北', '경남': '慶南', '제주': '済州'}
SUF = {'시': ('si', '市'), '군': ('gun', '郡'), '구': ('gu', '区')}
def part(w):
    stem, suf = w[:-1], w[-1]
    return rr(stem).capitalize() + '-' + SUF[suf][0], kana(stem) + SUF[suf][1]
def names(sido_short, sgg):
    if sido_short == '세종': return 'Sejong', '世宗市'
    m = re.fullmatch(r'(.+시)(.+구)', sgg)
    ps = [part(m.group(1)), part(m.group(2))] if m else [part(sgg)]
    return ' '.join(p[0] for p in ps) + ' (' + SIDO_EN[sido_short] + ')', SIDO_JA[sido_short] + ' ' + ''.join(p[1] for p in ps)

rd = lambda f: list(csv.DictReader(open(src + f, encoding='utf-8-sig')))
sido = {r['sido_cd']: r['sido_nm'] for r in rd('sido.csv')}
gu = {r['gu_cd']: r['gu_nm'] for r in rd('gu.csv')}
norm = lambda s: s.replace(' ', '').replace('세종특별자치시', '세종시')
votes = {}
for r in rd('data.csv'):
    c = r['code']; k = (sido[c[:2]], norm(gu[c[:5]]))
    a = votes.setdefault(k, [0, 0, 0])
    a[0] += int(r['p22lee']); a[1] += int(r['p22yoon']); a[2] += int(r['p22valid'])

geo = json.load(open(geo_path))
units = []
for f in sorted(geo['features'], key=lambda f: f['properties']['sggcd']):
    p = f['properties']; key = (p['sidonm'], norm(p['sggnm']))
    lee, yoon, valid = votes[key]
    sd = SHORT[p['sidonm']]; sg = p['sggnm'] if sd != '세종' else '세종시'
    en, ja = names(sd, sg)
    units.append({'id': p['sggcd'], 'region': REGION[p['sidonm']], 'w': valid,
                  'm': (lee - yoon) / (lee + yoon),          # 이재명 − 윤석열 (양자 기준), +면 진보 쪽
                  'names': [sd + ' ' + sg, ja, en], 'geom': f['geometry']})
write('kr', units, ['경계: 통계청 SGIS(공공누리 제1유형), admdongkor(CC BY 4.0) · 성향: 2022년 대선 개표 결과(중앙선거관리위원회)',
                    '境界: 韓国統計庁 SGIS(公共ヌリ第1類型)、admdongkor(CC BY 4.0) · 傾向: 2022年大統領選開票結果(中央選挙管理委員会)',
                    'Boundaries: Statistics Korea SGIS (KOGL Type 1), admdongkor (CC BY 4.0) · Leanings: 2022 presidential election results (NEC)'],
      ['2022년 대선 기준', '2022年大統領選基準', 'based on the 2022 presidential election'])

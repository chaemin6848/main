# 제1당 지도

모든 무대(가상 해람 공화국과 한국·일본·미국·영국·프랑스)에서 실제 모양 지도를 보여 주고, 지역구 의석을 지역보다 작은 단위로 계산한다.

| 무대 | 단위 | 개수 | 성향 기준 | 지도 파일 |
|---|---|---|---|---|
| 한국 | 시군구 | 250 | 2022년 대선 | 76 KB |
| 일본 | 시정촌·정령시 행정구 | 1,891 (지도 1,869) | 2024년 중의원 선거 비례대표 | 402 KB |
| 미국 | 카운티 | 3,141 | 2024년 대선 | 370 KB |
| 영국 | 하원 선거구(2024년 경계) | 650 | 2024년 총선 | 161 KB |
| 프랑스 | 데파르트망 + 지도 밖 해외 영토·재외국민 6곳 | 107 (지도 101) | 2024년 총선 1차 투표 | 112 KB |
| 가상 해람 공화국 | 무작위로 만든 시군구 | 193 | 무작위 | 41 KB |

지도 파일(`public/jeildang/maps/<나라>.js`)은 그 무대의 판을 열 때만 불러온다. 엔진이 쓰는 단위 표(`public/jeildang/units.js`, 약 90 KB)는 늘 불러온다.

## 계산 방식

- 게임 규칙의 지역 7곳은 그대로 두고, 그 안을 위 단위로 나눈다.
- 단위마다 두 값을 쓴다.
  - **유권자 비중:** 그 선거의 유효표 수. 지역 지역구 의석을 이 비중대로 나눈다.
  - **성향(m):** 진보 쪽 득표 − 보수 쪽 득표를 둘의 합으로 나눈 값. 지역 평균과의 차이(d)만 쓴다. 나라별 진보·보수 묶음은 각 `build_*.py` 맨 위에 적었다.
- 단위 판세 = 지역 판세 × exp(1.8 × d × 정당의 진보 쪽 위치), 다시 합이 1이 되게 나눈다. 정당 위치는 노선 좌표(분배·개방 쪽이 진보)로 정한다.
- 의석: 지역 안에서 단위마다 지역과 같은 식(득표^1.8 비례)으로 몫을 나누고 유권자 비중대로 더한 뒤 정수로 나눈다. 단위별 1위 당은 총선마다 `g.lastUnits`에 남는다(지도의 '지난 총선' 보기).
- 국가 모드 시작 의석은 예전처럼 실제 의석에 맞춘다(정당 기본 득표력을 맞추는 단계가 단위 계산을 그대로 쓴다).
- AI끼리 대전 비교(무대마다 100~300판)에서 정당별 승률은 단위 계산 전과 비슷하다.
- 속도: 미국·일본은 판 만들기 0.15~0.25초, 그 뒤 선거 계산 한 번에 약 2ms.

## 출처 (출시물·스팀 크레딧에 반드시 표시)

각 지도 패널 아래에 아래 출처를 적어 두었다(지도 파일의 `credit`).

| 무대 | 경계 | 선거 결과 |
|---|---|---|
| 한국 | 통계청 SGIS 행정구역 경계(공공누리 제1유형) → [admdongkor](https://github.com/vuski/admdongkor) `sgg_20220309.parquet`(CC BY 4.0) | 2022년 대선 읍면동별 개표 결과(중앙선거관리위원회) → [presidentialElection2022SouthKoreaEmdmap](https://github.com/vuski/presidentialElection2022SouthKoreaEmdmap) |
| 일본 | 국토교통성 국토수치정보 행정구역(2021) → [smartnews-smri/japan-topography](https://github.com/smartnews-smri/japan-topography) (국토교통성 출처 표시 필요, 상업적 이용 가능) | 2024년 중의원 선거 비례대표 시정촌별 득표 → [yhoriuchi/jelec2024lh](https://github.com/yhoriuchi/jelec2024lh) (MIT) |
| 미국 | 미국 인구조사국 → [us-atlas@3](https://github.com/topojson/us-atlas) `counties-albers-10m.json` (퍼블릭 도메인) | 2024년 대선 카운티별 득표 → [tonmcg/US_County_Level_Election_Results_08-24](https://github.com/tonmcg/US_County_Level_Election_Results_08-24) (MIT) |
| 영국 | ONS Westminster Parliamentary Constituencies (July 2024) UK BUC (Open Government Licence v3.0, OS 데이터 © Crown copyright and database right 2024) | 2024년 총선 결과(하원 도서관, Open Parliament Licence). 두 파일은 [Kingsley-Godfrey/interactive-map-of-the-UK-by-constituency](https://github.com/Kingsley-Godfrey/interactive-map-of-the-UK-by-constituency)에서 받았다 |
| 프랑스 | IGN Admin Express COG 2018(Licence Ouverte) → [gregoiredavid/france-geojson](https://github.com/gregoiredavid/france-geojson) `departements-avec-outre-mer.geojson` | 2024년 총선 1차 투표 선거구별 득표(내무부) → [Uriopass/legislatives_2024_data](https://github.com/Uriopass/legislatives_2024_data) (CC0) |
| 해람 | 무작위 생성 | 무작위 생성 |

출시 전에 영국 결과표의 원 출처(하원 도서관)와 일본 국토수치정보의 출처 표시 문구를 각 기관 안내대로 한 번 더 확인한다.

## 나라별 메모

- **한국:** 경계는 2022년 3월 기준(2023년 군위군의 대구 편입 미반영, 같은 게임 지역이라 계산에는 영향 없음). 이름: 영어는 로마자 표기법(자음 동화 반영), 일본어는 시도 한자 + 가타카나.
- **일본:**
  - 하마마쓰시는 2024년에 구가 재편돼 시 전체를 한 단위로 묶었다. 북방 영토 마을과 소속 미정지는 표가 없어 뺐다.
  - **독도(일본 자료의 '다케시마')는 일본 지도에 그리지 않는다.** 시마네현 오키노시마정 경계에 들어 있어 빼는 처리를 했다.
  - 오키나와현과 아마미 제도는 북쪽 바다의 점선 칸으로 옮겨 그렸고, 오가사와라·다이토 제도 등 먼 섬은 그리지 않았다(계산 단위로는 남는다).
  - 시정촌 이름의 한국어·영어 표기는 pykakasi 자동 독음이라 틀린 곳이 있을 수 있다. 상위 140곳을 눈으로 확인했고, 틀린 것은 `build_jp.py`의 `FIX`에 더한다. 도도부현은 표로 적었다.
- **미국:** 주는 2020년 하원 의석 배분 그대로 7개 지역에 나뉜다(북동부 76, 오대호 62, 중부 평원 29, 남동부 85, 중남부 79, 태평양 71, 산악 33). 알래스카(결과가 주 하원 선거구 단위)와 코네티컷(2022년 카운티 개편)은 주 전체 결과를 카운티에 고르게 나눴다. 워싱턴 D.C.는 하원 투표권이 없어 뺐다.
- **영국:** 북아일랜드 성향은 진보·보수 대신 민족주의(신페인·SDLP·연합당)와 연합주의(DUP·UUP)로 잰다.
- **프랑스:** 하원 선거구(577곳) 경계는 출처·이용 조건이 분명한 자료를 찾지 못해 데파르트망 단위로 했다. 해외 지역주의(REG) 후보는 대부분 좌파 계열이라 좌파로 셌다. 해외 데파르트망 5곳은 본토 왼쪽 칸으로 줄여 옮겼고, 지도가 없는 해외 영토·재외국민 6곳은 계산에만 들어간다.

## 다시 만들기

도구: Python(shapely, pyarrow, pykakasi), Node(mapshaper, us-atlas). 아래 경로는 예시다.

```bash
pip install shapely pyarrow pykakasi
npm i mapshaper us-atlas@3
```

각 `tools/jeildang/maps/build_<나라>.py` 맨 위 설명에 입력 파일과 사용법이 있다. 공통 처리(좌표를 SVG 경로로 바꾸기, `units.js` 갱신)는 `common.py`에 있다.

```bash
# 한국: admdongkor parquet → GeoJSON(섬 정리) → mapshaper 1.5% → build_kr.py
python3 tools/jeildang/maps/build_kr.py sgg-s.json presidentialElection2022SouthKoreaEmdmap/
# 일본: 내부에서 mapshaper 를 부른다
MAPSHAPER=node_modules/.bin/mapshaper python3 tools/jeildang/maps/build_jp.py N03-21_210101.json pr_data.csv work/
# 미국
npx mapshaper -i node_modules/us-atlas/counties-albers-10m.json id-field=fips -target counties -simplify 15% keep-shapes planar -o us.json format=geojson precision=0.01 target=counties
python3 tools/jeildang/maps/build_us.py us.json 2024_US_County_Level_Presidential_Results.csv
# 영국
npx mapshaper -i PCON_JULY_2024_UK_BUC.shp -simplify 25% keep-shapes planar -o uk.json format=geojson precision=1
python3 tools/jeildang/maps/build_uk.py uk.json results.csv
# 프랑스
npx mapshaper -i departements-avec-outre-mer.geojson -simplify 6% keep-shapes -filter-islands min-area=20km2 -o fr.json format=geojson precision=0.0001
python3 tools/jeildang/maps/build_fr.py fr.json results_csv/
# 해람 (시드를 바꾸면 다른 섬)
python3 tools/jeildang/maps/build_haeram.py 7
```

한국 parquet → GeoJSON 변환:

```python
import pyarrow.parquet as pq, json
from shapely import wkb
from shapely.geometry import mapping, MultiPolygon, Polygon
feats = []
for r in pq.read_table('adm/parquet/sgg_20220309.parquet').to_pylist():
    g = wkb.loads(r['geom'])
    parts = list(g.geoms) if g.geom_type == 'MultiPolygon' else [g]
    keep = [Polygon(p.exterior) for p in parts if p.area >= 1.5e6 or p.centroid.x > 1300000] or [Polygon(max(parts, key=lambda p: p.area).exterior)]
    feats.append({'type': 'Feature', 'properties': {'sggcd': r['sggcd'], 'sggnm': r['sggnm'], 'sidonm': r['sidonm']},
                  'geometry': mapping(MultiPolygon(keep) if len(keep) > 1 else keep[0])})
json.dump({'type': 'FeatureCollection', 'features': feats}, open('sgg2022-f.geojson', 'w'))
# 이어서: npx mapshaper -i sgg2022-f.geojson -simplify 1.5% keep-shapes planar -o sgg-s.json format=geojson precision=10
```

## 화면

- 국회 탭의 '지도' 패널: 총선 예상 / 지난 총선, 전국·지역 확대(멀리 떨어진 섬은 유권자 비중으로 빼고 범위를 잡는다), 한 곳을 누르면 정당별 판세.
- 이름은 지도 파일의 `names`에서 언어별로 고른다(번역표를 거치지 않는다). 세 언어 이름이 같은 곳(미국·영국·프랑스)은 `[이름, 묶음 키]`로 적고 묶음(주·지방) 이름만 세 언어로 둔다.

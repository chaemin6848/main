# 제1당 지도

국가 모드에서 실제 나라 모양 지도를 보여 주고, 지역구 의석을 시군구 단위로 계산한다. 지금은 **한국**만 있다.

## 계산 방식

- 게임 규칙의 지역(서울, 경기·인천 …) 7곳은 그대로 두고, 그 안을 시군구 250곳으로 나눈다.
- 시군구마다 두 값을 쓴다.
  - **유권자 비중:** 2022년 대선 유효표 수. 지역 지역구 의석을 이 비중대로 시군구에 나눈다(예: 강남구는 서울 48석 중 약 2.6석 몫).
  - **성향:** 2022년 대선 이재명−윤석열 양자 득표 차. 지역 평균과의 차이(d)만 쓴다.
- 시군구 판세 = 지역 판세 × exp(1.8 × d × 정당의 진보 쪽 위치). 정당 위치는 노선 좌표(분배·개방 쪽이 진보)로 정한다.
- 의석: 지역 안에서 시군구마다 지역과 같은 식(득표^1.8 비례)으로 몫을 나누고 유권자 비중대로 더한 뒤 정수로 나눈다. 시군구별 1위 당은 총선마다 `g.lastUnits`에 남긴다.
- 시작 의석은 예전처럼 실제 의석에 맞춘다(정당 기본 득표력을 맞추는 단계가 시군구 계산을 그대로 쓴다).
- AI끼리 300판 비교에서 정당별 승률은 시군구 계산 전과 거의 같다.

## 출처 (출시물에 반드시 표시)

| 자료 | 출처 | 조건 |
|---|---|---|
| 시군구 경계(2022년 3월 9일) | 통계청 SGIS 행정구역 경계 → [admdongkor](https://github.com/vuski/admdongkor) `parquet/sgg_20220309.parquet` | 공공누리 제1유형(출처표시) + CC BY 4.0. 상업적 이용 가능, 출처 표시 필수 |
| 2022년 대선 읍면동별 개표 결과 | 중앙선거관리위원회 개표 결과를 정리한 [presidentialElection2022SouthKoreaEmdmap](https://github.com/vuski/presidentialElection2022SouthKoreaEmdmap) `data.csv` | 선관위 공개 개표 결과 |

게임 화면(지도 패널 아래)에 출처를 적어 두었다. 스팀판 크레딧에도 같은 내용을 넣는다.

## 다시 만들기

```bash
# 1) 자료 받기 (작업 폴더는 아무 곳이나)
git clone --depth 1 https://github.com/vuski/presidentialElection2022SouthKoreaEmdmap.git elec
git clone --filter=blob:none --no-checkout --depth 1 https://github.com/vuski/admdongkor.git adm
git -C adm checkout HEAD -- parquet/sgg_20220309.parquet

# 2) parquet → GeoJSON (pyarrow·shapely 필요). 1.5km² 미만 섬은 빼되 독도는 남기고, 구멍은 메운다
#    (변환 코드는 아래 python 조각)

# 3) 단순화 (mapshaper, 경계를 공유하므로 이웃 시군구 사이에 틈이 생기지 않는다)
npx mapshaper -i sgg2022-f.geojson -simplify 1.5% keep-shapes planar -o sgg-s.json format=geojson precision=10

# 4) 저장소 루트에서 지도·시군구 표·이름 번역 만들기
python3 tools/jeildang/maps/build_kr.py sgg-s.json elec > units.txt
#    units.txt 한 줄을 public/jeildang/engine.js 의 UNIT_DATA.kr 에 붙여 넣는다

# 5) 번역 다시 만들기 (시군구 이름 번역표를 함께 넣는다)
python3 tools/i18n-build.py tools/i18n/jeildang.tsv tools/i18n/jeildang-kr-units.tsv tools/i18n/jeildang-extra.js > public/jeildang/i18n.js
```

2)의 변환:

```python
import pyarrow.parquet as pq, json, shapely
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
```

## 이름 번역

`tools/jeildang/maps/hangul.py`가 시군구 이름을 바꾼다.
- **영어:** 국어의 로마자 표기법. 지명에 흔한 자음 동화를 반영한다(종로 → Jongno, 울릉 → Ulleung).
- **일본어:** 시도는 한자(釜山, 慶北), 시군구는 가타카나 + 市·郡·区(カンナム区).

## 남은 일

- 일본·미국·영국·프랑스 지도와 세부 단위(예: 일본 소선거구 289곳, 영국 하원 선거구 650곳). 나라마다 경계 데이터의 이용 조건을 따로 확인해야 한다.
- 가상 해람 공화국 지도(가상의 섬 모양).
- 경계는 2022년 기준이라 그 뒤 바뀐 곳(예: 2023년 군위군의 대구 편입)은 반영되지 않았다. 군위군은 대구·경북 같은 게임 지역 안이라 계산에는 영향이 없다.

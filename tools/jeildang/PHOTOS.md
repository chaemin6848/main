# 제1당 배경 사진 출처 현황

`public/jeildang/img/`의 배경 사진 상태. **웹판은 지금 사진을 그대로 쓰고, 스팀판 출시 전에 라이선스가 확인된 사진으로 바꾼다** (2026-11 결정).

| 파일 | 쓰는 곳 | 출처 | 스팀판 |
|---|---|---|---|
| `kr.jpg` `jp.jpg` `us.jpg` `uk.jpg` `fr.jpg` | 첫 화면·대기실 (의사당 외관) | 운영자가 제공, 출처 미확인 | 바꿔야 함 |
| `kr-in.jpg` `jp-in.jpg` `us-in.jpg` `uk-in.jpg` `fr-in.jpg` | 게임 화면 (본회의장 내부) | 운영자가 제공, 출처 미확인 | 바꿔야 함 |

## 위키미디어 공용에서 확인한 후보 (2026-11-04)

라이선스와 저작자는 공용 API로 직접 확인했다. 화면 품질은 아쉬워 아직 쓰지 않았다.

| 나라 | 파일 | 라이선스 | 저작자 | 판단 |
|---|---|---|---|---|
| 한국 | [국회의사당 (14).JPG](https://commons.wikimedia.org/wiki/File:%EA%B5%AD%ED%9A%8C%EC%9D%98%EC%82%AC%EB%8B%B9_(14).JPG) | CC BY-SA 4.0 | 콩가루 | 쓸 수 없음: 여의도 길거리 사진이라 의사당이 안 보인다 |
| 일본 | [NationalDietBuilding.jpg](https://commons.wikimedia.org/wiki/File:NationalDietBuilding.jpg) | CC BY 3.0 | Douglas P. Perkins | 쓸 만함: 정면이지만 앞에 도로와 차가 많다 |
| 미국 | [The United States Capitol Building.jpg](https://commons.wikimedia.org/wiki/File:The_United_States_Capitol_Building.jpg) | CC BY 4.0 | Trendscope | 아쉬움: 돔이 아니라 하원동 옆모습이다 |
| 영국 | [Palace of Westminster - west facade - 17 May 2026.jpg](https://commons.wikimedia.org/wiki/File:Palace_of_Westminster_-_west_facade_-_17_May_2026.jpg) | CC0 | Aethonatic | 아쉬움: 강 쪽이 아니라 길가에서 찍은 흐린 날 사진이다 |
| 프랑스 | [Palais Bourbon.jpg](https://commons.wikimedia.org/wiki/File:Palais_Bourbon.jpg) | CC BY 2.0 | kimdokhac | 아쉬움: 하늘을 과하게 보정해 어둡다 |
| 미국 내부 | [Session of the House of Representatives in the U.S. Capitol LCCN2010651165.jpg](https://commons.wikimedia.org/wiki/File:Session_of_the_House_of_Representatives_in_the_U.S._Capitol_LCCN2010651165.jpg) | Public domain | National Photo Company | 1920~30년대 흑백 사진이라 현대 배경에 어색하다 |

나머지 나라 내부 사진은 공식 갤러리만 찾았고, 상업적 이용이 가능한 개별 파일은 아직 정하지 않았다.

## 스팀판 전에 할 일

1. 나라별 외관·내부 사진을 상업적 이용이 가능한 라이선스(CC0, CC BY, CC BY-SA, 퍼블릭 도메인)로 고른다. 공용에서 사람이 직접 골라 파일 링크를 정하는 편이 빠르다.
2. 위 표처럼 공용 API로 라이선스·저작자를 확인하고 이 문서를 갱신한다.
3. CC BY·CC BY-SA 사진은 게임 안(첫 화면 아래나 크레딧)에 저작자, 라이선스, 원본 링크를 표기한다. CC BY-SA는 사진을 고쳐 쓰면 고친 사진도 같은 라이선스로 공개해야 한다.
4. 공식 의회 사이트 사진은 공개돼 있어도 상업적 이용이 허락된 것이 아니므로, 이용 조건을 따로 확인하기 전에는 쓰지 않는다.

## 받을 때 주의

- 위키미디어는 이 클라우드 환경의 공유 IP에 요청 속도 제한(429)을 자주 건다. 요청은 한 번에 하나씩, 간격을 두고 보낸다.
- 축소본은 정해진 크기만 받는다(예: `.../thumb/<경로>/1920px-<파일명>`). 1600px 같은 임의 크기는 400 오류가 난다.

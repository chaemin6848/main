// 제1당 게임 엔진 — 규칙·선거·AI·승점. 브라우저와 Node(시뮬레이터·테스트)에서 함께 쓴다. DOM에 의존하지 않는다.
const E=(function(){
  const AP=3, NCOLORS=8, PR_THRESHOLD=.03, MEMBER_BILLS=2, GOV_FATIGUE=2.5, BAL={check:1,checkMax:8,revert:.08,welfare:3,reshuffle:1,sat:18,talentKeep:.88,talentMax:14,fatigueMax:10,fatigueMaxReal:16};
  // 승점 배점. 400석 기준이며 의석 관련 점수는 의회 크기로 나눠 맞춘다.
  const PTS={seat:200,share:120,growth:200,growthMax:.15,minor:240,ownLaw:3,ownFail:-1,ideoMid:1,govLaw:1,govFail:-2,partnerLaw:1,pactLaw:5,ideoHit:2,ideoStrong:1,ideoMiss:-2,ideoStand:1.5,oppRound:2,block:2,noconf:8,pmRound:1.5,partnerRound:1,presRound:1,solo:20,coalition:15,minority:8,president:8,semiPres:10,trust:.25,unity:.2,goalHit:10};

  // 국가 모드 정당별 목표. 정당마다 시작 처지가 달라 승점 절대값으로 겨루면 여당이 거의 늘 이긴다.
  // 그래서 정당마다 [시작 의석, 그다음 GOAL_ROUNDS 분기 수마다 (목표 의석, 기준 승점)]을 두고,
  // 목표 의석을 채우면 승점 +goalHit, 순위는 '승점 − 기준 승점'(목표 대비)으로 매긴다.
  // 값은 AI끼리 자동 대전한 결과로 맞춘다: node tools/jeildang/calibrate.js (아래 표를 다시 쓴다)
  // 사이 분기 수는 직선으로 잇고, 마지막보다 길면(한 임기 더 하기를 여러 번) 마지막 구간을 늘려 쓴다.
  const GOAL_ROUNDS=[6,12,18,24];
  const GOALS=/*GOALS-START*/{
    kr:{ppp:[109,110,82,110,103,108,122,107,141],rebuild:[12,29,71,34,118,38,162,40,204],dem:[161,125,93,108,117,101,150,98,183],jinbo:[4,15,46,22,83,25,126,27,164],reform:[3,12,32,15,49,16,64,17,78]},
    jp:{ishin:[36,52,67,59,118,61,148,63,178],sansei:[15,44,68,55,125,60,158,64,194],ldp:[315,247,112,209,117,198,142,190,170],dpp:[28,29,31,31,39,31,47,31,52],komeito:[27,41,42,51,73,54,93,53,115],cdp:[20,27,30,32,43,33,54,34,63],mirai:[11,12,16,14,18,14,23,15,26]},
    us:{dem:[214,225,113,230,139,233,174,225,198],gop:[218,209,87,205,108,201,117,209,139]},
    uk:{ld:[71,72,83,84,129,95,171,101,206],lab:[404,304,121,259,129,253,164,253,205],con:[118,159,91,159,112,142,126,133,143],plaid:[4,6,29,6,47,5,64,5,80],reform:[8,38,32,54,55,62,74,65,88],green:[5,13,47,27,107,29,162,33,213],snp:[8,14,38,14,67,14,93,13,116]},
    fr:{rn:[118,113,67,94,77,88,89,84,102],dr:[47,70,52,75,72,78,87,80,102],ps:[67,86,66,70,93,63,118,61,144],eco:[38,58,51,68,90,73,126,77,159],lfi:[70,79,61,87,106,92,147,93,182],dem:[71,50,24,45,31,42,36,40,44],epr:[90,56,29,66,45,68,55,66,60]}}/*GOALS-END*/;
  let TOTAL=400,DISTRICT=280,PR=120,U=1,UNIT='억',MEMBER_NAME='당원';
  const HAERAM=[
    {id:'hanbyeol',name:'한별 수도권',seats:90,eco:.1,soc:.35,tag:'청년·사무직'},
    {id:'neoreun',name:'너른 신도시권',seats:60,eco:-.45,soc:-.05,tag:'중산층·주택 소유자'},
    {id:'donghae',name:'동해 공단',seats:37,eco:.5,soc:.1,tag:'노동자'},
    {id:'namnyeok',name:'남녘 항만',seats:34,eco:-.4,soc:.45,tag:'무역·물류'},
    {id:'seodeul',name:'서들 농촌',seats:26,eco:.3,soc:-.6,tag:'농민·고령층'},
    {id:'bukbang',name:'북방 접경',seats:18,eco:-.3,soc:-.9,tag:'접경 주민'},
    {id:'seom',name:'섬·산간',seats:15,eco:.1,soc:-.1,tag:'균형발전'},
  ];

  // 국가 모드. 7개 권역 칸은 법안 효과를 나라와 상관없이 쓰려고 같은 id를 공유한다.
  // 권역 의석은 실제 선거구를 묶은 근사치, 이념 좌표는 게임용 단순화다.
  const COUNTRIES={
    kr:{name:'한국',house:'국회',total:300,district:254,pr:46,asOf:'2026년 7월 16일',
      regions:[['hanbyeol','서울',48,.3,.4,'수도'],['neoreun','경기·인천',74,.25,.3,'수도권'],['donghae','부산·울산·경남',40,-.4,-.3,'동남권'],['namnyeok','대구·경북',25,-.7,-.7,'영남 내륙'],['seodeul','광주·전라',28,.7,.3,'호남'],['bukbang','대전·충청',28,0,-.1,'중부'],['seom','강원·제주',11,-.1,-.2,'강원·제주']],
      parties:[['dem','더불어민주당',153,8,.5,.4,0,{seodeul:14,hanbyeol:2}],['ppp','국민의힘',91,18,-.6,-.6,1,{namnyeok:14,donghae:6}],['rebuild','조국혁신당',0,12,.7,.6,6],['jinbo','진보당',1,3,.9,.3,4],['reform','개혁신당',1,2,-.5,.5,3],['ind','무소속',7,3,0,0,7,null,true]]},
    jp:{name:'일본',house:'중의원',total:465,district:289,pr:176,asOf:'2026년 9월 28일 무렵',
      regions:[['hanbyeol','도쿄',30,.1,.5,'수도'],['neoreun','간토',67,-.2,.1,'수도권'],['donghae','홋카이도·도호쿠',33,.2,-.3,'북부'],['namnyeok','주부',61,-.3,-.2,'중부'],['seodeul','긴키',45,-.4,.2,'간사이'],['bukbang','주고쿠·시코쿠',21,-.3,-.5,'서부'],['seom','규슈·오키나와',32,-.2,-.4,'남부']],
      parties:[['ldp','자유민주당',248,67,-.5,-.6,1],['cdp','입헌민주당',7,13,.4,.5,0],['komeito','공명당',0,27,.1,0,6],['ishin','일본유신회',20,16,-.7,-.2,3,{seodeul:14}],['dpp','국민민주당',8,20,0,.1,5],['sansei','참정당',0,15,-.3,-.9,7],['mirai','팀 미라이',0,11,-.2,.8,4],['ind','공산·무소속·기타',6,6,.1,.1,2,null,true]]},
    us:{name:'미국',house:'연방 하원',total:435,district:435,pr:0,asOf:'2026년 10월 26일',
      regions:[['hanbyeol','북동부',76,.5,.6,'뉴욕·펜실베이니아'],['neoreun','오대호',62,.1,.1,'경합 지역'],['donghae','중부 평원',29,-.4,-.5,'농업 지대'],['namnyeok','남동부',85,-.1,-.15,'플로리다·조지아'],['seodeul','중남부',79,-.5,-.6,'텍사스'],['bukbang','태평양',71,.6,.7,'캘리포니아'],['seom','산악',33,0,0,'내륙 서부']],
      parties:[['gop','공화당',218,0,-.7,-.7,1],['dem','민주당',214,0,.5,.7,0],['ind','무소속',1,0,0,0,3,null,true]]},
    uk:{name:'영국',house:'하원',total:650,district:650,pr:0,asOf:'2026년 10월 26일',
      regions:[['hanbyeol','런던',75,.5,.7,'수도'],['neoreun','잉글랜드 남부',210,-.3,.1,'남동·남서·동부'],['donghae','미들랜드',104,0,-.3,'중부'],['namnyeok','잉글랜드 북부',154,.4,-.2,'북서·요크셔·북동'],['seodeul','스코틀랜드',57,.4,.5,'스코틀랜드'],['bukbang','웨일스',32,.4,.2,'웨일스'],['seom','북아일랜드',18,0,-.4,'북아일랜드']],
      parties:[['lab','노동당',404,0,.5,.5,1],['con','보수당',118,0,-.6,-.4,0],['ld','자유민주당',71,0,.1,.7,3],['snp','스코틀랜드국민당',8,0,.5,.6,5,{seodeul:14}],['reform','영국개혁당',8,0,-.5,-.9,6],['green','녹색당',5,0,.8,.9,2],['plaid','웨일스당',4,0,.6,.5,4,{bukbang:18}],['ind','북아일랜드·기타',32,0,0,-.1,7,{seom:30},true]]},
    fr:{name:'프랑스',house:'국민의회',total:577,district:577,pr:0,asOf:'2026년 10월 6일',
      regions:[['hanbyeol','일드프랑스',100,.3,.7,'수도권'],['neoreun','북부·동부',115,.1,-.5,'공업 지대'],['donghae','서부',106,-.1,.2,'브르타뉴·루아르'],['namnyeok','남서부',94,.3,.1,'옥시타니'],['seodeul','오베르뉴·론알프',68,-.2,.1,'리옹'],['bukbang','남프랑스·코르시카',56,-.1,-.6,'지중해'],['seom','해외 영토·재외',38,.3,.2,'해외']],
      parties:[['rn','국민연합',118,0,.1,-.9,7],['epr','르네상스 계열',90,0,-.5,.3,0],['lfi','굴복하지않는프랑스',70,0,.9,.7,1],['ps','사회당 계열',67,0,.6,.6,6],['dr','공화파',47,0,-.7,-.6,4],['eco','생태주의 계열',38,0,.6,.8,2],['dem','민주운동·오리종',71,0,-.4,.2,3],['ind','기타 원내 그룹',68,0,.2,-.1,5,null,true]]},
  };
  // 지역 정당은 본거지에서만 후보를 내고, 닫힌 지역(북아일랜드)에는 그 지역 정당만 나온다.
  const LOCAL={uk:{parties:{snp:['seodeul'],plaid:['bukbang'],ind:['seom']},regions:{seom:['ind']}}};
  for(const c of Object.values(COUNTRIES)){
    c.regions=c.regions.map(([id,name,seats,eco,soc,tag])=>({id,name,seats,eco,soc,tag}));
    c.parties=c.parties.map(([id,name,district,pr,eco,soc,colorIdx,home,fixed])=>({id,name,district,pr,eco,soc,colorIdx,home:home||null,fixed:!!fixed,seats:district+pr}));
  }
  // 정당별 이념 소개와 상징색. 같은 계열 색을 쓰는 당은 구분되도록 명도를 달리했다.
  const PARTY_LOOK={
    kr:{dem:['자유주의 · 중도~중도좌파','#1F4FBF'],ppp:['보수주의 · 우파','#D9232E'],rebuild:['진보주의·자유주의 · 중도좌파','#2E9BE6'],jinbo:['진보주의 · 좌파','#8E1B2E'],reform:['보수주의·자유지상주의 · 중도우파~우파','#E8720C'],basic:['기본소득·사회자유주의 · 중도좌파','#12917F'],sd:['사회민주주의·사회자유주의 · 중도좌파','#3E9B4F'],ind:['특정 이념 없음','#7A8580']},
    jp:{ldp:['보수주의·일본 민족주의 · 포괄 정당','#D9232E'],cdp:['자유주의·사회자유주의 · 중도~중도좌파','#1F4FBF'],komeito:['불교 민주주의 · 중도','#D6558F'],ishin:['자유지상 보수·신자유주의 · 중도우파~우파','#5E9616'],dpp:['보수주의·포퓰리즘 · 중도~중도우파','#C99A0E'],sansei:['일본 민족주의·우익 포퓰리즘 · 극우','#E8720C'],mirai:['전자 민주주의·기술 관료주의 · 중도','#12917F'],ind:['여러 세력','#7A8580']},
    us:{gop:['우익 포퓰리즘·보수주의 · 우파','#D9232E'],dem:['자유주의 · 중도~중도좌파','#1F4FBF'],ind:['특정 이념 없음','#7A8580']},
    uk:{lab:['사회민주주의 · 중도좌파','#D9232E'],con:['보수주의·영국 연합주의 · 중도우파~우파','#2E9BE6'],ld:['자유주의·사회자유주의 · 중도~중도좌파','#E8720C'],snp:['스코틀랜드 민족주의·독립 · 중도좌파','#C9A400'],reform:['우익 포퓰리즘·강경 유럽회의주의 · 우파','#12A5B5'],green:['녹색 정치·진보주의 · 좌파','#3E9B4F'],plaid:['웨일스 민족주의·독립 · 중도좌파~좌파','#1F6B3A'],ind:['여러 세력','#7A8580']},
    fr:{rn:['프랑스 민족주의·우익 포퓰리즘 · 극우','#2C3F9E'],epr:['자유주의 · 중도~중도우파','#C9A400'],lfi:['민주사회주의·좌익 포퓰리즘 · 좌파','#7A4FC0'],ps:['사회민주주의·진보주의 · 중도좌파~좌파','#D6558F'],dr:['보수주의 · 중도우파~우파','#2E9BE6'],eco:['녹색 정치 · 중도좌파~좌파','#3E9B4F'],dem:['기독교 민주주의·자유보수주의 · 중도우파','#E8720C'],ind:['여러 세력','#7A8580']},
  };
  for(const[k,c]of Object.entries(COUNTRIES))for(const x of c.parties){const l=PARTY_LOOK[k][x.id]||[];x.idea=l[0]||'';x.color=l[1]||null}
  for(const[k,L]of Object.entries(LOCAL)){const c=COUNTRIES[k];for(const x of c.parties)x.only=L.parties[x.id]||null;for(const x of c.regions)x.only=L.regions[x.id]||null}
  // 정부 형태. presidential: 대통령 소속 당이 행정부, semi: 대통령과 총리가 따로, westminster: 다수당 대표가 지명 표결 없이 총리.
  const GOVS={
    kr:{system:'presidential',head:'dem',note:'대통령제입니다. 대통령은 임기 동안 의회가 물러나게 할 수 없고, 의회를 해산할 수도 없습니다. 반대한 법안에는 거부권을 쓰며 의석 3분의 2가 찬성해야 뒤집힙니다.'},
    us:{system:'presidential',head:'gop',note:'대통령제입니다. 대통령은 선거인단으로 뽑고, 의회가 불신임하거나 대통령이 해산할 수 없습니다. 반대한 법안에는 거부권을 쓰며 의석 3분의 2가 찬성해야 뒤집힙니다.'},
    jp:{system:'parliament',pm:'ldp',ally:'ishin',note:'의원내각제입니다. 중의원 지명 선거로 총리를 뽑습니다. 불신임이 가결되면 내각이 물러나고, 총리는 중의원을 해산할 수 있습니다.'},
    uk:{system:'westminster',pm:'lab',note:'의원내각제입니다. 지명 표결 없이 최대 정당 대표가 총리가 됩니다. 불신임이 가결되면 바로 조기 총선을 치릅니다.'},
    fr:{system:'semi',pres:'epr',pm:'epr',note:'이원집정부제입니다. 대통령은 직선 결선투표로 뽑고 의회를 해산할 수 있습니다. 총리는 의회 불신임으로 물러나며, 대통령과 총리의 당이 다르면 동거 정부가 됩니다.'},
  };
  for(const[k,v]of Object.entries(GOVS))Object.assign(COUNTRIES[k],{gov:v,system:v.system,systemNote:v.note});
  // 나라별 통화와 정당 재정. u는 행동 비용 1단위로, 가장 큰 당 분기 수입의 200분의 1이다.
  // parties: [당원(만 명), 연간 수입]. 출처가 없는 값은 추정치다.
  const MONEY={
    kr:{unit:'억 원',u:3.5,members:'당비 당원',parties:{dem:[131,700],ppp:[84,500],rebuild:[15,60],jinbo:[8,40],reform:[6,73],ind:[0,0]}},
    jp:{unit:'억 엔',u:1.15,members:'당원',parties:{ldp:[100,230],cdp:[10,55],komeito:[40,100],ishin:[2,35],dpp:[5,33],sansei:[10,25],mirai:[1,7],ind:[0,0]}},
    us:{unit:'백만 달러',u:4,members:'등록 유권자',parties:{gop:[3910,600],dem:[4530,800],ind:[0,0]}},
    uk:{unit:'백만 파운드',u:.25,members:'당원',parties:{lab:[26.5,50],con:[12.3,35],ld:[6,10],snp:[5.1,6],reform:[26.8,15],green:[23,5],plaid:[1,1],ind:[0,0]}},
    fr:{unit:'백만 유로',u:.1,members:'당원',parties:{rn:[5,17.3],epr:[.85,19.5],lfi:[5,13.8],ps:[4,15.3],dr:[10,15.3],eco:[1,8.6],dem:[2,7.9],ind:[0,0]}},
  };
  for(const[k,c]of Object.entries(COUNTRIES)){
    c.money=MONEY[k];
    for(const x of c.parties){const m=MONEY[k].parties[x.id]||[0,0];x.members=m[0];x.income=m[1]}
  }
  // 지출 규모. 돈을 많이 쓸수록 효과는 늘지만 비용만큼 늘지는 않는다.
  const LEVELS=[{name:'풀뿌리',cost:.1,effect:.3},{name:'소규모',cost:.25,effect:.5},{name:'보통',cost:1,effect:1},{name:'대규모',cost:3,effect:1.7},{name:'총력',cost:8,effect:2.8}];
  const toReg=rs=>Object.fromEntries(rs.map(r=>[r.id,r]));
  let REGIONS=HAERAM,REG=toReg(HAERAM);
  // 지금 판의 나라에 맞춰 지역과 의석 규모를 고른다. 페이지에 판은 하나뿐이다.
  function useMap(g){
    const C=g&&g.country?COUNTRIES[g.country]:null;
    REGIONS=C?C.regions:HAERAM;REG=toReg(REGIONS);
    TOTAL=C?C.total:400;DISTRICT=C?C.district:280;PR=C?C.pr:120;
    U=C?C.money.u:1;UNIT=C?C.money.unit:'억';MEMBER_NAME=C?C.money.members:'당원';
  }
  const KINDS={
    major:{name:'대형정당',funds:18,members:7,unity:52,desc:'조직이 커서 지역구에 강하고 자금과 당원이 많습니다. 대신 계파 갈등이 잦아 결속이 빨리 떨어집니다.'},
    minor:{name:'군소정당',funds:10,members:3,unity:72,desc:'비례대표로 살아남는 정당입니다. 결속이 단단하고 연대 효과가 크며, 60석까지는 1석마다 승점을 더 받습니다.'},
  };
  const IDEOLOGIES={
    reform:{name:'개혁진보',eco:.7,soc:.7,desc:'분배 강화, 사회 개방. 수도권 청년층과 맞습니다.'},
    labor:{name:'민생연대',eco:.7,soc:-.5,desc:'분배 강화, 전통 중시. 공단과 농촌에서 강합니다.'},
    liberal:{name:'자유혁신',eco:-.7,soc:.7,desc:'시장 우선, 사회 개방. 항만과 신도시에서 강합니다.'},
    conservative:{name:'보수안정',eco:-.7,soc:-.6,desc:'시장 우선, 안보 중시. 접경과 신도시에서 강합니다.'},
    center:{name:'실용중도',eco:0,soc:0,desc:'어느 지역에서도 크게 밀리지 않고 표결 부담이 적습니다.'},
  };
  const ACTIONS={
    rally:{label:'지역 유세',cost:3,spend:true,need:['region'],desc:'선택한 지역 지지 기반 +6. 기반이 이미 두터운 지역일수록, 당이 작을수록 효과가 줄어듭니다.'},
    recruit:{label:'당원 모집',cost:2,spend:true,need:[],desc:'당원이 늘어 수입이 오릅니다. 국가 모드에서는 득표력도 오릅니다.'},
    talent:{label:'인재 영입',cost:4,spend:true,need:[],desc:'전국 후보 경쟁력 상승, 신뢰 +1. 경쟁력은 분기마다 조금씩 빠지고 상한이 있습니다.'},
    policy:{label:'정책 발표',cost:2,spend:true,need:[],desc:'신뢰 +4, 노선이 맞는 두 지역 기반 +1'},
    unify:{label:'계파 화합',cost:1,spend:true,need:[],desc:'결속 +12'},
    fundraise:{label:'후원금 모금',cost:0,need:[],desc:'자금 확보. 신뢰 −2, 25% 확률로 의혹 추가 −6'},
    attack:{label:'네거티브',cost:4,spend:true,need:['target','region'],desc:'상대 그 지역 기반 −5, 상대 신뢰 −3, 우리 신뢰 −3'},
    expose:{label:'의혹 폭로',cost:5,need:['target'],desc:'상대 신뢰가 낮을수록 성공. 실패하면 우리 신뢰 −7'},
    poach:{label:'의원 빼오기',cost:6,need:['target'],desc:'상대 결속이 낮을수록 성공. 성공하면 3~6석 이동'},
    leaveFed:{label:'연맹 탈퇴',cost:0,need:[],desc:'지금 속한 연맹에서 나옵니다. 연맹 규칙의 탈퇴 벌점만큼 우리 신뢰가 깎이고(기본 −5), 남는 회원당 신뢰 +1'},
    expel:{label:'연맹 제명',cost:0,need:['target'],desc:'고른 회원 당을 내보냅니다. 연맹 규칙에 따라 대표가 정하거나, 회원 과반이 같은 제명을 내야 합니다. 우리 신뢰 −2, 그 당 신뢰 +2'},
    propose:{label:'법안 발의',cost:2,need:['title','topic','region'],desc:'다음 분기 본회의에 우리 법안을 올립니다. 한 분기에 한 건만 낼 수 있습니다. 가결되면 신뢰 +2, 그 지역 기반 +3'},
    noConfidence:{label:'내각 불신임안',cost:.3,need:[],desc:'다음 분기에 표결합니다. 가결되면 내각이 물러나고, 부결되면 우리 신뢰 −2'},
  };
  const GOV={
    budget:{label:'지역 예산 배정',cost:6,need:['region'],desc:'그 지역 기반 +4, 연립 상대 +2'},
    welfare:{label:'민생 지원금',cost:8,need:[],desc:'신뢰 +3, 분배 성향 지역 기반 +2'},
    taxcut:{label:'세금 감면',cost:6,need:[],desc:'자금 +5, 시장 성향 지역 기반 +2'},
    security:{label:'안보 태세 강화',cost:5,need:[],desc:'안보 중시 지역 기반 +3'},
    reshuffle:{label:'내각 개편',cost:2,need:[],desc:'결속 +10, 신뢰 +1'},
    probe:{label:'정치 수사 지시',cost:3,need:['target'],desc:'상대 신뢰 −7. 40% 확률로 역풍을 맞아 우리 신뢰 −8'},
    dissolve:{label:'의회 해산',cost:0,need:[],pmOnly:true,desc:'이번 분기 말 전 의석 조기 총선. 게임 중 한 번. 그 뒤 총리를 새로 정합니다.'},
  };
  const TOPICS={
    welfare:{label:'복지 확대',title:'복지 확대법',eco:.8,soc:.2},
    tax:{label:'감세·규제 완화',title:'규제 완화 특별법',eco:-.8,soc:0},
    defense:{label:'안보 강화',title:'국가안보 강화법',eco:-.1,soc:-.9},
    open:{label:'개방·이민',title:'다문화 사회 기본법',eco:-.2,soc:.9},
    farm:{label:'농어촌 지원',title:'농어촌 지원 특별법',eco:.6,soc:-.4},
    labor:{label:'노동 보호',title:'노동자 보호법',eco:.8,soc:.3},
    region:{label:'지역 균형',title:'지역 균형발전법',eco:.3,soc:-.2},
    green:{label:'기후·환경',title:'기후위기 대응법',eco:.3,soc:.7},
    housing:{label:'주택 공급',title:'주택 공급 촉진법',eco:-.5,soc:0},
    order:{label:'치안·법질서',title:'치안 강화 특별법',eco:-.3,soc:-.8},
    fiscal:{label:'재정 건전화',title:'재정 건전화법',eco:-.7,soc:-.4},
  };
  const BILLS=[
    {title:'기본소득 시범사업법',desc:'농어촌과 저소득 지역부터 기본소득을 시범 지급합니다.',eco:.9,soc:.2,pass:{seom:3}},
    {title:'법인세 인하안',desc:'최고 법인세율을 낮춰 기업 투자를 유도합니다.',eco:-.9,soc:0,pass:{namnyeok:3}},
    {title:'주택 보유세 강화안',desc:'고가 주택 보유세를 올려 청년 주거 재원을 마련합니다.',eco:.7,soc:.1,pass:{hanbyeol:3,neoreun:-2}},
    {title:'신도시 재건축 완화법',desc:'노후 신도시의 재건축 규제를 풉니다.',eco:-.7,soc:0,pass:{neoreun:4}},
    {title:'국방 예산 증액안',desc:'내년도 국방 예산을 큰 폭으로 늘립니다.',eco:-.1,soc:-.9,pass:{bukbang:4}},
    {title:'이민 개방 확대법',desc:'숙련 노동자 비자를 넓혀 인력난에 대응합니다.',eco:-.2,soc:.9,pass:{namnyeok:3}},
    {title:'농가 소득 보전법',desc:'쌀값 하락분을 국가가 보전합니다.',eco:.6,soc:-.4,pass:{seodeul:4}},
    {title:'노동시간 단축법',desc:'주 4.5일제를 단계적으로 시행합니다.',eco:.8,soc:.3,pass:{donghae:4}},
    {title:'자유무역협정 비준안',desc:'이웃 경제권과 맺은 무역 협정을 비준합니다.',eco:-.6,soc:.5,pass:{namnyeok:3,seodeul:-2}},
    {title:'청년 주거 지원법',desc:'공공 임대를 늘리고 월세를 지원합니다.',eco:.4,soc:.6,pass:{hanbyeol:4}},
    {title:'지방 의대 신설법',desc:'의료 취약 지역에 공공 의대를 세웁니다.',eco:.3,soc:-.2,pass:{seom:4}},
    {title:'접경지역 규제 완화법',desc:'군사 규제로 묶인 땅의 개발을 허용합니다.',eco:-.5,soc:-.5,pass:{bukbang:4}},
    {title:'탄소세 도입안',desc:'탄소 배출에 세금을 매겨 전환 기금을 만듭니다.',eco:.3,soc:.7,pass:{hanbyeol:3,donghae:-2}},
    {title:'원전 확대안',desc:'신규 원전 건설을 재개합니다.',eco:-.4,soc:-.5,pass:{donghae:3}},
    {title:'국회의원 세비 삭감안',desc:'의원 세비를 20% 줄입니다.',eco:.2,soc:-.2,pass:{seom:2}},
    {title:'공공기관 지방 이전법',desc:'수도권 공공기관을 지방으로 옮깁니다.',eco:.3,soc:-.1,pass:{seom:3,hanbyeol:-2}},
    {title:'공공부문 구조개혁안',desc:'공공기관 정원을 줄이고 성과급제를 넓힙니다.',eco:-.7,soc:-.3,pass:{neoreun:3}},
    {title:'흉악범 처벌 강화법',desc:'강력 범죄 형량을 높이고 가석방을 줄입니다.',eco:-.2,soc:-.8,pass:{seodeul:3,bukbang:2}},
    {title:"최저임금 인상안",desc:"내년 최저임금을 큰 폭으로 올립니다.",eco:0.8,soc:0.1,pass:{'donghae': 3}},
    {title:"상속세 완화안",desc:"가업 승계 때 상속세 부담을 줄입니다.",eco:-0.8,soc:-0.1,pass:{'neoreun': 3}},
    {title:"공공 돌봄 확대법",desc:"국공립 어린이집과 노인 돌봄을 늘립니다.",eco:0.7,soc:0.2,pass:{'hanbyeol': 2, 'seodeul': 2}},
    {title:"플랫폼 노동자 보호법",desc:"배달·대리 기사에게 산재보험과 최저 보수를 보장합니다.",eco:0.7,soc:0.4,pass:{'hanbyeol': 3}},
    {title:"규제 샌드박스 확대법",desc:"신산업에 규제 없이 시험할 기회를 넓힙니다.",eco:-0.6,soc:0.5,pass:{'namnyeok': 3}},
    {title:"대기업 집단 규제법",desc:"재벌 계열사 간 일감 몰아주기를 막습니다.",eco:0.7,soc:0.1,pass:{}},
    {title:"부동산 공급 확대법",desc:"도심 고밀 개발로 주택 공급을 늘립니다.",eco:-0.5,soc:0.2,pass:{'hanbyeol': 2, 'neoreun': 2}},
    {title:"임대료 상한제",desc:"전월세 인상률에 상한을 둡니다.",eco:0.8,soc:0.2,pass:{'hanbyeol': 3, 'neoreun': -2}},
    {title:"국가 장학금 확대법",desc:"소득 하위 절반의 대학 등록금을 지원합니다.",eco:0.6,soc:0.4,pass:{'hanbyeol': 2}},
    {title:"사립학교 자율화법",desc:"사립학교의 교육과정·학생 선발 자율을 넓힙니다.",eco:-0.5,soc:-0.3,pass:{'neoreun': 2}},
    {title:"징병제 개편안",desc:"복무 기간을 줄이고 모병 비중을 늘립니다.",eco:0.1,soc:0.6,pass:{'hanbyeol': 2, 'bukbang': -2}},
    {title:"예비군 강화법",desc:"예비군 훈련과 장비를 늘립니다.",eco:-0.2,soc:-0.8,pass:{'bukbang': 3}},
    {title:"동성 결혼 인정법",desc:"동성 부부의 혼인 신고를 받습니다.",eco:0.1,soc:0.95,pass:{'hanbyeol': 2, 'seodeul': -3}},
    {title:"가족 가치 지원법",desc:"다자녀·전통 가정에 세제 혜택을 줍니다.",eco:0.2,soc:-0.8,pass:{'seodeul': 3}},
    {title:"차별금지법",desc:"고용·서비스에서 차별을 금지하고 구제 절차를 둡니다.",eco:0.2,soc:0.8,pass:{'hanbyeol': 2}},
    {title:"공공 와이파이 무료화",desc:"전국 공공장소 와이파이를 무료로 엽니다.",eco:0.4,soc:0.4,pass:{'seom': 2}},
    {title:"전기요금 현실화",desc:"원가에 맞춰 전기요금을 올립니다.",eco:-0.5,soc:0,pass:{'donghae': -2}},
    {title:"재생에너지 의무화",desc:"발전량의 40%를 재생에너지로 채웁니다.",eco:0.3,soc:0.6,pass:{'seom': 2, 'donghae': -2}},
    {title:"석탄 발전 조기 폐쇄",desc:"석탄 발전소를 10년 앞당겨 닫습니다.",eco:0.3,soc:0.5,pass:{'donghae': -3, 'hanbyeol': 2}},
    {title:"수소 산업 육성법",desc:"수소차와 충전소에 보조금을 줍니다.",eco:-0.3,soc:0.3,pass:{'donghae': 3}},
    {title:"반도체 특별법",desc:"반도체 공장에 세액 공제와 전력망을 지원합니다.",eco:-0.6,soc:0.2,pass:{'neoreun': 3}},
    {title:"중소기업 납품단가 연동제",desc:"원자재 값이 오르면 납품 단가도 오르게 합니다.",eco:0.6,soc:0,pass:{'donghae': 2}},
    {title:"자영업 손실 보상법",desc:"재난으로 문을 닫은 가게에 손실을 보상합니다.",eco:0.6,soc:-0.1,pass:{'seodeul': 2}},
    {title:"지역화폐 확대법",desc:"지역 상품권 발행에 국비를 대폭 지원합니다.",eco:0.6,soc:-0.2,pass:{'seodeul': 2, 'seom': 2}},
    {title:"공무원 연금 개혁안",desc:"공무원 연금을 국민연금 수준에 맞춥니다.",eco:-0.6,soc:0,pass:{}},
    {title:"국민연금 보장 강화안",desc:"소득대체율을 올리고 보험료도 올립니다.",eco:0.7,soc:-0.1,pass:{'seodeul': 3}},
    {title:"검찰 수사권 축소법",desc:"검찰의 직접 수사 범위를 줄입니다.",eco:0.2,soc:0.5,pass:{}},
    {title:"경찰력 강화법",desc:"순찰 인력과 장비를 크게 늘립니다.",eco:-0.2,soc:-0.7,pass:{'neoreun': 2}},
    {title:"마약 범죄 엄벌법",desc:"마약 유통에 무기징역까지 선고할 수 있게 합니다.",eco:0,soc:-0.7,pass:{}},
    {title:"사형제 폐지안",desc:"사형을 종신형으로 바꿉니다.",eco:0.1,soc:0.8,pass:{'seodeul': -2}},
    {title:"언론 중재법",desc:"허위 보도에 징벌적 손해배상을 물립니다.",eco:0.2,soc:-0.4,pass:{}},
    {title:"공영방송 독립법",desc:"공영방송 이사회를 정치권 밖에서 뽑습니다.",eco:0.1,soc:0.6,pass:{}},
    {title:"선거 연령 하향안",desc:"투표 연령을 16세로 낮춥니다.",eco:0.2,soc:0.7,pass:{'hanbyeol': 2}},
    {title:"비례대표 확대안",desc:"지역구를 줄이고 비례 의석을 늘립니다.",eco:0.2,soc:0.4,pass:{}},
    {title:"수도 이전 특별법",desc:"행정 수도를 중부 지역으로 옮깁니다.",eco:0.4,soc:-0.1,pass:{'hanbyeol': -3, 'seodeul': 3}},
    {title:"관광 비자 면제 확대",desc:"관광객 무비자 입국 국가를 늘립니다.",eco:-0.3,soc:0.6,pass:{'namnyeok': 2, 'seom': 2}},
    {title:"농지 규제 완화법",desc:"농지를 공장·주택 용지로 쉽게 바꿉니다.",eco:-0.6,soc:0,pass:{'neoreun': 2, 'seodeul': -3}},
    {title:"스마트팜 지원법",desc:"첨단 농업 설비에 보조금을 줍니다.",eco:-0.1,soc:0.2,pass:{'seodeul': 3}},
  ];
  // AI 성격. 판을 만들 때 AI 정당마다 하나씩 붙는다(사람 당과 성격 없는 옛 판은 기존 방식 그대로).
  //   act: 남은 행동 칸을 채울 때 고르는 비율 · spend: 남은 돈의 몇 분의 1까지 한 행동에 쓰는지 · propose: 법안 발의 확률
  //   deal: 연맹 제안을 받을 때 더하는 호감 · line: 노선 차이를 얼마나 따지는지(배수) · ask: 먼저 연맹을 제안하는 정도(배수)
  const PERSONAS={
    principled:{name:'원칙주의',desc:'노선에 맞는 표결과 입법에 매달립니다. 노선이 먼 당과는 좀처럼 손잡지 않습니다.',
      act:{rally:.4,talent:.1,policy:.25,attack:.1,expose:.05,poach:0},spend:3,propose:.3,deal:-3,line:1.4,ask:.7},
    populist:{name:'포퓰리스트',desc:'여론을 따라 유세에 크게 씁니다. 인기 있는 법이면 노선이 조금 달라도 찬성합니다.',
      act:{rally:.6,talent:.1,policy:.15,attack:.06,expose:.04,poach:.02},spend:2.5,propose:.25,deal:1,line:.8,ask:1},
    dealer:{name:'협상가',desc:'연맹과 거래로 세를 불립니다. 제안을 잘 받아들이고 먼저 손을 내밉니다.',
      act:{rally:.45,talent:.2,policy:.15,attack:.05,expose:.03,poach:.02},spend:3,propose:.25,deal:2,line:.9,ask:1.3},
    hawk:{name:'강경파',desc:'1당과 정부를 집요하게 공격합니다. 폭로와 의원 빼오기를 즐깁니다.',
      act:{rally:.55,talent:.1,policy:.08,attack:.12,expose:.1,poach:.05},spend:3,propose:.25,deal:-1,line:1,ask:.8},
    steady:{name:'실리형',desc:'자금과 조직을 아낍니다. 인재와 당원을 꾸준히 모으고 큰 모험을 피합니다.',
      act:{rally:.35,talent:.3,policy:.15,attack:.05,expose:.02,poach:0},spend:4,propose:.25,deal:2,line:1,ask:1},
  };
  const personaOf=p=>p&&p.bot&&!p.fixed&&own(PERSONAS,p.persona)?PERSONAS[p.persona]:null;
  const EVENTS=[
    {title:'경기 침체 경보',text:'성장률 전망이 꺾였습니다. 분배 정당에 여론이 쏠리고 후원이 줄어듭니다.',eco:1,soc:0,amt:4,funds:-2},
    {title:'수출 호황',text:'수출이 사상 최대치를 기록했습니다. 시장 노선이 힘을 받습니다.',eco:-1,soc:0,amt:4,funds:2},
    {title:'접경 긴장 고조',text:'접경에서 군사 충돌 위기가 커졌습니다. 안보 노선이 힘을 받습니다.',eco:0,soc:-1,amt:5},
    {title:'청년 실업 대란',text:'청년 실업률이 치솟아 개방·분배 노선에 관심이 몰립니다.',eco:.6,soc:.6,amt:4},
    {title:'정치 불신 확산',text:'여론조사에서 정치권 신뢰가 바닥을 쳤습니다. 모든 정당 신뢰 −3.',eco:0,soc:0,amt:0,trust:-3},
    {title:'대형 수해',text:'집중호우 피해 대응을 두고 정부 책임론이 나옵니다.',eco:0,soc:0,amt:0,blameTop:6},
    {title:'정치자금 수사',text:'검찰이 정치자금 수사에 나섰습니다. 자금이 넉넉한 정당이 의심받습니다.',eco:0,soc:0,amt:0,blameRich:5},
    {title:'국제대회 호성적',text:'국제대회 선전으로 사회 분위기가 좋아집니다. 모든 정당 결속 +3.',eco:0,soc:0,amt:0,unity:3},
    {title:'집값 급등',text:'주택 가격이 폭등하고 정부 책임론이 나옵니다.',eco:0,soc:0,amt:0,blameTop:5},
    {title:'자영업 위기',text:'자영업 폐업이 이어져 규제 완화와 안정을 바라는 목소리가 커집니다.',eco:-.6,soc:-.6,amt:4},
    {title:'문화 개방 바람',text:'해외 교류가 늘며 개방 노선이 힘을 받습니다.',eco:0,soc:1,amt:5},
    {title:'기술 산업 약진',text:'신산업 성과가 이어져 혁신 노선이 주목받습니다.',eco:-.6,soc:.6,amt:4},
    {title:'지방 의료 공백',text:'지방 응급실이 문을 닫아 민생 노선에 관심이 쏠립니다.',eco:.6,soc:-.6,amt:4},
    {title:'조용한 분기',text:'이번 분기는 큰 사건 없이 지나갔습니다.',eco:0,soc:0,amt:0},
  ];
  // ── 사건 시스템 ──
  // 사건은 분기가 시작할 때 공개되고(g.event), 모든 정당이 그 분기 결정과 함께 대응 하나를 고른다(mv.react).
  // 정부가 제대로 대응하지 않으면 다음 분기로 번지는 사건(follow)이 있고, 한 정당을 겨냥하는 사건(target)도 있다.
  // 효과 필드는 옛 EVENTS와 같다: eco·soc·amt 노선 바람, funds 후원 증감, trust·unity 모든 당, blameTop 정부 책임, blameRich 자금 많은 당
  //   hitTrust·hitUnity: 대상 당만 · chain: 다른 사건에서 번져서만 나온다 · resp: 고를 수 있는 대응
  const EVENTS2={
    recession:{title:'경기 침체 경보',text:'성장률 전망이 꺾였습니다. 분배 정당에 여론이 쏠리고 후원이 줄어듭니다. 정부가 대책을 내놓지 않으면 다음 분기 금융 불안으로 번집니다.',eco:1,soc:0,amt:4,funds:-2,resp:['stimulus','ride','blame'],follow:{key:'finance',unless:'stimulus'}},
    finance:{title:'금융 불안',text:'침체 경보에 정부가 손을 놓아 금융시장이 흔들립니다. 정부 책임론이 커지고 후원이 더 줄어듭니다.',blameTop:6,funds:-2,resp:['blame','unity'],chain:true},
    boom:{title:'수출 호황',text:'수출이 사상 최대치를 기록했습니다. 시장 노선이 힘을 받습니다.',eco:-1,soc:0,amt:4,funds:2,resp:['ride']},
    border:{title:'접경 긴장 고조',text:'접경에서 군사 충돌 위기가 커졌습니다. 안보 노선이 힘을 받습니다.',eco:0,soc:-1,amt:5,resp:['ride','unity']},
    youth:{title:'청년 실업 대란',text:'청년 실업률이 치솟아 개방·분배 노선에 관심이 몰립니다.',eco:.6,soc:.6,amt:4,resp:['ride','blame']},
    distrust:{title:'정치 불신 확산',text:'여론조사에서 정치권 신뢰가 바닥을 쳤습니다. 모든 정당 신뢰 −3.',trust:-3,resp:['reform']},
    flood:{title:'대형 수해',text:'집중호우 피해 대응을 두고 정부 책임론이 나옵니다. 정부가 현장을 챙기지 않으면 다음 분기 복구 지연 논란으로 번집니다.',blameTop:6,resp:['relief','blame'],follow:{key:'recovery',unless:'relief'}},
    recovery:{title:'복구 지연',text:'재난 복구가 늦어져 피해 지역의 분노가 정부로 향합니다.',blameTop:5,resp:['relief','blame'],chain:true},
    fundprobe:{title:'정치자금 수사',text:'검찰이 정치자금 수사에 나섰습니다. 자금이 넉넉한 정당이 의심받습니다.',blameRich:5,resp:['reform']},
    sports:{title:'국제대회 호성적',text:'국제대회 선전으로 사회 분위기가 좋아집니다. 모든 정당 결속 +3.',unity:3,resp:[]},
    housing:{title:'집값 급등',text:'주택 가격이 폭등하고 정부 책임론이 나옵니다.',blameTop:5,resp:['stimulus','blame']},
    business:{title:'자영업 위기',text:'자영업 폐업이 이어져 규제 완화와 안정을 바라는 목소리가 커집니다.',eco:-.6,soc:-.6,amt:4,resp:['ride','stimulus']},
    culture:{title:'문화 개방 바람',text:'해외 교류가 늘며 개방 노선이 힘을 받습니다.',eco:0,soc:1,amt:5,resp:['ride']},
    tech:{title:'기술 산업 약진',text:'신산업 성과가 이어져 혁신 노선이 주목받습니다.',eco:-.6,soc:.6,amt:4,resp:['ride']},
    medical:{title:'지방 의료 공백',text:'지방 응급실이 문을 닫아 민생 노선에 관심이 쏠립니다.',eco:.6,soc:-.6,amt:4,resp:['ride','relief']},
    quiet:{title:'조용한 분기',text:'이번 분기는 큰 사건 없이 지나갔습니다.',resp:[]},
    scandal:{title:'정치자금 의혹',text:'한 정당 지도부가 불법 정치자금 의혹을 받습니다. 대상 당 신뢰 −4. 대상 당의 대응에 따라 다른 당의 공세가 먹히는 정도가 달라집니다.',target:true,hitTrust:4,resp:['apology','defy','cut','attack']},
    feud:{title:'계파 갈등 폭발',text:'한 정당에서 공천을 두고 계파 싸움이 터졌습니다. 대상 당 결속 −6.',target:true,hitUnity:6,resp:['compromise','unity','attack']},
    pandemic:{title:"신종 감염병 유행",text:"새 감염병이 퍼지기 시작했습니다. 정부가 현장을 챙기지 않으면 다음 분기 대유행으로 번집니다.",trust:-1,resp:["relief", "stimulus", "blame"],follow:{"key": "pandemic2", "unless": "relief"}},
    pandemic2:{title:"감염병 대유행",text:"방역에 실패해 병상이 부족하고 가게들이 문을 닫습니다. 정부 책임론이 거셉니다.",blameTop:7,funds:-2,resp:["relief", "blame", "unity"],chain:true},
    strike:{title:"항만 총파업",text:"남녘 항만 노조가 총파업에 들어갔습니다. 정부가 중재하지 않으면 장기 파업으로 번집니다.",region:"namnyeok",reco:1,rsoc:0,ramt:5,resp:["mediate", "local", "ride"],follow:{"key": "strike2", "unless": "mediate"}},
    strike2:{title:"장기 파업",text:"파업이 길어져 물류가 멈췄습니다. 수출 기업과 시민 모두 정부를 탓합니다.",blameTop:5,funds:-1,resp:["mediate", "blame", "protest"],chain:true},
    factory:{title:"공장 대형 화재",text:"동해 공단 공장에서 큰불이 나 안전 규제 논쟁이 붙었습니다.",region:"donghae",reco:1,rsoc:0.2,ramt:5,trust:-1,resp:["relief", "local", "blame"]},
    drought:{title:"가뭄과 흉작",text:"서들 농촌에 가뭄이 이어져 농가가 시름에 빠졌습니다.",region:"seodeul",reco:0.6,rsoc:-0.6,ramt:5,resp:["relief", "local", "ride"]},
    newtown:{title:"신도시 교통 대란",text:"너른 신도시권 출퇴근길이 마비돼 광역 교통 대책 요구가 커집니다.",region:"neoreun",reco:-0.5,rsoc:0,ramt:5,resp:["local", "stimulus", "blame"]},
    bordershot:{title:"접경 지역 포격",text:"접경에서 포격이 오갔습니다. 정부를 중심으로 뭉치자는 여론이 생깁니다.",region:"bukbang",reco:0,rsoc:-1,ramt:6,boostTop:3,resp:["unity", "ride", "coop"]},
    island:{title:"섬 지역 의료 헬기 사고",text:"응급 헬기 사고로 섬·산간 의료 공백이 드러났습니다.",region:"seom",reco:0.6,rsoc:0,ramt:6,resp:["relief", "local"]},
    capitalrent:{title:"수도권 전세 사기",text:"한별 수도권에서 전세 사기 피해가 잇따릅니다. 청년층이 분노합니다.",region:"hanbyeol",reco:0.6,rsoc:0.4,ramt:5,resp:["relief", "local", "blame"]},
    inflation:{title:"물가 급등",text:"장바구니 물가가 치솟아 생활비 부담이 커졌습니다.",eco:0.6,soc:0,amt:3,blameTop:3,resp:["stimulus", "blame", "ride"]},
    taxshock:{title:"세수 결손",text:"세금이 예상보다 덜 걷혀 나라 살림에 구멍이 났습니다. 긴급 재정 법안이 올라옵니다.",funds:-1,resp:["coop", "blame"],bill:{title:"긴급 재정 건전화법",desc:"지출을 줄이고 일부 세율을 올려 적자를 메웁니다.",eco:-0.3,soc:0}},
    cyber:{title:"대규모 해킹",text:"공공기관 전산망이 해킹당했습니다. 사이버 안보 긴급 법안이 올라옵니다.",eco:0,soc:-0.7,amt:3,resp:["ride", "blame"],bill:{title:"사이버 안보 긴급법",desc:"정보기관에 민간 통신망 감시 권한을 줍니다.",eco:0,soc:-0.7}},
    aiboom:{title:"AI 일자리 충격",text:"AI 자동화로 사무직 일자리가 줄어든다는 보고서가 나왔습니다.",eco:0.6,soc:0.4,amt:4,resp:["ride", "debate"]},
    birthrate:{title:"출생아 수 역대 최저",text:"출생아 수가 또 최저를 기록했습니다. 가족 지원 경쟁이 붙습니다.",eco:0.4,soc:-0.4,amt:3,resp:["ride", "coop"]},
    olympics:{title:"국제 행사 유치",text:"대형 국제 행사 유치에 성공해 분위기가 들뜹니다.",boostTop:3,unity:2,resp:["ride", "local"]},
    scandal2:{title:"보좌진 갑질 폭로",text:"한 정당 의원의 보좌진 갑질이 폭로됐습니다. 대상 당 신뢰 −3.",target:true,hitTrust:3,resp:["apology", "cut", "resign", "attack"]},
    defector:{title:"의원 탈당 선언",text:"한 정당의 중진 의원이 탈당을 예고했습니다. 대상 당 결속 −5.",target:true,hitUnity:5,resp:["compromise", "unity", "attack"]},
    nocon_storm:{title:"내각 총사퇴 요구",text:"정부 수반 당의 신뢰가 바닥을 치자 총사퇴 요구가 쏟아집니다. 대상 당 신뢰 −3.",target:true,hitTrust:3,when:"pmWeak",resp:["coop", "resign", "protest", "attack"]},
    tvdebate:{title:"총선 TV 토론",text:"총선을 앞두고 정당 대표 TV 토론이 열립니다. 준비한 만큼 결과가 갈립니다.",when:"election",resp:["debate", "ride"]},
    split:{title:"분당 위기",text:"결속이 무너진 정당에서 분당 이야기가 나옵니다. 대상 당 결속 −4.",target:true,hitUnity:4,when:"split",resp:["compromise", "unity", "resign", "attack"]},
    surge:{title:"신드롬급 돌풍",text:"신뢰가 치솟은 정당에 언론의 검증이 몰립니다. 대상 당 신뢰 −2.",target:true,hitTrust:2,when:"surge",resp:["apology", "defy", "attack"]},
    fatigue:{title:"정권 심판론",text:"집권이 길어지자 이번에는 바꿔야 한다는 여론이 커집니다. 대상 당 신뢰 −3.",target:true,hitTrust:3,when:"longGov",resp:["coop", "defy", "blame"]},
    kr_semi:{title:"반도체 수출 신기록",text:"반도체 수출이 사상 최대를 기록했습니다. 시장 노선이 힘을 받습니다.",country:"kr",eco:-0.8,soc:0.2,amt:4,funds:1,resp:["ride"]},
    kr_med:{title:"의대 정원 갈등",text:"의대 정원 확대를 두고 의료계가 집단행동에 나섰습니다. 정부가 중재하지 않으면 의료 공백으로 번집니다.",country:"kr",trust:-1,resp:["mediate", "blame", "ride"],follow:{"key": "medical", "unless": "mediate"}},
    kr_missile:{title:"북한 미사일 발사",text:"북한이 탄도미사일을 쏘았습니다. 안보 노선에 관심이 쏠립니다.",country:"kr",eco:0,soc:-1,amt:4,region:"bukbang",reco:0,rsoc:-1,ramt:4,resp:["ride", "unity"]},
    kr_local:{title:"지방 소멸 경고",text:"지방 군 단위 절반이 소멸 위기라는 보고서가 나왔습니다.",country:"kr",region:"seodeul",reco:0.6,rsoc:-0.3,ramt:5,resp:["local", "ride"]},
    kr_jeonse:{title:"청년 주거 시위",text:"청년들이 주거비 대책을 요구하며 광장에 모였습니다.",country:"kr",eco:0.6,soc:0.5,amt:4,resp:["ride", "coop", "protest"]},
    jp_yen:{title:"엔저 장기화",text:"엔화 약세가 이어져 수입 물가가 오르고 수출 기업은 웃습니다.",country:"jp",eco:0.4,soc:0,amt:3,funds:1,resp:["stimulus", "ride", "blame"]},
    jp_quake:{title:"대지진 발생",text:"큰 지진이 났습니다. 정부가 현장을 챙기지 않으면 복구 지연 논란으로 번집니다.",country:"jp",blameTop:4,resp:["relief", "blame", "unity"],follow:{"key": "recovery", "unless": "relief"}},
    jp_rice:{title:"쌀값 급등",text:"쌀값이 폭등해 비축미 방출 요구가 커집니다.",country:"jp",blameTop:3,region:"seodeul",reco:0.5,rsoc:-0.5,ramt:4,resp:["stimulus", "blame", "local"]},
    jp_defense:{title:"방위비 증액 논쟁",text:"방위비를 두 배로 늘리는 계획을 두고 논쟁이 붙었습니다.",country:"jp",eco:-0.2,soc:-0.8,amt:4,resp:["ride", "debate"]},
    jp_party:{title:"파티권 의혹",text:"한 정당의 정치자금 파티 수입 누락 의혹이 불거졌습니다. 대상 당 신뢰 −4.",country:"jp",target:true,hitTrust:4,resp:["apology", "cut", "resign", "attack"]},
    us_shutdown:{title:"연방정부 셧다운 위기",text:"예산안이 막혀 연방정부가 문을 닫을 위기입니다. 정부가 협치하지 않으면 셧다운으로 번집니다.",country:"us",trust:-1,resp:["coop", "blame", "protest"],follow:{"key": "us_shutdown2", "unless": "coop"}},
    us_shutdown2:{title:"연방정부 셧다운",text:"연방정부가 멈췄습니다. 공무원 무급 휴직에 여론이 나빠집니다.",country:"us",blameTop:6,trust:-2,resp:["coop", "blame"],chain:true},
    us_court:{title:"대법원 판결 논쟁",text:"대법원의 사회 쟁점 판결로 나라가 둘로 갈렸습니다.",country:"us",eco:0,soc:0.8,amt:4,resp:["ride", "protest", "debate"]},
    us_tariff:{title:"관세 전쟁",text:"주요 교역국과 관세 보복이 오갑니다. 농가와 공장이 흔들립니다.",country:"us",funds:-1,region:"seodeul",reco:0.3,rsoc:-0.5,ramt:4,resp:["stimulus", "ride", "blame"]},
    us_border:{title:"국경 이민 급증",text:"남부 국경으로 이민자가 몰려 이민 정책 논쟁이 커집니다.",country:"us",eco:0,soc:-0.8,amt:4,resp:["ride", "blame"]},
    us_gun:{title:"총기 참사",text:"총기 참사 뒤 총기 규제 논쟁이 다시 불붙었습니다.",country:"us",eco:0,soc:0.7,amt:4,resp:["ride", "unity"]},
    uk_nhs:{title:"NHS 대기 명단 최장",text:"국민보건서비스 대기 명단이 역대 최장을 기록했습니다.",country:"uk",eco:0.7,soc:0,amt:4,blameTop:3,resp:["stimulus", "blame", "ride"]},
    uk_scot:{title:"스코틀랜드 독립 여론",text:"스코틀랜드 독립 찬성 여론이 과반을 넘었습니다.",country:"uk",trust:-1,resp:["unity", "ride", "debate"]},
    uk_living:{title:"생활비 위기",text:"에너지와 식료품 값이 올라 생활비 위기가 깊어집니다.",country:"uk",eco:0.6,soc:0,amt:4,funds:-1,resp:["stimulus", "blame", "ride"]},
    uk_eu:{title:"유럽연합 관계 재협상",text:"유럽연합과의 무역 협정 재협상을 두고 논쟁이 붙었습니다.",country:"uk",eco:-0.2,soc:0.7,amt:4,resp:["ride", "debate"]},
    uk_royal:{title:"왕실 경사",text:"왕실 경사로 나라 분위기가 들뜹니다. 모든 정당 결속 +3.",country:"uk",unity:3,resp:[]},
    fr_pension:{title:"연금 개혁 시위",text:"연금 수령 나이를 늦추는 계획에 대규모 시위가 일어났습니다. 정부가 중재하지 않으면 총파업으로 번집니다.",country:"fr",eco:0.6,soc:0,amt:3,resp:["mediate", "protest", "ride"],follow:{"key": "strike2", "unless": "mediate"}},
    fr_farmers:{title:"농민 트랙터 시위",text:"농민들이 트랙터로 고속도로를 막았습니다.",country:"fr",region:"seodeul",reco:0.3,rsoc:-0.6,ramt:5,resp:["local", "mediate", "blame"]},
    fr_riots:{title:"교외 소요 사태",text:"교외 지역에서 소요가 번져 치안과 사회 통합 논쟁이 붙었습니다.",country:"fr",eco:0,soc:-0.6,amt:4,resp:["ride", "unity", "coop"]},
    fr_energy:{title:"에너지 가격 급등",text:"전기와 가스 값이 급등해 가격 상한 요구가 커집니다.",country:"fr",eco:0.6,soc:0,amt:3,blameTop:2,resp:["stimulus", "blame"]},
    fr_493:{title:"표결 없는 법안 통과 논란",text:"정부가 표결 없이 법안을 통과시키는 헌법 조항을 쓰려 해 반발이 큽니다. 대상 당 신뢰 −3.",country:"fr",target:true,hitTrust:3,when:"longGov",resp:["coop", "defy", "protest", "attack"]},
  };
  // 대응. cost 자금(억 단위) · treasury 국고 · trust·unity 우리 당 · govTrust 정부 수반 당 신뢰 · ride 노선 홍보(맞으면 +ride, 어긋나면 −1)
  //   who: gov 정부 수반 당만 · opp 정부에 들지 않은 당만 · target 대상 당만 · other 대상이 아닌 당만(대상이 있는 사건)
  //   risk 반반 확률 · shield 대상 당이 받는 공세를 줄이는 비율 · hit 공세로 대상 당 신뢰를 깎는 양
  const RESP={
    stimulus:{label:'긴급 대책 발표',desc:'정부 수반 당만. 국고 4를 써서 대책을 내놓습니다. 신뢰 +2, 사건이 다음 분기로 번지지 않습니다.',who:'gov',treasury:4,trust:2},
    relief:{label:'현장 지원',desc:'자금 3을 써서 피해 현장을 챙깁니다. 신뢰 +3. 정부 수반 당이 고르면 사건이 다음 분기로 번지지 않습니다.',cost:3,trust:3},
    blame:{label:'정부 책임 추궁',desc:'정부에 들지 않은 당만. 정부 수반 당 신뢰 −2, 우리 신뢰 +1.',who:'opp',govTrust:-2,trust:1},
    ride:{label:'노선 홍보',desc:'자금 1. 사건이 우리 노선 쪽이면 신뢰 +3, 반대쪽이면 신뢰 −1.',cost:1,ride:3},
    unity:{label:'당내 결속',desc:'흔들리는 당을 다잡습니다. 결속 +4.',unity:4},
    reform:{label:'정치 개혁 선언',desc:'자금 2. 깨끗한 정치를 약속합니다. 신뢰 +3.',cost:2,trust:3},
    apology:{label:'사과',desc:'대상 당만. 신뢰 −2, 결속 +3. 다른 당의 공세 피해가 절반으로 줄어듭니다.',who:'target',trust:-2,unity:3,shield:.5},
    defy:{label:'정면 돌파',desc:'대상 당만. 반반 확률로 신뢰 +2 또는 신뢰 −8.',who:'target',risk:{win:{trust:2},lose:{trust:-8}}},
    cut:{label:'꼬리 자르기',desc:'대상 당만. 관련자를 내보냅니다. 결속 −6, 신뢰 −1, 다른 당의 공세가 먹히지 않습니다.',who:'target',unity:-6,trust:-1,shield:1},
    compromise:{label:'계파 나눠 먹기',desc:'대상 당만. 자금 3으로 계파를 달랩니다. 결속 +7.',who:'target',cost:3,unity:7},
    attack:{label:'공세',desc:'대상이 아닌 당만. 자금 2로 대상 당을 몰아붙입니다. 대상 당 신뢰 −2.',who:'other',cost:2,hit:2},
    debate:{label:'토론 준비',desc:'자금 2. 반반 확률로 신뢰 +4 또는 신뢰 −2.',cost:2,risk:{win:{trust:4},lose:{trust:-2}}},
    protest:{label:'장외 투쟁',desc:'정부에 들지 않은 당만. 결속 +5, 우리 신뢰 −1, 정부 수반 당 신뢰 −1.',who:'opp',unity:5,trust:-1,govTrust:-1},
    coop:{label:'협치 제안',desc:'정부 수반 당만. 야당에 손을 내밉니다. 신뢰 +3, 결속 −2.',who:'gov',trust:3,unity:-2},
    resign:{label:'지도부 사퇴',desc:'대상 당만. 신뢰 +5, 결속 −5. 다른 당의 공세가 먹히지 않습니다.',who:'target',trust:5,unity:-5,shield:1},
    local:{label:'지역 공약',desc:'자금 2. 사건이 일어난 권역의 우리 지지 기반 +4.',cost:2,local:4},
    mediate:{label:'중재 나서기',desc:'자금 2. 신뢰 +2. 정부 수반 당이 고르면 사건이 다음 분기로 번지지 않습니다.',cost:2,trust:2},
  };
  // 조건부 사건: 판 상황이 맞을 때만 나온다(분기마다 30% 확률로 일반 사건 대신). target은 그 상황의 당을 겨냥한다.
  const WHEN={
    pmWeak:g=>{const p=pmOf(g);return!!p&&p.trust<40},
    election:g=>isGeneralRound(g),
    split:g=>g.parties.some(p=>!p.fixed&&p.seats>0&&p.unity<34),
    surge:g=>g.parties.some(p=>!p.fixed&&p.seats>0&&p.trust>=76&&p.id!==g.pmParty),
    longGov:g=>{const p=pmOf(g);return!!p&&g.round>=6&&p.trust<48},
  };
  const WHEN_TARGET={
    pmWeak:g=>g.pmParty,longGov:g=>g.pmParty,
    split:g=>g.parties.filter(p=>!p.fixed&&p.seats>0).sort((a,b)=>a.unity-b.unity)[0].id,
    surge:g=>g.parties.filter(p=>!p.fixed&&p.seats>0&&p.id!==g.pmParty).sort((a,b)=>b.trust-a.trust)[0].id,
  };
  // 일반 사건 덱: 번진 사건·조건부 사건을 빼고, 나라 전용 사건은 그 나라에서만
  const eventPool=g=>Object.keys(EVENTS2).filter(k=>{const e=EVENTS2[k];return!e.chain&&!e.when&&(!e.country||e.country===g.country)});
  const respCost=(g,p,k)=>(RESP[k].cost||0)*U;
  // 이 정당이 지금 사건에 고를 수 있는 대응(돈이 모자라면 뺀다). 무소속 묶음과 사건이 없는 판은 없음.
  function reactOpts(g,p){
    const e=g.event,ev=e&&EVENTS2[e.key];if(!ev||!p||p.fixed||e.round!==g.round)return[];
    const top=eventTop(g);
    return ev.resp.filter(k=>{const R=RESP[k];
      if(R.who==='gov'&&(!top||top.id!==p.id))return false;
      if(R.who==='opp'&&(inGov(g,p)||(top&&top.id===p.id)))return false;
      if(R.who==='target'&&e.target!==p.id)return false;
      if(R.who==='other'&&(!e.target||e.target===p.id))return false;
      if(R.local&&!ev.region)return false;
      if(R.treasury&&g.treasury<R.treasury*U)return false;
      return respCost(g,p,k)<=p.funds;
    });
  }
  // 사건 책임을 지는 쪽: 정부 수반 당, 없으면 의석 1당
  const eventTop=g=>pmOf(g)||g.parties.filter(p=>!p.fixed).sort((a,b)=>b.seats-a.seats)[0];
  // 다음 사건 뽑기. 번진 사건이 있으면 그것, 아니면 섞어 둔 순서대로. 대상 사건은 자금·의석이 많은 당이 걸리기 쉽다.
  function drawEvent(g,r,forced){
    const pool=eventPool(g),recent=g.evRecent||[];
    if(!g.evDeck||!g.evDeck.length||g.evDeck.some(k=>!pool.includes(k))){g.evDeck=shuffle(pool.slice(),r);g.evN=0}
    let key=forced&&own(EVENTS2,forced)?forced:null;
    if(!key){
      const cands=Object.keys(EVENTS2).filter(k=>{const e=EVENTS2[k];return e.when&&(!e.country||e.country===g.country)&&!recent.includes(k)&&WHEN[e.when](g)});
      if(cands.length&&r()<.3)key=cands[Math.floor(r()*cands.length)];
    }
    if(!key){key=g.evDeck[(g.evN||0)%g.evDeck.length];g.evN=(g.evN||0)+1;if(g.evN>=g.evDeck.length){g.evDeck=shuffle(pool.slice(),r);g.evN=0}}
    const ev=EVENTS2[key],e={key,round:g.round};
    if(ev.target){
      if(ev.when&&WHEN_TARGET[ev.when])e.target=WHEN_TARGET[ev.when](g);
      else{
        const live=g.parties.filter(p=>!p.fixed&&p.seats>0);
        const w=live.map(p=>p.seats/TOTAL+Math.max(0,p.funds)/Math.max(1,live.reduce((n,x)=>n+Math.max(0,x.funds),0))+.15);
        let x=r()*w.reduce((a,b)=>a+b,0),i=0;for(;i<w.length-1;i++){if(x<w[i])break;x-=w[i]}
        e.target=live[i]?live[i].id:null;
      }
      if(!e.target){e.key='quiet';delete e.target}
    }
    g.evRecent=recent.concat(e.key).slice(-6);
    g.event=e;
    // 긴급 법안을 거는 사건은 이번 분기 본회의에 올린다(정부·의원 법안과 함께 표결).
    const B=EVENTS2[e.key].bill;
    if(B&&g.agenda)g.agenda.push({id:'a'+(g.seq++),kind:'emer',title:B.title,desc:B.desc,eco:B.eco,soc:B.soc,pass:B.pass||{},by:null});
  }
  // AI 대응 고르기(성격별). 사람이 수를 내지 않았을 때도 이걸로 대신 고른다.
  function botReact(g,p,r){
    const opts=reactOpts(g,p);if(!opts.length)return null;
    const k=personaOf(p)?p.persona:'';const has=x=>opts.includes(x);const e=g.event,ev=EVENTS2[e.key];
    if(e.target===p.id){
      const pref={principled:'apology',populist:'defy',dealer:'apology',hawk:'defy',steady:'cut'}[k]||'apology';
      if(has('compromise')&&(p.unity<45||k==='dealer'))return'compromise';
      if(has('unity'))return'unity';
      return has(pref)?pref:opts[0];
    }
    const isTop=eventTop(g)&&eventTop(g).id===p.id;
    if(has('resign')&&(p.trust<38||k==='principled')&&r()<.6)return'resign';
    if(has('stimulus')&&r()<(k==='hawk'?.5:.85))return'stimulus';
    if(has('mediate')&&isTop&&ev.follow&&r()<(k==='hawk'?.4:.8))return'mediate';
    if(has('coop')&&r()<({dealer:.8,steady:.6,principled:.4}[k]||.3))return'coop';
    if(has('protest')&&r()<({hawk:.8,principled:.35}[k]||.15))return'protest';
    if(has('debate')&&r()<({populist:.7,hawk:.6,principled:.4}[k]||.35))return'debate';
    if(has('local')&&p.eco*(ev.reco||0)+p.soc*(ev.rsoc||0)>-.1&&r()<.5)return'local';
    if(has('relief')&&eventTop(g).id===p.id&&r()<(k==='hawk'?.5:.85))return'relief';
    if(has('attack')&&!isAlly(p,e.target)&&r()<({hawk:.9,populist:.5}[k]||.2))return'attack';
    if(has('blame')&&r()<({hawk:1,populist:.6}[k]||.3))return'blame';
    if(has('ride')&&p.eco*(ev.eco||0)+p.soc*(ev.soc||0)>.1&&r()<(k==='principled'?1:.7))return'ride';
    if(has('relief')&&r()<(k==='populist'?.6:.25))return'relief';
    if(has('reform')&&(p.trust<50||k==='populist')&&r()<.6)return'reform';
    if(has('unity')&&p.unity<50)return'unity';
    return null;
  }
  // 이번 분기 사건과 대응을 적용하고 결과 보고를 돌려준다. 다음 분기로 번질 사건 키도 함께.
  function applyEvent(g,plans,r,top){
    const e=g.event,ev=EVENTS2[e.key],tgt=e.target?party(g,e.target):null;top=top||eventTop(g);
    for(const p of g.parties){
      if(ev.amt)p.trust+=(p.eco*(ev.eco||0)+p.soc*(ev.soc||0))*ev.amt;
      if(ev.funds)p.funds+=ev.funds*U*(p.income0!=null?Math.min(1,p.income0/4/(10*U)):1);
      if(ev.trust)p.trust+=ev.trust;
      if(ev.unity)p.unity+=ev.unity;
      if(ev.blameRich&&p.funds>(p.income0!=null?p.income0/2:25))p.trust-=ev.blameRich;
    }
    if(ev.blameTop&&top)top.trust-=ev.blameTop;
    if(tgt){if(ev.hitTrust)tgt.trust-=ev.hitTrust;if(ev.hitUnity)tgt.unity-=ev.hitUnity}
    if(ev.boostTop&&top)top.trust+=ev.boostTop;
    // 지역 사건: 그 권역에서 사건 쪽 노선의 당은 기반이 늘고 반대쪽은 준다
    if(ev.region&&own(REG,ev.region)&&ev.ramt)for(const p of g.parties)if(!p.fixed)p.reg[ev.region]+=(p.eco*(ev.reco||0)+p.soc*(ev.rsoc||0))*ev.ramt;
    const picks={},lines=[];
    for(const p of g.parties){const k=plans[p.id]&&plans[p.id].react;if(k&&own(RESP,k)&&ev.resp.includes(k))picks[p.id]=k} // 분기 초에 sanitize에서 이미 확인함
    // 대상 당이 먼저 대응해야 공세가 얼마나 먹힐지 정해진다.
    const order=g.parties.filter(p=>picks[p.id]).sort((a,b)=>(b.id===e.target)-(a.id===e.target));
    let shield=0;
    for(const p of order){
      const k=picks[p.id],R=RESP[k];let note='';
      if(R.treasury&&g.treasury<R.treasury*U){lines.push({id:p.id,react:k,label:R.label,note:'국고 부족',failed:true});delete picks[p.id];continue}
      p.funds-=respCost(g,p,k);
      if(R.treasury)g.treasury-=R.treasury*U;
      if(R.trust)p.trust+=R.trust;
      if(R.unity)p.unity+=R.unity;
      if(R.govTrust&&top&&top.id!==p.id)top.trust+=R.govTrust;
      if(R.ride){const d=p.eco*(ev.eco||0)+p.soc*(ev.soc||0);p.trust+=d>.1?R.ride:d<-.1?-1:0;note=d>.1?'노선 바람을 탐':d<-.1?'역풍':'효과 없음'}
      if(R.risk){const win=r()<.5,o=win?R.risk.win:R.risk.lose;p.trust+=o.trust||0;note=win?'성공':'실패'}
      if(R.shield)shield=R.shield;
      if(R.local&&ev.region&&own(REG,ev.region)){p.reg[ev.region]+=R.local;note=REG[ev.region].name}
      if(R.hit&&tgt){const h=R.hit*(1-shield);tgt.trust-=h;note=h>0?`${tgt.name} 신뢰 −${Math.round(h*10)/10}`:'먹히지 않음'}
      lines.push({id:p.id,react:k,label:R.label,note});
    }
    // 번짐: 정부 수반 당이 unless 대응을 고르지 않으면 follow로. branch가 있으면 고른 대응에 따라 다른 사건으로 갈린다.
    const tp=top?picks[top.id]:null;
    const follow=ev.branch&&tp&&ev.branch[tp]?ev.branch[tp]:ev.follow&&tp!==ev.follow.unless?ev.follow.key:null;
    return{key:e.key,title:ev.title,text:ev.text,target:e.target||null,reacts:lines,follow};
  }
  const BOTS={
    reform:[['시민개혁당','한서윤'],['열린미래당','오정민']],
    labor:[['민생노동연합','배성훈'],['한겨레민생당','문지혁']],
    liberal:[['자유혁신당','권혜진'],['신경제당','유시온']],
    conservative:[['공화보수당','장하림'],['국가안정당','석준영']],
    center:[['중도통합당','표은재'],['실용국민당','남궁현']],
  };
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const r1=v=>Math.round(v*10)/10;
  const r2=v=>Math.round(v*100)/100;
  const clone=o=>JSON.parse(JSON.stringify(o));
  function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
  function shuffle(arr,r){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  // 한 지역에 기반을 쌓을수록 같은 노력의 효과가 줄어든다.
  const satur=(p,id)=>BAL.sat/(BAL.sat+Math.max(0,p.reg[id]||0));
  const reach=p=>clamp(Math.sqrt(Math.max(p.seats,1)/(TOTAL*.15)),.5,1.15);
  const fit=(p,reg)=>clamp(1-Math.hypot(p.eco-reg.eco,p.soc-reg.soc)/2.2,0,1);
  const party=(g,id)=>g.parties.find(p=>p.id===id);
  // 연대는 연맹 단위로 맺는다. 연맹(g.feds)마다 대표 당(head)과 수반 후보(lead)가 하나씩 있고,
  // 개별 정당은 한 연맹에만 들어간다. 같은 연맹의 당은 모두 서로 연대 상대다.
  // p.allies·p.allyLead는 연맹에서 뽑아 둔 값이라 syncFeds가 늘 다시 맞춘다.
  const MAX_FED=4,MAX_ALLIES=MAX_FED-1;
  const allies=p=>p&&p.allies||[];
  const isAlly=(p,id)=>!!id&&allies(p).includes(id);
  const fedOf=(g,p)=>p&&p.fed&&(g.feds||[]).find(f=>f.id===p.fed)||null;
  const fedById=(g,id)=>(g.feds||[]).find(f=>f.id===id)||null;
  const fedSeats=(g,f)=>f.members.reduce((n,id)=>n+(party(g,id)||{seats:0}).seats,0);
  // 연맹의 노선: 회원 의석으로 가중한 평균
  const fedLine=(g,f)=>{const ms=f.members.map(id=>party(g,id)),w=ms.reduce((n,p)=>n+Math.max(p.seats,1),0);
    return{eco:ms.reduce((n,p)=>n+p.eco*Math.max(p.seats,1),0)/w,soc:ms.reduce((n,p)=>n+p.soc*Math.max(p.seats,1),0)/w}};
  const fedName=(g,head)=>{const base=`${head.name} 연맹`;let n=base;for(let i=2;(g.feds||[]).some(f=>f.name===n);i++)n=`${base} ${i}`;return n};
  const cleanFedName=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,14);
  // 연맹 규칙. admit: 가입·초대·합병·제명을 대표가 정하는지(head) 회원 과반이 정하는지(vote)
  // bind: 연맹 합의 법안만 찬성으로 묶는지(pact) 모든 안건에서 회원이 대표 당의 표를 따르는지(all)
  // cap: 정원(2~MAX_FED개 당) · leave: 탈퇴할 때 잃는 신뢰
  // pres: 대통령 선거에서 연맹 단일 후보로 나가는지(unite) 회원 당이 각자 출마하는지(separate)
  const LEAVE_OPTS=[0,2,5,8,12];
  const DEF_RULES={admit:'head',bind:'pact',cap:MAX_FED,leave:5,pres:'unite'};
  function cleanRules(r){r=r&&typeof r==='object'?r:{};
    return{admit:r.admit==='vote'?'vote':'head',bind:r.bind==='all'?'all':'pact',
      cap:Number.isInteger(r.cap)?clamp(r.cap,2,MAX_FED):MAX_FED,leave:LEAVE_OPTS.includes(r.leave)?r.leave:DEF_RULES.leave,pres:r.pres==='separate'?'separate':'unite'}}
  const rulesOf=f=>cleanRules(f&&f.rules);
  const fedCap=f=>rulesOf(f).cap;
  function syncFeds(g){
    if(!Array.isArray(g.feds))g.feds=[];
    const seen=new Set();
    for(const f of g.feds){
      f.members=(f.members||[]).filter(id=>{const p=party(g,id);if(!p||p.fixed||seen.has(id))return false;seen.add(id);return true});
    }
    g.feds=g.feds.filter(f=>f.members.length>=2);
    for(const p of g.parties){const f=g.feds.find(x=>x.members.includes(p.id));p.fed=f?f.id:null}
    for(const f of g.feds){
      f.rules=cleanRules(f.rules);
      if(!f.members.includes(f.head))f.head=f.members.slice().sort((a,b)=>party(g,b).seats-party(g,a).seats||(a<b?-1:1))[0];
      if(f.lead&&!f.members.includes(f.lead))f.lead=null;
    }
    for(const p of g.parties){
      const f=fedOf(g,p);
      p.allies=f?f.members.filter(id=>id!==p.id):[];
      p.allyLead=f?f.lead||null:null;
      if(!p.yields||typeof p.yields!=='object')p.yields={};
      for(const k in p.yields)if(!isAlly(p,p.yields[k]))delete p.yields[k];
    }
    return g;
  }
  function newFed(g,head,others,lead,name){
    const f={id:'f'+(g.seq++),name:cleanFedName(name)||fedName(g,head),head:head.id,lead:lead?lead.id:null,members:[head.id,...others.map(p=>p.id)],rules:{...DEF_RULES}};
    g.feds=(g.feds||[]).concat(f);return f;
  }
  // 예전 저장 형식(1:1 연대, 연대 하나·yieldReg)을 연맹으로 바꾼다. 이어진 연대 상대는 한 연맹으로 묶는다.
  function normAllies(g){
    for(const p of g.parties){
      if(!Array.isArray(p.allies)){p.allies=p.alliance?[p.alliance]:[];p.yields=p.alliance&&p.yieldReg?{[p.yieldReg]:p.alliance}:{}}
      if(!p.yields||typeof p.yields!=='object')p.yields={};
      delete p.alliance;delete p.yieldReg;
    }
    if(!Array.isArray(g.feds)){
      g.feds=[];const done=new Set();
      for(const p of g.parties.slice().sort((a,b)=>b.seats-a.seats)){
        if(done.has(p.id)||p.fixed||!allies(p).length)continue;
        const ids=[p.id];
        for(let i=0;i<ids.length;i++)for(const id of allies(party(g,ids[i])))if(!ids.includes(id)&&party(g,id)&&!party(g,id).fixed)ids.push(id);
        ids.forEach(id=>done.add(id));if(ids.length<2)continue;
        const lead=ids.map(id=>party(g,id).allyLead).find(id=>id&&ids.includes(id))||null;
        g.feds.push({id:'f'+(g.seq=(g.seq||0)+1),name:fedName(g,p),head:p.id,lead,members:ids.slice(0,MAX_FED)});
      }
    }
    return syncFeds(g);
  }
  // 선거 일정: 6분기마다 총선, 그 사이 3분기째에 재보궐. 마지막 분기에도 총선. 예전 판은 처음 정한 일정을 따른다.
  const CYCLE=6;
  const isGeneralRound=g=>g.round>=g.maxRounds||(!!g.cycle&&g.round%g.cycle===0);
  const isMidRound=g=>g.cycle?g.round%g.cycle===g.cycle/2&&g.round<g.maxRounds:g.round===g.midRound;
  const nextGeneral=g=>g.cycle?Math.min(g.maxRounds,Math.ceil(g.round/g.cycle)*g.cycle):g.maxRounds;
  const nextMid=g=>{if(!g.cycle)return g.round<=g.midRound?g.midRound:null;let m=Math.floor(g.round/g.cycle)*g.cycle+g.cycle/2;if(m<g.round)m+=g.cycle;return m<g.maxRounds?m:null};
  const shut=(p,reg)=>(p.only&&!p.only.includes(reg.id))||(reg.only&&!reg.only.includes(p.pick));
  function raw(p,reg){if(shut(p,reg))return 1;return Math.max(1,6+p.base-(p.fatigue||0)+(p.m0?clamp(15*Math.log(p.members/p.m0),-4,8):0)+(p.home&&p.home[reg.id]||0)+fit(p,reg)*24+(p.reg[reg.id]||0)+(p.trust-50)*.2+(p.unity-50)*.06+p.talent*.7+(p.check||0))}
  function regionShares(g,reg){
    const base=Object.fromEntries(g.parties.map(p=>[p.id,raw(p,reg)]));
    // 선거 협력: 후보를 양보한 지역에서는 그 당 표의 상당수가 연대 상대에게 간다.
    for(const p of g.parties){const to=(p.yields||{})[reg.id];if(to&&base[to]!=null){base[to]+=base[p.id]*.6;base[p.id]*=.25}}
    const w={};let sum=0;
    for(const p of g.parties){
      let v=base[p.id];
      const al=allies(p).map(id=>base[id]||0);if(al.length)v+=Math.max(...al)*(p.kind==='minor'?.25:.18);
      w[p.id]=v*v;sum+=w[p.id];
    }
    for(const k in w)w[k]/=sum;
    return w;
  }
  function nationalShares(g,list){
    // 정당 투표: 지역구보다 표가 고르게 갈리고 군소정당에 소신 투표가 몰린다.
    const out=Object.fromEntries(g.parties.map(p=>[p.id,0]));
    for(const reg of REGIONS){
      const w={};let sum=0;
      for(const p of g.parties){w[p.id]=p.fixed&&g.country==='kr'?0:Math.pow(raw(p,reg),1.2)*(p.kind==='minor'?1.3:1)*(list?p.prw||1:1);sum+=w[p.id]}
      for(const k in w)out[k]+=w[k]/sum*reg.seats/DISTRICT;
    }
    return out;
  }
  function allocate(weights,total){
    const ids=Object.keys(weights);const sum=ids.reduce((a,k)=>a+weights[k],0)||1;
    const res={};let used=0;const rem=[];
    for(const k of ids){const q=weights[k]/sum*total;res[k]=Math.floor(q);used+=res[k];rem.push([k,q-res[k]])}
    rem.sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1));
    for(let i=0;used<total;i++,used++)res[rem[i%rem.length][0]]++;
    return res;
  }
  function electionSeats(g){
    const district=Object.fromEntries(g.parties.map(p=>[p.id,0]));
    const regions=[];
    const holders=g.parties.filter(p=>p.hold);
    for(const reg of REGIONS){
      const s=regionShares(g,reg);const w={};for(const k in s)if(!party(g,k).hold)w[k]=Math.pow(s[k],1.8);
      const kept=holders.reduce((n,p)=>n+(p.hold[reg.id]||0),0);
      const a=allocate(w,reg.seats-kept);for(const p of holders)a[p.id]=p.hold[reg.id]||0;for(const k in a)district[k]+=a[k];
      const winner=Object.keys(s).sort((x,y)=>s[y]-s[x])[0];
      regions.push({id:reg.id,winner,seats:a});
    }
    // 비례 배분은 실제 비례 의석에 맞춘 정당 투표로 하고, 화면에 보이는 득표는 보정 전 값이다.
    const vote=nationalShares(g),list=nationalShares(g,true);const pass={};
    for(const k in list)pass[k]=!party(g,k).hold&&(list[k]>=PR_THRESHOLD||district[k]>=5)?list[k]:0;
    const prKept=holders.reduce((n,p)=>n+(p.holdPr||0),0);const pr=allocate(pass,PR-prKept);for(const p of holders)pr[p.id]=p.holdPr||0;
    return{district,pr,vote,regions};
  }
  function setSeats(p,district,pr){p.district=district;p.pr=pr;p.seats=district+pr}
  function moveDistrict(from,to,n){n=Math.min(from.district,n);setSeats(from,from.district-n,from.pr);setSeats(to,to.district+n,to.pr);return n}
  function newGame({players,size,seed,rounds,timer,now,country}){
    const C=own(COUNTRIES,country)?COUNTRIES[country]:null;useMap({country:C?country:null});
    const r=rng(seed);
    const usedColors=new Set(),parties=[];
    if(C){
      // 플레이어는 고른 정당을 맡고, 겹치면 남은 정당 중 의석이 많은 쪽을 맡는다. 자리가 없으면 관전한다.
      // 고르는 값: pick:<정당 id> 또는 pick:new<인원>(무소속·기타에서 의원을 데려와 창당). 셋째 칸은 바꿀 노선이다.
      const owner={},founders=[];
      for(const pl of players){
        const[,pick,ideo]=String(pl.ideology).split(':');
        if(/^new\d+$/.test(pick||'')){founders.push({pl,n:+pick.slice(3),ideo});continue}
        const free=C.parties.filter(x=>!x.fixed&&!owner[x.id]).sort((a,b)=>b.seats-a.seats);
        const t=free.find(x=>x.id===pick)||free[0];
        if(t)owner[t.id]={pl,ideo};
      }
      const near=(e,s)=>Object.keys(IDEOLOGIES).sort((a,b)=>Math.hypot(IDEOLOGIES[a].eco-e,IDEOLOGIES[a].soc-s)-Math.hypot(IDEOLOGIES[b].eco-e,IDEOLOGIES[b].soc-s))[0];
      // 플레이어가 고른 노선과 당 이름을 입힌다.
      const dress=(p,pl,ideo)=>{
        const nm=String(pl.name||'').trim().slice(0,14);if(nm&&!parties.some(o=>o!==p&&o.name===nm))p.name=nm;
        if(own(IDEOLOGIES,ideo)){const I=IDEOLOGIES[ideo];p.ideology=ideo;p.eco=I.eco;p.soc=I.soc;p.idea=I.name}
      };
      C.parties.forEach((x,i)=>{
        const o=owner[x.id],pl=o&&o.pl;
        const p=mkParty('p'+(i+1),i+1,pl?pl.ownerId:null,x.name,pl?String(pl.leader||'').slice(0,10):'',pl?String(pl.slogan||'').slice(0,30):'',near(x.eco,x.soc),x.colorIdx,!pl,x.seats>=TOTAL*.07?'major':'minor');
        p.members=x.members;p.m0=x.members;p.income0=x.income;p.funds=r2(x.income/4);p.eco=x.eco;p.soc=x.soc;p.home=x.home;p.pick=x.id;p.fixed=x.fixed;p.idea=x.idea;p.color=x.color;p.only=x.only||null;
        setSeats(p,x.district,x.pr);p.base=x.seats>=TOTAL*.07?20:0;
        if(pl)dress(p,pl,o.ideo);
        parties.push(p);
      });
      // 창당: 무소속·기타 의석에서 고른 인원만큼 데려온다. 지역구 의원부터 옮긴다.
      const pool=parties.find(p=>p.fixed);
      const rich=C.parties.filter(x=>!x.fixed&&x.income).sort((a,b)=>a.income-b.income)[0]||{members:1,income:4};
      for(const f of founders){
        const n=pool?clamp(f.n|0,0,pool.seats):0,d=pool?Math.min(n,pool.district):0;
        const key=own(IDEOLOGIES,f.ideo)?f.ideo:'center',no=parties.length+1;
        // 새 당은 기본 색 팔레트를 쓴다. 다른 새 당과 겹치면 다음 색으로 민다.
        let c=Number.isInteger(f.pl.colorIdx)&&f.pl.colorIdx>=0&&f.pl.colorIdx<NCOLORS?f.pl.colorIdx:0;
        for(let k=0;k<NCOLORS&&parties.some(o=>o.pick==='new'&&o.colorIdx===c);k++)c=(c+1)%NCOLORS;
        const p=mkParty('p'+no,no,f.pl.ownerId,'새 정당',String(f.pl.leader||'').slice(0,10),String(f.pl.slogan||'').slice(0,30),key,c,false,n>=TOTAL*.07?'major':'minor');
        p.members=r2(rich.members*.4);p.m0=p.members;p.income0=r2(rich.income*.4);p.funds=r2(p.income0/4);p.pick='new';p.idea=IDEOLOGIES[key].name;
        if(pool){setSeats(pool,pool.district-d,pool.pr-(n-d))}
        setSeats(p,d,n-d);
        dress(p,f.pl,key);if(p.name==='새 정당')p.name=(IDEOLOGIES[key].name+'신당').slice(0,14);
        parties.push(p);
      }
    }
    const list=C?[]:players.slice(0,8);
    list.forEach((pl,i)=>{
      let c=Number.isInteger(pl.colorIdx)&&pl.colorIdx>=0&&pl.colorIdx<NCOLORS?pl.colorIdx:0;
      while(usedColors.has(c))c=(c+1)%NCOLORS;
      usedColors.add(c);
      const[ideo,kindRaw]=String(pl.ideology).split(':');
      const key=own(IDEOLOGIES,ideo)?ideo:'center';
      parties.push(mkParty('p'+(i+1),i+1,pl.ownerId,String(pl.name||('무명당'+(i+1))).slice(0,14),String(pl.leader||'').slice(0,10),String(pl.slogan||'').slice(0,30),key,c,false,kindRaw==='minor'?'minor':'major'));
    });
    const taken=parties.map(p=>p.ideology);
    const pool=shuffle(Object.keys(IDEOLOGIES),r).sort((a,b)=>taken.filter(x=>x===a).length-taken.filter(x=>x===b).length);
    const want=C?parties.length:clamp(size|0,Math.max(2,parties.length),8);
    let bi=0;const usedNames=new Set(parties.map(p=>p.name));
    while(parties.length<want){
      let c=0;while(usedColors.has(c))c++;usedColors.add(c);
      const n=parties.length+1,key=pool[bi%pool.length];
      // 대형정당을 두 곳 채운 뒤 나머지는 군소정당으로 둔다.
      const kind=parties.filter(p=>p.kind==='major').length<2?'major':'minor';
      const b=(kind==='major'?BOTS[key]:BOTS[key].slice().reverse()).find(x=>!usedNames.has(x[0]))||[IDEOLOGIES[key].name+'당','김대표'];
      usedNames.add(b[0]);
      parties.push(mkParty('p'+n,n,null,b[0],b[1],'',key,c,true,kind));
      bi++;
    }
    // AI 정당마다 성격을 하나씩. 다섯 가지를 섞어 돌려 같은 성격이 몰리지 않게 한다.
    const pk=shuffle(Object.keys(PERSONAS),r);let pi=0;
    for(const p of parties)if(p.bot&&!p.fixed)p.persona=pk[pi++%pk.length];
    const g={round:1,maxRounds:rounds,term:rounds,cycle:CYCLE,midRound:Math.ceil(rounds/2),seed,timer:timer|0,status:'playing',parties,
      playerIds:parties.filter(p=>!p.bot).map(p=>p.ownerId),
      billDeck:shuffle(BILLS.map((_,i)=>i),r),eventDeck:shuffle(EVENTS.map((_,i)=>i),r),
      report:null,history:[],deadline:timer?now+timer*1000:0,result:null,
      country:C?country:null,system:C?C.system:null,presParty:null,pmParty:null,pmElection:true,treasury:30*U,dissolved:false,billIdx:0,seq:0,agenda:[],feds:[]};
    if(C){
      // 실제 의석에서 시작하고, 첫 판세가 그 의석에 가깝도록 정당별 기본 득표력을 맞춘다.
      g.parties.forEach(p=>{p.startSeats=p.seats});
      // 현재 정부에서 시작한다. 지명 표결이 필요한 나라도 첫 분기는 지금 내각 그대로다.
      const pick=id=>g.parties.find(p=>p.pick===id);
      g.pmElection=false;
      if(C.gov.head)g.pmParty=pick(C.gov.head).id;
      if(C.gov.pm)g.pmParty=pick(C.gov.pm).id;
      if(C.gov.pres)g.presParty=pick(C.gov.pres).id;
      if(C.gov.ally){const a=pick(C.gov.ally),b=pick(C.gov.pm);newFed(g,b,[a],b);syncFeds(g)}
      for(let t=0;t<80;t++){
        const res=electionSeats(g);
        for(const p of g.parties)p.base=clamp(p.base+(p.district-res.district[p.id])/DISTRICT*40,-30,70);
      }
      // 정당 투표도 실제 비례 의석에 맞춘다. 맞추지 않으면 군소정당 득표가 실제보다 몇 배 높게 나온다.
      if(PR){
        const live=g.parties.filter(p=>!(p.fixed&&g.country==='kr'));
        const want=Object.fromEntries(live.map(p=>[p.id,(p.pr+.6)/PR]));const sum=Object.values(want).reduce((a,b)=>a+b,0);
        for(let t=0;t<40;t++){const nat=nationalShares(g,true);for(const p of live)p.prw=clamp((p.prw||1)*Math.pow(want[p.id]/sum/Math.max(nat[p.id],1e-4),.7),.05,4)}
      }
      // 무소속·기타 묶음은 정당처럼 뛰지 않으니, 선거 때마다 지금 의석을 지역별로 그대로 지킨다.
      const res=electionSeats(g);
      for(const p of g.parties.filter(x=>x.fixed&&x.seats)){
        const w={};for(const x of res.regions)w[x.id]=(x.seats[p.id]||0)+.01;
        p.hold=allocate(w,p.district);p.holdPr=p.pr;
      }
    }else{
      const first=electionSeats(g);
      g.parties.forEach(p=>setSeats(p,first.district[p.id],first.pr[p.id]));
    }
    g.history.push({round:0,shares:roundShares(g),score:Object.fromEntries(scoreRows(g).map(x=>[x.id,x.score]))});
    g.agenda=[nextGovBill(g)];
    drawEvent(g,r);
    g.botDeals=botDeals(g,r);
    g.dealNews=[];formDeals(g,{},(text,...who)=>g.dealNews.push({text,who}),false);
    return g;
  }
  function mkParty(id,no,ownerId,name,leader,slogan,ideology,colorIdx,bot,kind){
    const i=IDEOLOGIES[ideology],K=KINDS[kind];
    return{id,no,ownerId,name,leader,slogan,ideology,colorIdx,bot,kind,base:kind==='major'?20:0,home:null,eco:i.eco,soc:i.soc,funds:K.funds,members:K.members,trust:50,unity:K.unity,talent:0,seats:0,district:0,pr:0,
      fed:null,allies:[],yields:{},allyLead:null,pmRounds:0,reg:Object.fromEntries(REGIONS.map(r=>[r.id,0])),delta:null};
  }
  function roundShares(g){const s=nationalShares(g);const o={};for(const k in s)o[k]=r1(s[k]*100);return o}
  const fundGain=p=>p.income0!=null?r2(Math.max(U*.5,p.income0/4*.25)):r1(6+p.members*.4);
  const actionCost=a=>{const d=ACTIONS[a.type];return r2(d.cost*U*(d.spend?LEVELS[own(a,'level')&&LEVELS[a.level]?a.level:2].cost:1))};
  const govCost=type=>r2(GOV[type].cost*U);
  const levelEffect=a=>LEVELS[a.level]?LEVELS[a.level].effect:1;
  const quarterIncome=p=>p.income0!=null?p.income0/4*(.35*(p.m0?p.members/p.m0:1)+.65*clamp(p.seats/Math.max(p.startSeats||1,1),.3,3)):2+p.members*.45+p.seats*4.8/TOTAL;
  function billAlign(b,o){return b.eco*o.eco+b.soc*o.soc}
  const pmOf=g=>g.pmParty?party(g,g.pmParty):null;
  function govSlots(g,p){if(g.pmParty===p.id)return 2;if(g.system==='semi'&&g.presParty===p.id)return 1;if(!g.pmParty)return 0;return isAlly(p,g.pmParty)?1:0}
  const canDissolve=(g,p)=>g.system==='presidential'?false:g.system==='semi'?g.presParty===p.id:g.pmParty===p.id;
  const inGov=(g,p)=>govSlots(g,p)>0;
  // 정부는 후보 세 건 가운데 다음 분기에 올릴 법안을 고른다. 고르지 않으면 노선에 가장 맞는 안이 올라간다.
  const defaultBill=(g,p)=>(g.billOptions||[]).slice().sort((x,y)=>billAlign(BILLS[y],p)-billAlign(BILLS[x],p)||x-y)[0];
  function nextGovBill(g,pick){
    const opts=g.billOptions||[];const pm=pmOf(g);
    const i=opts.includes(pick)?pick:opts.length?(pm?defaultBill(g,pm):opts[0]):g.billDeck[g.billIdx++%g.billDeck.length];
    g.billOptions=[];
    for(let n=0;g.billOptions.length<3&&n<BILLS.length*2;n++){const k=g.billDeck[g.billIdx++%g.billDeck.length];if(k!==i&&!g.billOptions.includes(k))g.billOptions.push(k)}
    const b=BILLS[i];
    return{id:'a'+(g.seq++),kind:'gov',title:b.title,desc:b.desc,eco:b.eco,soc:b.soc,pass:b.pass,by:g.pmParty||null};
  }
  function defaultVote(g,p,item){
    if(item.kind==='noconf'){
      if(inGov(g,p))return'no';
      if(item.by===p.id)return'yes';
      const pm=pmOf(g);if(!pm)return'no';
      return pm.trust<45?'yes':'no';
    }
    if(item.by===p.id||item.by2===p.id||isAlly(p,item.by))return'yes';
    const a=billAlign(item,p);
    if(item.kind==='gov'&&inGov(g,p))return a>-.4?'yes':'no';
    if(a>.05)return'yes';if(a<-.05)return'no';
    return REGIONS.reduce((s,x)=>s+billAlign(item,x)*x.seats,0)>0?'yes':'no';
  }
  function defaultPm(g,p){
    const top=g.parties.filter(o=>!o.fixed).sort((a,b)=>b.seats-a.seats||a.no-b.no);
    if(p.allyLead)return p.allyLead;
    const big=allies(p).map(id=>party(g,id)).filter(a=>!a.fixed&&a.seats>p.seats).sort((a,b)=>b.seats-a.seats)[0];
    if(big)return big.id;
    if(top[0].id===p.id||top[1].id===p.id)return p.id;
    return top.slice(0,2).sort((a,b)=>Math.hypot(a.eco-p.eco,a.soc-p.soc)-Math.hypot(b.eco-p.eco,b.soc-p.soc))[0].id;
  }
  const cleanTitle=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,24);
  function sanitize(g,p,mv){
    const votes={};const given=mv&&mv.votes&&typeof mv.votes==='object'?mv.votes:{};
    for(const it of g.agenda){
      const v=own(given,it.id)?given[it.id]:null;
      votes[it.id]=v==='yes'||v==='no'?v:defaultVote(g,p,it);
    }
    const pmPick=mv&&party(g,mv.pm)?mv.pm:defaultPm(g,p);
    const out={votes,pm:pmPick,actions:[],gov:[],bill:null,react:null};let f=p.funds;
    // 사건 대응: 고를 수 있는 것 가운데 하나. 자금은 행동에 쓰고 남은 돈으로 낸다(아래에서 확인).
    const react=mv&&typeof mv.react==='string'&&reactOpts(g,p).includes(mv.react)?mv.react:null;
    if(g.pmParty===p.id)out.bill=mv&&(g.billOptions||[]).includes(mv.bill)?mv.bill:defaultBill(g,p);
    const acts=mv&&Array.isArray(mv.actions)?mv.actions.slice(0,AP):[];
    for(const a of acts){
      const d=a&&own(ACTIONS,a.type)?ACTIONS[a.type]:null;if(!d)continue;
      if(d.need.includes('region')&&!own(REG,a.region))continue;
      if(d.need.includes('target')){const t=party(g,a.target);if(!t||t.id===p.id)continue}
      if(a.type==='noConfidence'&&(!g.pmParty||inGov(g,p)||g.system==='presidential'))continue;
      if(a.type==='propose'&&out.actions.some(x=>x.type==='propose'))continue;
      const c={type:a.type,region:a.region,target:a.target,level:d.spend&&Number.isInteger(a.level)&&LEVELS[a.level]?a.level:2};
      const cost=actionCost(c);
      if(cost>f)continue;
      f-=cost;if(a.type==='fundraise')f+=fundGain(p);
      if(a.type==='propose'){
        const tp=own(TOPICS,a.topic)?a.topic:'region';
        c.topic=tp;c.title=cleanTitle(a.title)||TOPICS[tp].title;
      }
      out.actions.push(c);
    }
    if(react&&respCost(g,p,react)<=f)out.react=react;
    const slots=govSlots(g,p);let tr=g.treasury;
    const gs=mv&&Array.isArray(mv.gov)?mv.gov.slice(0,slots):[];
    for(const a of gs){
      const d=a&&own(GOV,a.type)?GOV[a.type]:null;if(!d)continue;
      if(d.pmOnly&&!canDissolve(g,p))continue;
      if(a.type==='dissolve'&&(g.dissolved||nextGeneral(g)-g.round<=1))continue;
      if(d.need.includes('region')&&!own(REG,a.region))continue;
      if(d.need.includes('target')){const t=party(g,a.target);if(!t||t.id===p.id)continue}
      if(govCost(a.type)>tr)continue;
      tr-=govCost(a.type);out.gov.push({type:a.type,region:a.region,target:a.target});
    }
    return out;
  }
  // AI 표결: 기본 표결에 성격을 더한다. 연맹으로 묶인 표는 분기 처리에서 따로 맞춘다.
  function botVote(g,p,it){
    const v=defaultVote(g,p,it),P=personaOf(p);if(!P)return v;
    const k=p.persona,gov=inGov(g,p);
    if(it.kind==='noconf'){
      if(k==='hawk'&&!gov&&it.by!==p.id){const pm=pmOf(g);return pm&&pm.trust<55?'yes':'no'}
      return v;
    }
    if(it.by===p.id||it.by2===p.id||isAlly(p,it.by))return v;
    const a=billAlign(it,p);
    const lean=REGIONS.reduce((s,x)=>s+billAlign(it,x)*x.seats,0)/TOTAL;
    if(k==='principled')return it.kind==='gov'&&gov?(a>-.1?'yes':'no'):(a>=0?'yes':'no');
    if(k==='populist'&&Math.abs(a)<.4)return lean>0?'yes':'no';
    if(k==='hawk'&&it.kind==='gov'&&!gov)return a>.15?'yes':'no';
    if(k==='dealer'&&it.kind==='gov'&&gov)return'yes';
    return v;
  }
  function botMove(g,p,r){
    const votes={};for(const it of g.agenda)votes[it.id]=botVote(g,p,it);
    if(p.fixed)return{votes,pm:defaultPm(g,p),actions:[],gov:[],bill:null}; // 무소속 묶음은 정당처럼 움직이지 않는다.
    const acts=[];let f=p.funds;const P=personaOf(p);
    const add=(type,x={})=>{
      if(acts.length>=AP)return false;
      // AI는 남은 돈의 3분의 1 안에서 가장 큰 규모를 고른다.
      let level=2;
      if(ACTIONS[type].spend){level=[4,3,2,1,0].find(l=>actionCost({type,level:l})<=f/(P?P.spend:3));if(level===undefined)level=0}
      const c=actionCost({type,level});
      if(c>f)return false;
      f-=c;if(type==='fundraise')f+=fundGain(p);acts.push({type,level,...x});return true};
    const others=g.parties.filter(o=>o.id!==p.id);
    // 공격 상대는 의석 상위 셋 중에서 고른다. 늘 1당만 노리면 1당이 무너지기만 한다.
    const rivals=others.filter(o=>!o.fixed).sort((x,y)=>y.seats-x.seats).slice(0,3);
    let leader=(g.country?rivals[Math.floor(r()*rivals.length)]:rivals[0])||others[0];
    // 강경파는 정부 수반 당을 먼저 노린다(같은 연맹이 아니면).
    if(P&&p.persona==='hawk'){const t=pmOf(g);if(t&&t.id!==p.id&&!isAlly(p,t.id))leader=t}
    const bestReg=()=>REGIONS.map(u=>[u,u.seats*(fit(p,u)+.2)*(.6+r())]).sort((u,v)=>v[1]-u[1])[0][0];
    if(p.unity<40)add('unify');
    if(p.trust<38)add('policy');
    if(f<6)add('fundraise');
    if((g.round<=2&&r()<.5)||(P&&p.persona==='steady'&&r()<.3))add('recruit');
    const pm=pmOf(g);
    if(pm&&g.system!=='presidential'&&!inGov(g,p)&&pm.trust<38&&!g.agenda.some(x=>x.kind==='noconf')&&r()<.15)add('noConfidence');
    if(r()<(P?P.propose:.25)){
      const tp=Object.keys(TOPICS).map(k=>[k,billAlign(TOPICS[k],p)+r()*.3]).sort((a,b)=>b[1]-a[1])[0][0];
      add('propose',{topic:tp,title:TOPICS[tp].title,region:bestReg().id});
    }
    let guard=0;
    // 성격이 있으면 성격의 비율대로 고른다. 공격은 3분기부터(강경파는 2분기부터), 같은 연맹은 노리지 않는다.
    const hostile=!isAlly(p,leader.id)&&g.round>(P&&p.persona==='hawk'?1:2);
    while(P&&acts.length<AP&&guard++<12){
      let x=r(),pick='fundraise';
      for(const[k,w]of Object.entries(P.act)){if(x<w){pick=k;break}x-=w}
      if(pick==='rally'&&add('rally',{region:bestReg().id}))continue;
      if((pick==='talent'||pick==='policy')&&add(pick))continue;
      if(pick==='attack'&&hostile){
        const reg=REGIONS.slice().sort((u,v)=>(leader.reg[v.id]||0)-(leader.reg[u.id]||0))[0];
        if(add('attack',{target:leader.id,region:reg.id}))continue;
      }
      if(pick==='expose'&&hostile&&leader.trust<48&&add('expose',{target:leader.id}))continue; // 폭로는 상대 신뢰가 낮을 때만(실패하면 우리가 크게 다친다)
      if(pick==='expose'&&add('rally',{region:bestReg().id}))continue;
      if(pick==='poach'&&hostile&&leader.unity<(p.persona==='hawk'?55:45)&&add('poach',{target:leader.id}))continue;
      add('fundraise');
    }
    while(acts.length<AP&&guard++<12){
      const x=r();
      if(x<.55){if(add('rally',{region:bestReg().id}))continue}
      else if(x<.65){if(add('talent'))continue}
      else if(x<.75){if(add('policy'))continue}
      else if(x<.85&&g.round>2&&!isAlly(p,leader.id)){
        const reg=REGIONS.slice().sort((u,v)=>(leader.reg[v.id]||0)-(leader.reg[u.id]||0))[0];
        if(add('attack',{target:leader.id,region:reg.id}))continue;
      }else if(x<.91&&g.round>2&&!isAlly(p,leader.id)){if(add('expose',{target:leader.id}))continue}
      else if(x<.95&&!isAlly(p,leader.id)&&leader.unity<45){if(add('poach',{target:leader.id}))continue}
      add('fundraise');
    }
    const gov=[];const slots=govSlots(g,p);let tr=g.treasury;
    const gadd=(type,x={})=>{if(gov.length>=slots||govCost(type)>tr)return;tr-=govCost(type);gov.push({type,...x})};
    if(slots){
      if(p.unity<50)gadd('reshuffle');
      if(canDissolve(g,p)&&!g.dissolved&&nextGeneral(g)-g.round>1&&g.round>2){
        const nat=nationalShares(g)[p.id]*TOTAL;
        if(nat>p.seats*1.2&&r()<.5)gadd('dissolve');
      }
      if(p.trust<45)gadd('welfare');
      if(r()<.15){const t=others.filter(o=>!isAlly(p,o.id)).sort((a,b)=>b.seats-a.seats)[0];if(t)gadd('probe',{target:t.id})}
      gadd(p.eco>.2?'welfare':p.soc<-.2&&r()<.5?'security':'taxcut');
      gadd('budget',{region:bestReg().id});
    }
    return{votes,pm:defaultPm(g,p),actions:acts,gov,bill:g.pmParty===p.id?defaultBill(g,p):null,react:botReact(g,p,r)};
  }
  // 연맹 협상. 제안은 보낸 쪽 협상 문서(AI는 판 상태)에 있고, 받는 쪽이 수락하는 순간 성사된다(applyDeals).
  // 제안의 종류는 두 당의 처지로 정해진다:
  //   found  둘 다 연맹이 없음 → 새 연맹을 함께 결성(제안한 당이 대표)
  //   join   제안한 당이 연맹이 없고 받는 당이 연맹 대표 → 그 연맹에 가입 신청
  //   invite 제안한 당이 연맹 대표이고 받는 당이 연맹이 없음 → 우리 연맹에 초대
  //   merge  두 당이 서로 다른 연맹의 대표 → 두 연맹을 하나로 합병(제안한 당이 새 연맹의 대표)
  // 조건(from=제안한 당, to=받는 당):
  //   pm 연맹의 수반 후보(연맹 전체에 적용) · topic 공동 입법 과제(다음 분기 연맹 합의 법안, 연맹 소속 당은 찬성으로 묶인다)
  //   yieldReg+yieldBy 선거 협력(그 지역 후보 양보) · endorse 공개 지지(지지하는 쪽 신뢰를 나눠 준다) · name 새 연맹 이름(결성·합병 때)
  const pactLead=g=>g.system!=='westminster';
  const side=v=>v==='from'||v==='to'?v:null;
  function dealKind(g,from,to){
    if(!from||!to||from.id===to.id||from.fixed||to.fixed)return{why:'연맹을 맺을 수 없는 상대입니다.'};
    const ff=fedOf(g,from),tf=fedOf(g,to);
    if(ff&&tf){
      if(ff===tf)return{why:'이미 같은 연맹입니다.'};
      // 연맹끼리 합병: 두 대표 당 사이에서만, 합친 회원이 정원 안일 때
      if(ff.head!==from.id||tf.head!==to.id)return{why:'연맹끼리 합병은 두 연맹의 대표 당끼리만 제안할 수 있습니다.'};
      if(ff.members.length+tf.members.length>fedCap(ff))return{why:`두 연맹을 합치면 정원 ${fedCap(ff)}개 당을 넘습니다.`};
      return{kind:'merge',fed:ff,fed2:tf};
    }
    if(!ff&&!tf)return{kind:'found',fed:null};
    const f=ff||tf;
    if(f.members.length>=fedCap(f))return{why:`「${f.name}」은 정원 ${fedCap(f)}개 당이 다 찼습니다.`};
    if(ff)return ff.head===from.id?{kind:'invite',fed:ff}:{why:'다른 당을 연맹에 들이는 일은 대표 당만 할 수 있습니다.'};
    return tf.head===to.id?{kind:'join',fed:tf}:{why:'가입 신청은 연맹 대표 당에 보내야 합니다.'};
  }
  function cleanDeal(g,from,d){
    if(!d||typeof d!=='object'||!from||from.fixed)return null;
    const to=party(g,d.to);if(!to||to.id===from.id||to.fixed)return null;
    const yieldReg=own(REG,d.yieldReg)&&side(d.yieldBy)?d.yieldReg:null;
    return{id:String(d.id||'').slice(0,16),from:from.id,to:to.id,pm:pactLead(g)?side(d.pm):null,
      topic:own(TOPICS,d.topic)?d.topic:null,yieldReg,yieldBy:yieldReg?side(d.yieldBy):null,endorse:side(d.endorse),name:cleanFedName(d.name)||null};
  }
  const endorseGain=e=>clamp((e.trust-40)*.2,1,6);
  // AI가 받은 제안을 따진다. 상태만 보고 정하므로 화면에서 미리 본 답과 분기 말 결과가 같다.
  function dealView(g,bot,d){
    const from=party(g,d.from);
    const k=dealKind(g,from,bot);if(!k.kind)return{ok:false,why:k.why};
    const f=k.fed;
    // 노선: 결성은 두 당 사이, 가입 신청은 신청한 당과 우리 연맹, 초대는 우리 당과 상대 연맹, 합병은 두 연맹 사이
    const merge=k.kind==='merge',f2=k.fed2;
    const a=k.kind==='join'?fedLine(g,f):merge?fedLine(g,f2):bot,b=k.kind==='invite'||merge?fedLine(g,f):from;
    const line=(1.1-Math.hypot(a.eco-b.eco,a.soc-b.soc))*25-(merge?f.members.length+f2.members.length-2:f?f.members.length-1:0)*4;
    // 합병하면 우리는 대표 자리를 내준다.
    const size=merge?clamp((fedSeats(g,f)-fedSeats(g,f2))/TOTAL*30,-8,8)+(from.trust-50)*.3-4
      :(k.kind==='join'?clamp(from.seats/TOTAL*40,0,8):clamp(((k.kind==='invite'?fedSeats(g,f):from.seats)-bot.seats)/TOTAL*30,-8,8))+(from.trust-50)*.3;
    const cur=f&&f.lead?party(g,f.lead):null;
    const leadVal=x=>{
      if(merge){
        // 합병 뒤 수반 후보: 고른 쪽, 고르지 않으면 제안한 연맹의 후보(없으면 우리 연맹의 후보)
        const R=x.pm?(x.pm==='from'?from:bot):cur||(f2.lead?party(g,f2.lead):null),mine=f2.lead;
        if(!R)return 0;if(R===bot)return mine===bot.id?0:12;if(mine&&R.id===mine)return 0;
        return mine===bot.id?-20:mine?-12:bot.seats>R.seats?-20:-3;
      }
      if(!x.pm)return 0;const L=x.pm==='from'?from:bot;if(cur&&L.id===cur.id)return 0;if(L===bot)return 12;return(cur&&cur.id===bot.id)||bot.seats>from.seats?-20:-3};
    const part=x=>{
      const o={lead:leadVal(x),topic:x.topic?billAlign(TOPICS[x.topic],bot)*14:0,yield:0,endorse:0};
      if(x.yieldReg){const reg=REG[x.yieldReg],sh=regionShares(g,reg),y=x.yieldBy==='from'?from:bot;o.yield=(x.yieldBy==='from'?1:-1)*sh[y.id]*reg.seats/TOTAL*150}
      if(x.endorse==='from')o.endorse=2+endorseGain(from);else if(x.endorse==='to')o.endorse=-3-(from.trust<40?6:0);
      return o};
    // 성격: 노선 차이를 얼마나 따지는지(line 배수)와 거래 자체를 반기는 정도(deal)
    const P=personaOf(bot),lineW=line*(P?P.line:1)+(P?P.deal:0);
    const val=x=>{const o=part(x);return lineW+size+o.lead+o.topic+o.yield+o.endorse};
    if(val(d)>=0)return{ok:true,why:line>5?(k.kind==='join'?'노선이 가까워 우리 연맹에 받아들일 만합니다.':merge?'두 연맹의 노선이 가까워 합칠 만합니다.':'노선이 가까워 받아들일 만합니다.'):'조건이 맞아 받아들일 만합니다.'};
    const o=part(d);
    const why=line<-10?(k.kind==='found'?'노선 차이가 큽니다.':'연맹 노선과 차이가 큽니다.'):merge&&o.lead<=-12?'합병하면 우리 연맹의 수반 후보를 잃습니다.':o.lead<=-20?'의석이 더 많은 쪽이 수반 후보를 양보할 수는 없습니다.':o.topic<-4?'합의 법안이 우리 노선과 맞지 않습니다.':o.yield<-3?'우리 강세 지역을 양보할 수는 없습니다.':'조건이 부족합니다.';
    // 역제안: 손해 보는 조건을 빼고, 우리에게 좋은 조건을 하나씩 더해 받을 만해질 때까지 고친다.
    const bestTopic=Object.keys(TOPICS).filter(k=>billAlign(TOPICS[k],from)>-.2).sort((a,b)=>billAlign(TOPICS[b],bot)-billAlign(TOPICS[a],bot)||(a<b?-1:1))[0];
    const shares=Object.fromEntries(REGIONS.map(x=>[x.id,regionShares(g,x)]));
    const bestReg=REGIONS.slice().sort((a,b)=>shares[b.id][bot.id]*b.seats-shares[a.id][bot.id]*a.seats)[0].id;
    let c={...d};
    for(let step=0;step<5&&val(c)<0;step++){
      const opts=[];
      if(c.pm==='from')opts.push({...c,pm:null});
      if(pactLead(g)&&c.pm!=='to')opts.push({...c,pm:'to'});
      if(c.endorse==='to')opts.push({...c,endorse:null});
      if(c.endorse!=='from')opts.push({...c,endorse:'from'});
      if(c.yieldBy==='to')opts.push({...c,yieldReg:null,yieldBy:null});
      if(c.yieldBy!=='from')opts.push({...c,yieldReg:bestReg,yieldBy:'from'});
      if(bestTopic&&c.topic!==bestTopic)opts.push({...c,topic:bestTopic});
      if(!opts.length)break;
      c=opts.sort((a,b)=>val(b)-val(a))[0];
    }
    return{ok:false,why,counter:val(c)>=0?{pm:c.pm,topic:c.topic,yieldReg:c.yieldReg,yieldBy:c.yieldBy,endorse:c.endorse,name:c.name||null}:null};
  }
  function botDeals(g,r){
    const out=[];const busy=id=>out.some(x=>x.to===id||x.from===id);
    const dist=(a,b)=>Math.hypot(a.eco-b.eco,a.soc-b.soc);
    for(const p of g.parties){
      if(!p.bot||p.fixed||busy(p.id))continue;
      // 연맹이 없는 AI는 결성·가입을, 자리가 남은 연맹의 대표 AI는 초대나 다른 연맹과의 합병을 낸다.
      const f=fedOf(g,p);
      if(f&&(f.head!==p.id||f.members.length>=fedCap(f)))continue;
      const P=personaOf(p);
      if(r()>=.2*(P?P.ask:1)/(f?f.members.length:1))continue;
      const line=f?fedLine(g,f):p;
      const c=g.parties.filter(o=>o.id!==p.id&&!o.fixed&&!busy(o.id)&&!isAlly(p,o.id)).map(o=>{const of=fedOf(g,o);
        if(f)return!of?{to:o,kind:'invite',ln:o}:of.head===o.id&&f.members.length+of.members.length<=fedCap(f)?{to:o,kind:'merge',ln:fedLine(g,of),fed:of}:null;
        if(!of)return{to:o,kind:'found',ln:o};
        return of.head===o.id&&of.members.length<fedCap(of)?{to:o,kind:'join',ln:fedLine(g,of),fed:of}:null}).filter(Boolean)
        .sort((x,y)=>dist(x.ln,line)-dist(y.ln,line)||(x.to.id<y.to.id?-1:1))[0];
      if(!c||dist(c.ln,line)>=1.5)continue;
      const o=c.to,topic=Object.keys(TOPICS).sort((a,b)=>billAlign(TOPICS[b],p)+billAlign(TOPICS[b],o)-billAlign(TOPICS[a],p)-billAlign(TOPICS[a],o)||(a<b?-1:1))[0];
      // 수반 후보: 결성이면 큰 쪽, 가입·초대면 연맹에 아직 후보가 없을 때만 큰 쪽을 건다.
      const fe=f||c.fed,pm=c.kind!=='merge'&&pactLead(g)&&(!fe||!fe.lead)?(p.seats>=o.seats?'from':'to'):null;
      out.push({id:'b'+(g.seq++),from:p.id,to:o.id,pm,topic,yieldReg:null,yieldBy:null,endorse:null,name:null});
    }
    return out;
  }
  // 사람은 협상 문서의 답(replies[key]==='yes'), AI는 판단 함수로 찬반을 낸다.
  function replyYes(g,p,talk,key,botOk){
    if(p.bot)return!!botOk();
    const rep=talk[p.ownerId]&&talk[p.ownerId].replies;return!!(rep&&typeof rep==='object'&&rep[key]==='yes');
  }
  // AI 회원이 새로 들어올 당(들)을 받아들일지: 노선이 가까우면 찬성
  const memberOk=(g,bot,joiners)=>{const w=joiners.reduce((n,x)=>n+Math.max(x.seats,1),0);
    const ln={eco:joiners.reduce((n,x)=>n+x.eco*Math.max(x.seats,1),0)/w,soc:joiners.reduce((n,x)=>n+x.soc*Math.max(x.seats,1),0)/w};
    return Math.hypot(bot.eco-ln.eco,bot.soc-ln.soc)<1};
  // 연맹 f가 이 제안을 받아들이는지. 대표가 정하는 연맹은 대표의 답(headYes), 회원 과반 연맹은 회원 표를 센다.
  function fedApproves(g,f,d,talk,joiners,headYes){
    if(rulesOf(f).admit!=='vote')return!!headYes;
    const key=d.from+':'+d.id;
    const yes=f.members.filter(id=>{if(id===d.from)return true;if(id===d.to)return!!headYes;const m=party(g,id);return replyYes(g,m,talk,key,()=>memberOk(g,m,joiners))}).length;
    return yes*2>f.members.length;
  }
  // 연맹 규칙 개정안. 회원 누구나 내고, 회원 과반이 찬성하면 바로 바뀐다. 바꿀 수 있는 것: 이름·대표·수반 후보·규칙
  function cleanAmend(g,from,a){
    if(!a||typeof a!=='object'||!from)return null;
    const f=fedById(g,a.fed);if(!f||!f.members.includes(from.id))return null;
    const R=rulesOf(f),ch={};
    const nm=cleanFedName(a.name);if(nm&&nm!==f.name)ch.name=nm;
    if(f.members.includes(a.head)&&a.head!==f.head)ch.head=a.head;
    if(pactLead(g)&&'lead' in a){const l=a.lead==null||a.lead===''?null:a.lead;if((l===null||f.members.includes(l))&&l!==(f.lead||null))ch.lead=l}
    if((a.admit==='head'||a.admit==='vote')&&a.admit!==R.admit)ch.admit=a.admit;
    if((a.bind==='pact'||a.bind==='all')&&a.bind!==R.bind)ch.bind=a.bind;
    if(Number.isInteger(a.cap)&&a.cap>=Math.max(2,f.members.length)&&a.cap<=MAX_FED&&a.cap!==R.cap)ch.cap=a.cap;
    if(LEAVE_OPTS.includes(a.leave)&&a.leave!==R.leave)ch.leave=a.leave;
    if(hasPres(g)&&(a.pres==='unite'||a.pres==='separate')&&a.pres!==R.pres)ch.pres=a.pres;
    return Object.keys(ch).length?{id:String(a.id||'').slice(0,16),from:from.id,fed:f.id,...ch}:null;
  }
  const AMEND_FIELDS=['name','head','lead','admit','bind','cap','leave','pres'];
  // 대통령을 뽑는 나라(대통령제·이원집정부제)에서만 대선 후보 규칙이 뜻이 있다
  const hasPres=g=>g.system==='presidential'||g.system==='semi';
  function amendText(g,a){
    const t=[];
    if(a.name)t.push(`이름 「${a.name}」`);
    if(a.head)t.push(`대표 ${party(g,a.head).name}`);
    if('lead' in a)t.push(`수반 후보 ${a.lead?party(g,a.lead).name:'없음'}`);
    if(a.admit)t.push(a.admit==='vote'?'가입·제명은 회원 과반 찬성':'가입·제명은 대표가 결정');
    if(a.bind)t.push(a.bind==='all'?'모든 안건 연맹 당론':'연맹 합의 법안만 구속');
    if(a.cap)t.push(`정원 ${a.cap}개 당`);
    if(a.leave!=null)t.push(`탈퇴 벌점 신뢰 −${a.leave}`);
    if(a.pres)t.push(a.pres==='separate'?'대선 후보 각자 출마':'대선 후보 연맹 단일화');
    return t.join(' · ');
  }
  // AI 회원의 개정안 찬반
  function amendView(g,bot,a){
    const f=fedById(g,a.fed);if(!f)return{ok:false,why:'연맹이 없습니다.'};
    if(a.head&&f.head===bot.id)return{ok:false,why:'대표 자리를 내줄 수는 없습니다.'};
    if('lead' in a&&f.lead===bot.id&&a.lead!==bot.id)return{ok:false,why:'수반 후보 자리를 내줄 수는 없습니다.'};
    if(a.bind==='all'&&f.head!==bot.id){const ln=fedLine(g,f);if(Math.hypot(bot.eco-ln.eco,bot.soc-ln.soc)>.6)return{ok:false,why:'연맹 당론에 묶이기에는 노선 차이가 큽니다.'}}
    if(a.leave!=null&&a.leave>rulesOf(f).leave&&bot.trust<45)return{ok:false,why:'탈퇴 벌점을 올리는 데 반대합니다.'};
    // 단일 후보가 될 당은 각자 출마에 반대하고, 연맹 안에서 지지가 가장 높은 당이 아니면서 큰 당은 단일화에 반대한다
    if(a.pres){const nat=nationalShares(g),c=presCarrier(g,f,nat);
      if(a.pres==='separate'&&c&&c.id===bot.id)return{ok:false,why:'우리 당이 연맹 단일 후보라 각자 출마에 반대합니다.'};
      if(a.pres==='unite'&&c&&c.id!==bot.id&&nat[bot.id]>=nat[c.id]*.8)return{ok:false,why:'우리 당도 따로 대선에 나갈 만합니다.'}}
    return{ok:true,why:'받아들일 만합니다.'};
  }
  function amendTally(g,a,talk){
    const f=fedById(g,a.fed);if(!f)return{yes:0,total:0,need:1};
    const yes=f.members.filter(id=>{if(id===a.from)return true;const m=party(g,id);return replyYes(g,m,talk||{},'am:'+a.from+':'+a.id,()=>amendView(g,m,a).ok)}).length;
    return{yes,total:f.members.length,need:Math.floor(f.members.length/2)+1};
  }
  function formAmends(g,talk,say){
    talk=talk||{};g.amendsDone=g.amendsDone||[];let n=0;
    for(const p of g.parties){
      const t=!p.bot&&p.ownerId&&talk[p.ownerId];
      for(const raw of(t&&Array.isArray(t.amends)?t.amends.slice(0,3):[])){
        if(!raw||raw.round!==g.round)continue;
        const key=p.id+':'+raw.id;if(g.amendsDone.includes(key))continue;
        const a=cleanAmend(g,p,raw);if(!a)continue;
        const T=amendTally(g,a,talk);if(T.yes<T.need)continue;
        const f=fedById(g,a.fed),old=f.name;
        if(a.name)f.name=a.name;if(a.head)f.head=a.head;if('lead' in a)f.lead=a.lead;
        f.rules=cleanRules({...rulesOf(f),...(a.admit?{admit:a.admit}:{}),...(a.bind?{bind:a.bind}:{}),...(a.cap?{cap:a.cap}:{}),...(a.leave!=null?{leave:a.leave}:{}),...(a.pres?{pres:a.pres}:{})});
        syncFeds(g);g.amendsDone.push(key);n++;
        say(`「${old}」 규칙 개정: ${amendText(g,a)}.`,...f.members);
      }
    }
    return n;
  }
  // 받침에 맞춘 조사 '로/으로' (ㄹ 받침과 받침 없음은 '로')
  const ro=w=>{const c=String(w).charCodeAt(String(w).length-1);if(!(c>=0xAC00&&c<=0xD7A3))return'로';const j=(c-0xAC00)%28;return j===0||j===8?'로':'으로'};
  // 당 정보 바꾸기: 이름·대표·구호·색·노선. 노선은 분기에 한 번, 바꾸면 신뢰 −5.
  function formEdits(g,talk,say){
    talk=talk||{};g.editsDone=g.editsDone||[];let n=0;
    for(const p of g.parties){
      if(p.bot||p.fixed||!p.ownerId)continue;
      const e=talk[p.ownerId]&&talk[p.ownerId].edit;
      if(!e||typeof e!=='object'||e.round!==g.round)continue;
      const key=p.id+':'+String(e.id||'');if(g.editsDone.includes(key))continue;
      g.editsDone.push(key);n++;
      const old=p.name;
      const nm=String(e.name||'').replace(/\s+/g,' ').trim().slice(0,14);if(nm&&nm!==p.name)p.name=nm;
      if(typeof e.leader==='string')p.leader=e.leader.trim().slice(0,10);
      if(typeof e.slogan==='string')p.slogan=e.slogan.trim().slice(0,30);
      if(Number.isInteger(e.colorIdx)&&e.colorIdx>=0&&e.colorIdx<NCOLORS&&(e.colorIdx!==p.colorIdx||p.color)){p.colorIdx=e.colorIdx;delete p.color}
      if(p.name!==old)say(`${old}, 당 이름을 「${p.name}」${ro(p.name)} 바꿨습니다.`,p.id);
      if(own(IDEOLOGIES,e.ideology)&&e.ideology!==p.ideology&&p.lineRound!==g.round){
        const i=IDEOLOGIES[e.ideology];p.ideology=e.ideology;p.eco=i.eco;p.soc=i.soc;delete p.idea;
        p.trust=r1(p.trust-5);p.lineRound=g.round;
        say(`${p.name}, 노선을 「${i.name}」${ro(i.name)} 바꿨습니다. 신뢰 −5.`,p.id);
      }
    }
    return n;
  }
  // 수락된 연맹 제안을 판에 반영한다. 수락하는 순간(applyDeals)과 분기 말(resolveRound) 모두 이 함수를 쓴다.
  // 반영한 제안은 g.dealsDone에 적어 두어 다시 반영하지 않고, 공동 입법 과제는 g.pendingPacts에 모았다가 분기 말에 다음 분기 안건으로 올린다.
  // withRefused가 참이면 받지 않은 사람 제안을 돌려준다(분기 말 소식용).
  function formDeals(g,talk,say,withRefused){
    talk=talk||{};g.dealsDone=g.dealsDone||[];g.pendingPacts=g.pendingPacts||[];
    const deals=[];
    for(const p of g.parties){
      const t=!p.bot&&p.ownerId&&talk[p.ownerId];
      for(const d of(t&&Array.isArray(t.deals)?t.deals.slice(0,8):[])){if(d&&d.round===g.round){const c=cleanDeal(g,p,d);if(c)deals.push(c)}}
    }
    for(const d of g.botDeals||[]){const c=cleanDeal(g,party(g,d.from),d);if(c)deals.push(c)}
    const sideSeats=p=>{const f=fedOf(g,p);return f?fedSeats(g,f):p.seats};
    const pairSeats=d=>sideSeats(party(g,d.from))+sideSeats(party(g,d.to));
    deals.sort((a,b)=>pairSeats(b)-pairSeats(a)||(a.from+a.id<b.from+b.id?-1:1));
    const refused=[];let formed=0;
    for(const d of deals){
      if(g.dealsDone.includes(d.from+':'+d.id))continue;
      const p=party(g,d.from),t=party(g,d.to);
      const k=dealKind(g,p,t);if(!k.kind)continue;
      const tYes=replyYes(g,t,talk,d.from+':'+d.id,()=>dealView(g,t,d).ok);
      // 연맹 규칙이 '회원 과반'이면 연맹에 새 당이 들어올 때 회원 과반이 찬성해야 한다(대표의 답도 한 표)
      const yes=k.kind==='found'?tYes:k.kind==='join'?fedApproves(g,k.fed,d,talk,[p],tYes)
        :k.kind==='invite'?tYes&&fedApproves(g,k.fed,d,talk,[t],true)
        :fedApproves(g,k.fed,d,talk,k.fed2.members.map(id=>party(g,id)),true)&&fedApproves(g,k.fed2,d,talk,k.fed.members.map(id=>party(g,id)),tYes);
      if(!yes){if(withRefused&&!p.bot)refused.push([p,t]);continue}
      g.dealsDone.push(d.from+':'+d.id);formed++;
      const who=v=>v==='from'?p:v==='to'?t:null;
      const lead=who(d.pm);
      let f=k.fed;const names=[f&&f.name,k.fed2&&k.fed2.name];
      if(k.kind==='found')f=newFed(g,p,[t],lead,d.name);
      else if(k.kind==='merge'){
        // 제안한 연맹이 상대 연맹을 받아들이고, 대표는 제안한 당이 맡는다.
        const f2=k.fed2;f.members=f.members.concat(f2.members);f.head=p.id;f.lead=lead?lead.id:f.lead||f2.lead||null;
        if(cleanFedName(d.name))f.name=cleanFedName(d.name);g.feds=g.feds.filter(x=>x!==f2);
      }
      else{f.members.push(k.kind==='join'?p.id:t.id);if(lead)f.lead=lead.id}
      syncFeds(g);
      const bits=[];
      if(lead)bits.push(`수반 후보는 ${lead.name}입니다.`);
      else if(k.kind==='merge'&&f.lead)bits.push(`수반 후보는 ${party(g,f.lead).name}입니다.`);
      if(d.topic){g.pendingPacts.push({topic:d.topic,a:p.id,b:t.id});bits.push(`다음 분기에 「${TOPICS[d.topic].title}」을 함께 냅니다.`)}
      if(d.yieldReg){const y=who(d.yieldBy),o=y===p?t:p;if(!y.yields[d.yieldReg]){y.yields[d.yieldReg]=o.id;bits.push(`${REG[d.yieldReg].name}에서는 ${y.name}이 후보를 양보합니다.`)}}
      if(d.endorse){const e=who(d.endorse),n=e===p?t:p;const kk=r1(endorseGain(e));n.trust=r1(n.trust+kk);e.trust=r1(e.trust-1);bits.push(`${e.name} 대표가 ${n.name}을 공개 지지했습니다.`)}
      const head=k.kind==='found'?`${p.name}·${t.name}, 「${f.name}」 결성.`:k.kind==='merge'?`「${names[0]}」·「${names[1]}」 합병, 새 연맹은 「${f.name}」입니다.`:k.kind==='join'?`${p.name}, 「${f.name}」에 합류.`:`${t.name}, ${p.name}의 초대로 「${f.name}」에 합류.`;
      say(`${head} ${bits.join(' ')}`.trim(),...f.members);
    }
    return{refused,formed};
  }
  // 분기 중간에 수락된 제안을 바로 반영한다. 소식은 g.dealNews에 쌓았다가 분기 말 결과 보고에 함께 싣는다.
  function applyDeals(state,talk){
    useMap(state);const g=normAllies(clone(state));
    if(g.status!=='playing')return{state,formed:0,news:[]};
    g.dealNews=g.dealNews||[];const news=[];
    const say=(text,...who)=>{const n={text,who};news.push(n);g.dealNews.push(n)};
    const formed=formEdits(g,talk,say)+formAmends(g,talk,say)+formDeals(g,talk,say,false).formed;
    return{state:formed?g:state,formed,news};
  }
  function resolveRound(state,moves,now,talk){
    useMap(state);const g=normAllies(clone(state));const r=rng((g.seed+g.round*7919)>>>0);talk=talk||{};
    const before=Object.fromEntries(g.parties.map(p=>[p.id,{funds:p.funds,members:p.members,trust:p.trust,unity:p.unity,seats:p.seats}]));
    const sc0=Object.fromEntries(scoreRows(g).map(x=>[x.id,x]));
    const plans={};const chooser=g.pmParty;
    for(const p of g.parties){
      const mv=p.ownerId&&moves[p.ownerId]&&moves[p.ownerId].round===g.round?moves[p.ownerId]:null;
      plans[p.id]=sanitize(g,p,mv||botMove(g,p,r));
      plans[p.id].auto=!mv&&!p.bot;
    }
    const evTop=eventTop(g); // 사건 책임자는 분기 초 기준(분기 중 총리가 바뀌어도 고른 대응이 유효하다)
    const news=(g.dealNews||[]).slice();g.dealNews=[];const say=(text,...who)=>news.push({text,who});
    // 연맹: 탈퇴·제명을 먼저 처리하고, 아직 반영되지 않은 수락된 제안을 큰 쪽부터 반영한다.
    // 수반 후보는 연맹 단위로 하나라 회원 당 모두 그 당에 표를 몰아준다.
    const expelTried=new Set();
    const leave=p=>{const f=fedOf(g,p);if(!f)return null;f.members=f.members.filter(id=>id!==p.id);const rest=f.members.map(id=>party(g,id));syncFeds(g);return{f,rest,gone:!g.feds.includes(f)}};
    for(const p of g.parties){
      for(const a of plans[p.id].actions){
        if(a.type==='leaveFed'){
          const pen=rulesOf(fedOf(g,p)).leave;const x=leave(p);if(!x)continue;p.trust-=pen;for(const o of x.rest)o.trust+=1;
          say(`${p.name}, 「${x.f.name}」에서 탈퇴했습니다.${x.gone?' 남은 당이 하나라 연맹은 해체됩니다.':''}`,p.id,...x.rest.map(o=>o.id));
        }else if(a.type==='expel'){
          const f=fedOf(g,p),o=party(g,a.target);if(!f||!isAlly(p,o.id))continue;
          if(rulesOf(f).admit==='vote'){
            // 회원 과반 연맹: 제명 대상을 뺀 회원의 과반이 같은 제명을 내야(AI는 노선·신뢰로 판단) 내보낸다
            const voters=f.members.filter(id=>id!==o.id);
            const yes=voters.filter(id=>{const m=party(g,id);return plans[id].actions.some(x=>x.type==='expel'&&x.target===o.id)||(m.bot&&(Math.hypot(m.eco-o.eco,m.soc-o.soc)>.9||o.trust<35))}).length;
            if(yes*2<=voters.length){if(!expelTried.has(o.id)){expelTried.add(o.id);say(`「${f.name}」에서 ${o.name} 제명안이 회원 과반을 얻지 못했습니다.`,p.id,o.id)}continue}
          }else if(f.head!==p.id)continue;
          const x=leave(o);p.trust-=2;o.trust+=2;
          say(`「${f.name}」 대표 ${p.name}이 ${o.name}을 연맹에서 제명했습니다.${x.gone?' 남은 당이 하나라 연맹은 해체됩니다.':''}`,p.id,o.id);
        }
      }
    }
    // 아직 반영되지 않은 수락된 제안이 있으면 여기서 마저 반영한다 (보통은 수락하는 순간 applyDeals로 이미 반영된다)
    formEdits(g,talk,say);formAmends(g,talk,say);
    const {refused}=formDeals(g,talk,say,true);
    for(const[p,t]of refused)if(!isAlly(p,t.id))say(`${t.name}이 ${p.name}의 연맹 제안을 받지 않았습니다.`,p.id,t.id);
    const pacts=(g.pendingPacts||[]).slice();g.pendingPacts=[];g.dealsDone=[];g.amendsDone=[];g.editsDone=[];
    for(const p of g.parties)if(p.allyLead)plans[p.id].pm=p.allyLead;
    // 본회의 표결
    const bills=[];let fell=false;
    for(const it of g.agenda){
      let yes=0,no=0;const votes={};
      // 연맹 합의 법안은 그 연맹 회원 모두를 찬성으로 묶는다.
      const bound=it.kind==='pact'&&isAlly(party(g,it.by),it.by2)?[it.by,...allies(party(g,it.by))]:[];
      // 연맹 규칙이 '모든 안건 연맹 당론'이면 대표가 아닌 회원은 대표 당과 같은 표를 던진다
      const follow=new Set();
      for(const p of g.parties){
        const f=fedOf(g,p);
        if(bound.includes(p.id))votes[p.id]='yes';
        else if(f&&rulesOf(f).bind==='all'&&f.head!==p.id&&plans[f.head]){votes[p.id]=bound.includes(f.head)?'yes':plans[f.head].votes[it.id];follow.add(p.id)}
        else votes[p.id]=plans[p.id].votes[it.id];
        if(votes[p.id]==='yes')yes+=p.seats;else no+=p.seats;
      }
      let passed=yes>no,vetoed=false;
      if(passed&&g.system==='presidential'&&it.kind!=='noconf'&&g.pmParty&&votes[g.pmParty]==='no'&&yes<(yes+no)*2/3){
        passed=false;vetoed=true;say(`대통령이 「${it.title}」에 거부권을 행사했습니다. 재의결에 필요한 3분의 2에 못 미쳤습니다.`,g.pmParty);
      }
      bills.push({id:it.id,kind:it.kind,title:it.title,by:it.by,yes,no,passed,vetoed,votes});
      const author=it.by?party(g,it.by):null;
      if(it.kind==='noconf'){
        const pm=pmOf(g);
        if(passed&&pm&&author&&!author.fixed)pts(author).law+=PTS.noconf;
        if(passed&&pm){pm.trust-=8;pm.unity-=5;say(g.system==='westminster'?`내각 불신임안 가결. ${pm.name} 내각이 무너져 조기 총선을 치릅니다.`:`내각 불신임안 가결. ${pm.name} 내각이 총사퇴합니다.`,pm.id);g.pmParty=null;fell=true}
        else if(author){author.trust-=2;say(`${author.name}이 낸 내각 불신임안이 부결됐습니다.`,author.id)}
        continue;
      }
      const w=it.kind==='gov'?3:2;
      // 승점: 찬성해서 법으로 만든 당만 이념 점수를 받는다. 노선에 맞으면 가점, 어긋나는 법에 찬성했으면 감점.
      // 의석이 적은 당은 표결에 미친 힘만큼만 받는다. 노선에 어긋난 법에 반대표를 던졌으면 소신 점수를 받는다.
      const broad=yes>=(yes+no)*.65;
      if(passed)for(const p of g.parties){if(p.fixed)continue;const a=billAlign(it,p),s=pts(p),k=sway(p);
        if(Math.hypot(p.eco,p.soc)<.3){if(votes[p.id]==='yes'&&broad){s.ideo+=PTS.ideoMid*k;s.nIdeo++}continue}
        if(votes[p.id]==='yes'){if(a>.25){s.ideo+=(PTS.ideoHit+(a>.7?PTS.ideoStrong:0))*k;s.nIdeo++}else if(a<-.25)s.ideo+=PTS.ideoMiss}
        else if(a<-.25)s.ideo+=PTS.ideoStand*k}
      {const pm=pmOf(g),s=x=>x&&!x.fixed?pts(x):null;
        if(it.kind==='gov'&&pm){if(passed){s(pm).law+=PTS.govLaw;s(pm).nLaw++;for(const id of allies(pm)){const al=party(g,id);if(s(al))s(al).law+=PTS.partnerLaw*sway(al)}}
          else{s(pm).law+=PTS.govFail;for(const q of g.parties)if(s(q)&&!inGov(g,q)&&votes[q.id]==='no')s(q).law+=PTS.block}}
        if(it.kind==='member'&&author){if(passed){s(author).law+=PTS.ownLaw;s(author).nLaw++}else s(author).law+=PTS.ownFail}
        if(it.kind==='pact'&&passed)for(const id of[it.by,it.by2]){const q=party(g,id),x=s(q);if(x){x.law+=PTS.pactLaw*sway(q);x.nLaw++}}
      }
      if(it.kind==='pact')say(`연립 합의 법안 「${it.title}」 ${passed?'가결':'부결'}.`,it.by,it.by2);
      if(it.kind==='emer')say(`긴급 법안 「${it.title}」 ${passed?'가결':'부결'}.`);
      for(const p of g.parties){
        const v=votes[p.id]==='yes'?1:-1;const a=billAlign(it,p);
        if(Math.abs(a)>.2)p.unity+=a*v>0?4:follow.has(p.id)?-2:-6;
        for(const reg of REGIONS)p.reg[reg.id]+=billAlign(it,reg)*w*v;
        if((passed&&v>0)||(!passed&&v<0))p.trust+=1;
        if(passed&&v>0)for(const k in it.pass)p.reg[k]+=it.pass[k];
      }
      const pm=pmOf(g);
      if(it.kind==='gov'&&pm){pm.trust+=passed?2:-3;if(!passed)say(`정부 법안 「${it.title}」 부결. ${pm.name} 내각에 타격입니다.`,pm.id)}
      if(it.kind==='member'&&author){
        if(passed){author.trust+=2;for(const k in it.pass)author.reg[k]+=3*reach(author);say(`${author.name} 발의 「${it.title}」 가결.`,author.id)}
        else say(`${author.name} 발의 「${it.title}」 부결.`,author.id);
      }
    }
    // 총리 지명 선거
    let pmReport=null;
    if(g.pmElection){
      const tally=Object.fromEntries(g.parties.map(p=>[p.id,0]));
      for(const p of g.parties)tally[plans[p.id].pm]+=p.seats;
      const order=Object.keys(tally).sort((a,b)=>tally[b]-tally[a]||party(g,b).seats-party(g,a).seats||(a<b?-1:1));
      let winner=order[0];let runoff=null;
      if(tally[winner]<=TOTAL/2){
        const[x,y]=[party(g,order[0]),party(g,order[1])];
        const rt={[x.id]:0,[y.id]:0};
        for(const p of g.parties){
          const pick=plans[p.id].pm;
          if(pick===x.id||pick===y.id)rt[pick]+=p.seats;
          else if(isAlly(p,x.id)!==isAlly(p,y.id))rt[isAlly(p,x.id)?x.id:y.id]+=p.seats;
          else{
            const dx=Math.hypot(x.eco-p.eco,x.soc-p.soc),dy=Math.hypot(y.eco-p.eco,y.soc-p.soc);
            rt[dx<=dy?x.id:y.id]+=p.seats;
          }
        }
        runoff=rt;winner=rt[y.id]>rt[x.id]?y.id:x.id;
      }
      g.pmParty=winner;g.pmElection=false;
      const w=party(g,winner);w.trust+=3;
      pmReport={tally,runoff,winner,votes:Object.fromEntries(g.parties.map(p=>[p.id,plans[p.id].pm]))};
      say(`${w.leader?w.leader+' 대표('+w.name+')':w.name+' 대표'}가 총리로 지명됐습니다.`,w.id);
    }
    const betray=(p,t)=>{if(isAlly(p,t.id)){const x=leave(p);p.trust-=8;t.trust+=3;say(`${p.name}이 연맹 동료 ${t.name}을 공격해 「${x.f.name}」에서 떨어져 나갔습니다.`,p.id,t.id)}};
    // 행정: 표결 전 내각이 그대로일 때만 집행
    let dissolve=false;
    if(!fell&&!pmReport){
      for(const p of g.parties){
        for(const a of plans[p.id].gov){
          const d=GOV[a.type];if(govCost(a.type)>g.treasury)continue;
          if(d.pmOnly&&!canDissolve(g,p))continue;
          g.treasury-=govCost(a.type);
          const t=a.target?party(g,a.target):null;
          switch(a.type){
            case'budget':{p.reg[a.region]+=4*satur(p,a.region)*reach(p);for(const id of allies(p))party(g,id).reg[a.region]+=2;say(`정부, ${REG[a.region].name}에 예산 배정.`,p.id);break}
            case'welfare':p.trust+=BAL.welfare;REGIONS.filter(x=>x.eco>0).forEach(x=>p.reg[x.id]+=2);say('정부, 민생 지원금 지급.',p.id);break;
            case'taxcut':p.funds+=5*U;REGIONS.filter(x=>x.eco<0).forEach(x=>p.reg[x.id]+=2);say('정부, 세금 감면 시행.',p.id);break;
            case'security':REGIONS.filter(x=>x.soc<0).forEach(x=>p.reg[x.id]+=3);say('정부, 안보 태세 강화.',p.id);break;
            case'reshuffle':p.unity+=10;p.trust+=BAL.reshuffle;say(`${p.name}, 내각 개편 단행.`,p.id);break;
            case'probe':betray(p,t);t.trust-=7;if(r()<.4){p.trust-=8;say(`${t.name} 수사 지시가 권력 남용 논란으로 번졌습니다.`,p.id,t.id)}else say(`검찰, ${t.name} 관련 수사 착수.`,p.id,t.id);break;
            case'dissolve':dissolve=true;g.dissolved=true;say(`${g.system==='semi'?p.name+' 출신 대통령':p.leader?p.leader+' 총리':p.name+' 출신 총리'}, 의회 해산 선언. 조기 총선을 치릅니다.`,p.id);break;
          }
        }
      }
    }
    if(fell&&g.system==='westminster')dissolve=true;
    // 행동
    const proposals=[];let noConf=null;
    const order=shuffle(g.parties.map(p=>p.id),r);
    for(const id of order){
      const p=party(g,id);
      for(const a of plans[id].actions){
        p.funds-=actionCost(a);const k=levelEffect(a);
        const t=a.target?party(g,a.target):null;
        switch(a.type){
          case'rally':p.reg[a.region]+=6*k*satur(p,a.region)*reach(p);break;
          case'recruit':p.members=p.m0?p.members*(1+.04*k):p.members+1.5*k;break;
          case'talent':p.talent=Math.min(BAL.talentMax,p.talent+2.5*k);p.trust+=1;say(`${p.name}, 외부 인재 영입 발표.`,p.id);break;
          case'policy':{p.trust+=4*k;REGIONS.slice().sort((x,y)=>fit(p,y)-fit(p,x)).slice(0,2).forEach(x=>p.reg[x.id]+=1*reach(p));break}
          case'unify':p.unity+=12*k;break;
          case'fundraise':{p.funds+=fundGain(p);p.trust-=2;if(r()<.25){p.trust-=6;say(`${p.name}, 후원금 불법 의혹 보도.`,p.id)}break}
          case'attack':betray(p,t);t.reg[a.region]-=5*k;t.trust-=3*k;p.trust-=3;say(`${p.name}, ${REG[a.region].name}에서 ${t.name} 비난 광고.`,p.id,t.id);break;
          case'expose':{betray(p,t);const ch=clamp(.5+(50-t.trust)/100,.15,.85);
            if(r()<ch){t.trust-=12;t.unity-=6;REGIONS.forEach(x=>t.reg[x.id]-=1);say(`${p.name}의 폭로로 ${t.name} 대표 의혹이 번집니다.`,p.id,t.id)}
            else{p.trust-=7;say(`${p.name}의 ${t.name} 폭로가 허위로 드러났습니다.`,p.id,t.id)}break}
          case'poach':{betray(p,t);const ch=clamp(.15+(60-t.unity)/100,.05,.7);
            if(r()<ch&&t.district>0){const n=moveDistrict(t,p,4+Math.floor(r()*5));t.unity-=8;say(`${t.name} 지역구 의원 ${n}명이 ${p.name}으로 옮겼습니다.`,p.id,t.id)}
            else{p.trust-=2;t.unity+=2;say(`${p.name}의 ${t.name} 의원 영입이 무산됐습니다.`,p.id,t.id)}break}
          case'propose':proposals.push({p,a});break;
          case'noConfidence':if(!noConf)noConf=p;break;
        }
      }
    }
    // 사건: 분기 초에 공개된 사건(g.event)과 각 당의 대응. 사건 시스템 전에 시작한 판은 옛 방식(사후 공개) 그대로.
    let evRep;
    if(g.event&&own(EVENTS2,g.event.key)&&g.event.round===g.round)evRep=applyEvent(g,plans,r,evTop);
    else{
      const ev=EVENTS[g.eventDeck[(g.round-1)%g.eventDeck.length]];
      const top=pmOf(g)||g.parties.slice().sort((a,b)=>b.seats-a.seats)[0];
      for(const p of g.parties){
        if(ev.amt)p.trust+=(p.eco*ev.eco+p.soc*ev.soc)*ev.amt;
        if(ev.funds)p.funds+=ev.funds*U*(p.income0!=null?Math.min(1,p.income0/4/(10*U)):1);
        if(ev.trust)p.trust+=ev.trust;
        if(ev.unity)p.unity+=ev.unity;
        if(ev.blameRich&&p.funds>(p.income0!=null?p.income0/2:25))p.trust-=ev.blameRich;
      }
      if(ev.blameTop)top.trust-=ev.blameTop;
      evRep={title:ev.title,text:ev.text};
    }
    // 수입과 자연 변화
    g.treasury=r2(Math.min(60*U,g.treasury+10*U));
    // 제1야당: 정부에 들지 않은 당 가운데 의석이 가장 많은 당.
    const oppLead=(g.parties.filter(p=>!p.fixed&&!inGov(g,p)).sort((a,b)=>b.seats-a.seats)[0]||{}).id;
    for(const p of g.parties){
      p.funds+=quarterIncome(p);
      p.funds=Math.max(0,p.funds);
      if(p.kind==='major'){if(p.unity>45)p.unity-=2}else if(p.unity>55)p.unity-=1;
      p.trust+=(50-p.trust)*BAL.revert;
      // 정권 견제론: 제1야당으로 버티는 동안 표가 조금씩 모이고, 자리를 내주면 빠진다.
      p.check=p.id===oppLead?Math.min(BAL.checkMax,(p.check||0)+BAL.check):Math.max(0,(p.check||0)-BAL.check*2);
      // 오래 집권할수록 표가 줄고, 야당이 되면 서서히 회복한다.
      if(!p.fixed&&p.id===oppLead)pts(p).gov+=PTS.oppRound;
      if(!p.fixed){if(g.pmParty===p.id)pts(p).gov+=PTS.pmRound;else if(inGov(g,p))pts(p).gov+=g.system==='semi'&&g.presParty===p.id&&!isAlly(p,g.pmParty)?PTS.presRound:PTS.partnerRound}
      if(g.pmParty===p.id){p.trust-=GOV_FATIGUE;p.pmRounds=(p.pmRounds||0)+1;p.fatigue=Math.min(g.country?BAL.fatigueMaxReal:BAL.fatigueMax,(p.fatigue||0)+1.5)}
      else if(p.fatigue)p.fatigue=Math.max(0,p.fatigue-.75);
      for(const k in p.reg)p.reg[k]*=.95;
      p.talent=(p.talent||0)*BAL.talentKeep;
      p.trust=clamp(p.trust,0,100);p.unity=clamp(p.unity,0,100);
    }
    // 탈당
    for(const p of g.parties){
      if(p.unity<25&&p.district>0){
        const want=Math.ceil((25-p.unity)/4)+3;
        const dest=g.parties.filter(o=>o.id!==p.id).sort((a,b)=>Math.hypot(a.eco-p.eco,a.soc-p.soc)-Math.hypot(b.eco-p.eco,b.soc-p.soc)||b.unity-a.unity)[0];
        const n=moveDistrict(p,dest,want);p.unity+=8;
        say(`${p.name} 내분. 지역구 의원 ${n}명이 ${dest.name}으로 탈당했습니다.`,p.id,dest.id);
      }
    }
    // 선거
    let election=null;
    const isFinal=g.round>=g.maxRounds,general=isGeneralRound(g),mid=isMidRound(g);
    if(general||dissolve||mid){
      const res=electionSeats(g);
      const prev=Object.fromEntries(g.parties.map(p=>[p.id,p.seats]));
      if(general||dissolve){
        g.parties.forEach(p=>setSeats(p,res.district[p.id],res.pr[p.id]));
        // 새 국회가 정부를 다시 꾸린다. 대통령제는 대통령이 그대로 정부를 맡는다.
        if(!isFinal&&g.system!=='presidential'){g.pmParty=null;g.pmElection=g.system!=='westminster'}
        if(general)g.dissolved=false;
      }
      else{
        // 재보궐: 지역구만 4분의 1이 바뀌고 비례대표는 그대로다.
        const mix=allocate(Object.fromEntries(g.parties.map(p=>[p.id,Math.max(0,.75*p.district+.25*res.district[p.id])])),DISTRICT);
        g.parties.forEach(p=>setSeats(p,mix[p.id],p.pr));
        for(const x of res.regions){const w=party(g,x.winner);w.funds+=2*U;w.reg[x.id]+=1.5}
      }
      election={kind:general?'general':dissolve?'dissolve':'mid',regions:res.regions,prev,vote:Object.fromEntries(Object.entries(res.vote).map(([k,v])=>[k,r1(v*100)]))};
    }
    if(fell&&g.system!=='westminster')g.pmElection=true;
    if(!isFinal&&g.system==='westminster'&&!g.pmParty){
      const t=g.parties.filter(p=>!p.fixed).sort((a,b)=>b.seats-a.seats)[0];
      g.pmParty=t.id;say(`${t.name} 대표가 최대 정당 대표로 총리에 취임합니다.`,t.id);
    }
    // 대통령 선거: 게임 길이에 맞춰 중간 분기에 치른다.
    let presReport=null;
    if(!isFinal&&mid&&(g.system==='presidential'||g.system==='semi')){
      presReport=presidentialVote(g);
      const w=party(g,presReport.winner);
      if(g.system==='presidential'){if(g.pmParty!==w.id)w.fatigue=0;g.pmParty=w.id}
      else g.presParty=w.id;
      say(`대통령 선거에서 ${w.name} 후보가 당선됐습니다.`,w.id);
    }
    for(const p of g.parties){
      const b=before[p.id];
      p.delta={funds:r2(p.funds-b.funds),members:r2(p.members-b.members),trust:r1(p.trust-b.trust),unity:r1(p.unity-b.unity),seats:p.seats-b.seats};
      p.funds=r2(p.funds);p.members=r2(p.members);p.trust=r1(p.trust);p.unity=r1(p.unity);p.talent=r1(p.talent);
      for(const k in p.reg)p.reg[k]=r1(p.reg[k]);
    }
    g.report={round:g.round,bills,pm:pmReport,pres:presReport,event:evRep,news,election,auto:g.parties.filter(p=>plans[p.id].auto).map(p=>p.id)};
    // 이번 분기에 승점이 어디서 얼마나 바뀌었는지 남긴다.
    const sc1=scoreRows(g);
    g.report.score=Object.fromEntries(sc1.map((x,i)=>{const a=sc0[x.id];return[x.id,{total:x.score,rank:i+1,d:x.score-a.score,vs:x.vs,
      parts:{elec:x.elec+x.minor-a.elec-a.minor,law:x.law-a.law,ideo:x.ideo-a.ideo,gov:x.gov-a.gov,end:x.end-a.end,rep:x.rep-a.rep,goal:(x.goal||0)-(a.goal||0)}}]}));
    g.history.push({round:g.round,shares:roundShares(g),score:Object.fromEntries(sc1.map(x=>[x.id,x.score]))});
    if(isFinal){g.status='over';g.result=finalResult(g);g.deadline=0;g.agenda=[];g.botDeals=[]}
    else{
      g.round+=1;
      // 고른 정부가 분기 말에도 그대로일 때만 그 선택을 따른다.
      const agenda=[nextGovBill(g,chooser&&g.pmParty===chooser?plans[chooser].bill:null)];
      if(noConf&&g.pmParty&&!inGov(g,noConf)){
        const pm=pmOf(g);
        agenda.push({id:'a'+(g.seq++),kind:'noconf',title:`${pm.name} 내각 불신임안`,desc:`${noConf.name} 발의. 가결되면 내각이 물러나고 총리를 새로 뽑습니다.`,eco:0,soc:0,pass:{},by:noConf.id});
      }
      for(const c of pacts){
        const a=party(g,c.a),b=party(g,c.b);if(!isAlly(a,b.id))continue;const t=TOPICS[c.topic],f=fedOf(g,a);
        agenda.push({id:'a'+(g.seq++),kind:'pact',title:t.title,desc:`「${f.name}」 합의 · ${t.label}. 연맹 소속 당은 모두 찬성으로 묶입니다.`,eco:t.eco,soc:t.soc,pass:{},by:a.id,by2:b.id});
      }
      proposals.sort((x,y)=>(inGov(g,y.p)?1:0)-(inGov(g,x.p)?1:0)||y.p.seats-x.p.seats);
      proposals.forEach(({p,a},i)=>{
        if(i>=MEMBER_BILLS){say(`${p.name} 발의 「${a.title}」는 의사일정에 오르지 못했습니다.`,p.id);return}
        const t=TOPICS[a.topic];
        agenda.push({id:'a'+(g.seq++),kind:'member',title:a.title,desc:`${p.name} 발의 · ${t.label} · ${REG[a.region].name} 지원`,eco:t.eco,soc:t.soc,pass:{[a.region]:3},by:p.id});
      });
      g.agenda=agenda;
      drawEvent(g,r,evRep.follow||null);
      g.botDeals=botDeals(g,r);
      // AI끼리 주고받은 제안은 기다릴 것 없이 바로 맺고, 소식은 이번 결과 보고에 싣는다
      formDeals(g,{},(text,...who)=>g.report.news.push({text,who}),false);
      g.deadline=g.timer?now+g.timer*1000:0;
    }
    return g;
  }
  // 연맹 단일 후보: 수반 후보, 없으면 지지가 가장 높은 회원 당
  function presCarrier(g,f,nat){
    if(f.lead&&party(g,f.lead))return party(g,f.lead);
    return f.members.map(id=>party(g,id)).filter(x=>x&&!x.fixed).sort((a,b)=>nat[b.id]-nat[a.id]||(a.id<b.id?-1:1))[0]||null;
  }
  function presidentialVote(g){
    const cands=g.parties.filter(p=>!p.fixed);const nat=nationalShares(g);
    // 연맹 규칙이 '단일화'면 회원 당 표가 연맹 단일 후보에게 모이고, '각자 출마'면 당마다 따로 나간다.
    const carrier=p=>{const f=fedOf(g,p);if(!f||rulesOf(f).pres==='separate')return p;return presCarrier(g,f,nat)||p};
    const tally=Object.fromEntries(cands.map(p=>[p.id,0]));
    if(g.country==='us'){
      for(const reg of REGIONS){
        const sh=regionShares(g,reg),byC={};
        for(const p of cands){const c=carrier(p);byC[c.id]=(byC[c.id]||0)+sh[p.id]}
        const w=Object.keys(byC).sort((a,b)=>byC[b]-byC[a])[0];
        tally[w]+=reg.seats;
      }
      return{method:'선거인단',tally,winner:Object.keys(tally).sort((a,b)=>tally[b]-tally[a])[0]};
    }
    for(const p of cands)tally[carrier(p).id]+=r1(nat[p.id]*100);
    for(const k in tally)tally[k]=r1(tally[k]);
    const order=Object.keys(tally).sort((a,b)=>tally[b]-tally[a]);
    if(g.country!=='fr')return{method:'직선 최다 득표',tally,winner:order[0]};
    const x=party(g,order[0]),y=party(g,order[1]),run={[x.id]:0,[y.id]:0};
    for(const p of cands){
      const dx=Math.hypot(x.eco-p.eco,x.soc-p.soc),dy=Math.hypot(y.eco-p.eco,y.soc-p.soc);
      run[dx<=dy?x.id:y.id]+=r1(nat[p.id]*100);
    }
    for(const k in run)run[k]=r1(run[k]);
    return{method:'직선 결선투표',tally,runoff:run,winner:run[y.id]>run[x.id]?y.id:x.id};
  }
  const pts=p=>p.pts||(p.pts={law:0,ideo:0,gov:0,nLaw:0,nIdeo:0});
  // 표결 영향력: 의회의 10% 이상이면 1, 그보다 작으면 줄어든다(최소 0.3).
  const sway=p=>clamp(Math.sqrt(p.seats/(TOTAL*.1)),.3,1);
  // 승점표. 게임 중에는 '지금 끝나면' 기준으로 보여 주고, 마지막 분기 뒤 같은 식으로 확정한다.
  // 정당의 목표: {seats:목표 의석, par:기준 승점}. 가상 공화국과 무소속 묶음은 목표가 없다.
  // 표에 없는 당(새로 만든 당 등)은 시작 의석이 가까운 두 당 값으로 보간한다.
  function goalOf(g,p){
    if(!g.country||p.fixed)return null;
    const T=GOALS[g.country];if(!T)return null;
    const R=Math.max(1,(g.maxRounds|0)||12),K=GOAL_ROUNDS;
    let j=K.findIndex(k=>k>=R);j=j<=0?1:j;if(R>K[K.length-1])j=K.length-1;
    const t=(R-K[j-1])/(K[j]-K[j-1]),at=(v,o)=>v[1+2*(j-1)+o]+(v[1+2*j+o]-v[1+2*(j-1)+o])*t;
    const pt=v=>({s0:v[0],seats:at(v,0),par:at(v,1)});
    let o;
    if(own(T,p.pick))o=pt(T[p.pick]);
    else{
      const xs=Object.values(T).map(pt).sort((a,b)=>a.s0-b.s0);if(!xs.length)return null;
      const s0=p.startSeats||0;let i=xs.findIndex(x=>x.s0>=s0);
      if(i<0)i=xs.length-1;if(i===0)i=Math.min(1,xs.length-1);
      const a=xs[Math.max(0,i-1)],b=xs[i],t=b.s0===a.s0?0:(s0-a.s0)/(b.s0-a.s0);
      o={seats:a.seats+(b.seats-a.seats)*t,par:a.par+(b.par-a.par)*t};
      o.seats=Math.max(o.seats,s0*.8);
    }
    return{seats:Math.max(1,Math.round(o.seats)),par:Math.max(0,Math.round(o.par))};
  }
  function scoreRows(g){
    const majority=Math.floor(TOTAL/2)+1;const k=400/TOTAL;
    const rows=g.parties.map(p=>{const s=p.pts||{law:0,ideo:0,gov:0,nLaw:0,nIdeo:0};
      const elec=Math.round(g.country?p.seats/TOTAL*PTS.share+Math.min(p.seats-p.startSeats,TOTAL*PTS.growthMax)/TOTAL*PTS.growth:p.seats/TOTAL*PTS.seat);
      const minor=!g.country&&p.kind==='minor'?Math.round(Math.min(p.seats,TOTAL*.15)/TOTAL*PTS.minor):0;
      return{id:p.id,seats:p.seats,startSeats:p.startSeats,elec,minor,law:Math.round(s.law),ideo:Math.round(s.ideo),gov:Math.round(s.gov),nLaw:s.nLaw,nIdeo:s.nIdeo,
        rep:p.fixed?0:Math.round((p.trust-50)*PTS.trust+(p.unity-50)*PTS.unity),end:0,label:''}});
    const row=id=>rows.find(x=>x.id===id);
    const live=g.parties.filter(p=>!p.fixed).map(p=>row(p.id));
    const solo=live.find(x=>x.seats>=majority);
    if(g.system==='presidential'&&g.pmParty){const t=row(g.pmParty);t.end=PTS.president;t.label='대통령 여당'}
    else if(solo){solo.end=PTS.solo;solo.label='단독 과반'}
    else{
      // 연맹 묶음: 한 연맹의 회원 당들. 정부를 맡은 묶음을 먼저 본다.
      const blocs=(g.feds||[]).map(f=>f.members.filter(id=>party(g,id)&&!party(g,id).fixed))
        .map(ids=>({ids,seats:ids.reduce((n,id)=>n+row(id).seats,0)})).filter(b=>b.ids.length>1&&b.seats>=majority);
      if(blocs.length){const b=blocs.sort((x,y)=>(y.ids.includes(g.pmParty)?1:0)-(x.ids.includes(g.pmParty)?1:0)||y.seats-x.seats||x.ids.length-y.ids.length)[0];
        for(const id of b.ids){row(id).end=PTS.coalition;row(id).label='연립 과반'}}
      else{const t=live.slice().sort((x,y)=>y.seats-x.seats)[0];if(t){t.end=PTS.minority;t.label='원내 1당'}}
    }
    if(g.system==='semi'&&g.presParty){const t=row(g.presParty);t.end+=PTS.semiPres;t.label=t.label?t.label+'·대통령':'대통령'}
    for(const x of rows){
      const G=goalOf(g,party(g,x.id));x.goal=0;
      if(G){x.goalSeats=G.seats;x.par=G.par;x.hit=x.seats>=G.seats;x.goal=x.hit?PTS.goalHit:0}
    }
    rows.forEach(x=>{x.score=x.elec+x.minor+x.law+x.ideo+x.gov+x.end+x.rep+x.goal;if(x.par!=null)x.vs=x.score-x.par});
    const out=id=>party(g,id).fixed?1:0;
    // 국가 모드는 목표 대비(승점 − 기준 승점)로, 가상 공화국은 승점으로 순위를 매긴다.
    const key=x=>x.vs!=null?x.vs:x.score;
    rows.sort((a,b)=>out(a.id)-out(b.id)||key(b)-key(a)||b.score-a.score||b.seats-a.seats);
    return rows;
  }
  // 시나리오: 정해진 나라·정당·분기로 시작해 목표를 이루면 성공. goal: seats(이상) · gov(정부를 맡음) · win(1위)
  const SCENARIOS=[
    {id:'kr_underdog',country:'kr',pick:'reform',rounds:12,goal:{seats:20},title:'3석의 반란',desc:'개혁신당을 맡아 12분기 안에 20석 이상을 만드세요.'},
    {id:'jp_hold',country:'jp',pick:'ldp',rounds:12,goal:{seats:233},title:'과반을 지켜라',desc:'자유민주당을 맡아 마지막 총선 뒤에도 단독 과반 233석을 지키세요.'},
    {id:'us_flip',country:'us',pick:'dem',rounds:6,goal:{seats:228},title:'하원 탈환',desc:'민주당을 맡아 6분기 안에 228석 이상의 안정 과반을 차지하세요.'},
    {id:'uk_insurgent',country:'uk',pick:'reform',rounds:12,goal:{seats:65},title:'반란군의 진격',desc:'영국개혁당을 맡아 12분기 안에 65석 이상을 만드세요.'},
    {id:'fr_left',country:'fr',pick:'ps',rounds:12,goal:{gov:true,seats:75},title:'좌파 총리',desc:'사회당 계열을 맡아 마지막 총선 뒤 75석 이상으로 총리를 배출하세요.'},
    {id:'virtual_minor',country:'',kind:'minor',rounds:12,goal:{win:true},title:'군소정당의 꿈',desc:'가상 공화국에서 군소정당으로 시작해 1위를 차지하세요.'},
  ];
  // 시나리오 진행 상황: {sc, ok(지금 기준 달성 여부), done(끝났는지), now(지금 값 설명용)}
  function scenarioState(g,pid){
    const sc=SCENARIOS.find(x=>x.id===g.scenario);if(!sc)return null;
    const p=party(g,pid);if(!p)return null;
    const G=sc.goal;let ok=true;
    if(G.seats!=null)ok=ok&&p.seats>=G.seats;
    if(G.gov)ok=ok&&(g.pmParty===p.id||g.presParty===p.id);
    if(G.win)ok=ok&&(g.result?g.result.winner===p.id:scoreRows(g)[0].id===p.id);
    return{sc,ok,done:g.status==='over'};
  }
  function finalResult(g){const rows=scoreRows(g);return{rows,winner:rows[0].id}}
  // 끝난 판을 한 임기 더 잇는다. 승점과 의석은 그대로 이어지고, 처음 정한 분기 수만큼 가서 다음 총선을 치른다.
  function continueGame(state,now){
    useMap(state);const g=normAllies(clone(state));if(g.status!=='over'||!g.result)return g;
    const r=rng((g.seed+g.round*7919+104729)>>>0);
    const term=Math.max(4,g.term||g.maxRounds);
    g.terms=(g.terms||[]).concat({round:g.round,winner:g.result.winner,rows:g.result.rows.map(x=>({id:x.id,score:x.score,seats:x.seats}))});
    g.term=term;g.round+=1;g.maxRounds=g.round+term-1;g.midRound=g.round+Math.ceil(term/2)-1;
    g.status='playing';g.result=null;g.dissolved=false;g.report=null;
    // 총선 뒤라 새 국회가 정부를 다시 꾸린다. 대통령제는 대통령이 그대로 정부를 맡는다.
    if(g.system==='westminster'){const t=g.parties.filter(p=>!p.fixed).sort((a,b)=>b.seats-a.seats)[0];g.pmParty=t.id;g.pmElection=false}
    else if(g.system!=='presidential'){g.pmParty=null;g.pmElection=true}
    g.agenda=[nextGovBill(g)];
    drawEvent(g,r);
    g.botDeals=botDeals(g,r);g.dealsDone=[];g.amendsDone=[];g.editsDone=[];g.pendingPacts=[];
    g.dealNews=[];formDeals(g,{},(text,...who)=>g.dealNews.push({text,who}),false);
    g.deadline=g.timer?now+g.timer*1000:0;
    return g;
  }
  return{AP,NCOLORS,get TOTAL(){return TOTAL},get DISTRICT(){return DISTRICT},get PR(){return PR},get REGIONS(){return REGIONS},get REG(){return REG},COUNTRIES,useMap,PR_THRESHOLD,KINDS,IDEOLOGIES,ACTIONS,GOV,TOPICS,BILLS,defaultBill,dealView,applyDeals,pactLead,hasPres,rulesOf,fedCap,LEAVE_OPTS,cleanAmend,amendText,amendView,amendTally,AMEND_FIELDS,scoreRows,continueGame,PTS,BAL,SCENARIOS,scenarioState,GOALS,GOAL_ROUNDS,goalOf,PERSONAS,personaOf,EVENTS2,RESP,reactOpts,eventTop,sway,MAX_ALLIES,MAX_FED,allies,isAlly,fedOf,fedById,fedSeats,dealKind,normAllies,isGeneralRound,isMidRound,nextGeneral,nextMid,fit,regionShares,nationalShares,electionSeats,fundGain,newGame,resolveRound,billAlign,party,pmOf,govSlots,inGov,canDissolve,LEVELS,actionCost,govCost,get U(){return U},get UNIT(){return UNIT},get MEMBER_NAME(){return MEMBER_NAME},botMove,sanitize,rng};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=E;

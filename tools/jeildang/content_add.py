#!/usr/bin/env python3
"""제1당 콘텐츠 확장(2026-11): 정부 법안·사건을 한·일·영으로 함께 적어 두고,
engine.js의 BILLS·EVENTS2 끝에 붙이고 번역표(tools/i18n/jeildang.tsv)에 번역을 더한다.
이미 들어간 항목(같은 한국어 제목)은 건너뛰므로 여러 번 돌려도 된다.

사용: python3 tools/jeildang/content_add.py
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
ENGINE = ROOT / 'public/jeildang/engine.js'
TSV = ROOT / 'tools/i18n/jeildang.tsv'

# 정부 법안: (한국어 제목, 설명, 일본어 제목, 설명, 영어 제목, 설명, eco, soc, pass)
# eco +분배 / −시장, soc +개방 / −전통·안보. pass: 가결 시 권역 기반 변화(권역 id는 모든 나라에서 공통)
BILLS = [
 ('최저임금 인상안','내년 최저임금을 큰 폭으로 올립니다.','最低賃金引き上げ案','来年の最低賃金を大幅に引き上げます。','Minimum Wage Increase Act','Raises next year\'s minimum wage sharply.',.8,.1,{'donghae':3}),
 ('상속세 완화안','가업 승계 때 상속세 부담을 줄입니다.','相続税緩和案','家業承継時の相続税負担を軽くします。','Inheritance Tax Relief Act','Cuts inheritance tax when passing on a family business.',-.8,-.1,{'neoreun':3}),
 ('공공 돌봄 확대법','국공립 어린이집과 노인 돌봄을 늘립니다.','公的ケア拡充法','公立保育所と高齢者ケアを増やします。','Public Care Expansion Act','Expands public childcare and elderly care.',.7,.2,{'hanbyeol':2,'seodeul':2}),
 ('플랫폼 노동자 보호법','배달·대리 기사에게 산재보험과 최저 보수를 보장합니다.','プラットフォーム労働者保護法','配達・代行ドライバーに労災保険と最低報酬を保障します。','Platform Workers Protection Act','Guarantees accident insurance and minimum pay for delivery and app drivers.',.7,.4,{'hanbyeol':3}),
 ('규제 샌드박스 확대법','신산업에 규제 없이 시험할 기회를 넓힙니다.','規制サンドボックス拡大法','新産業が規制なしで試せる機会を広げます。','Regulatory Sandbox Act','Lets new industries test products free of regulation for longer.',-.6,.5,{'namnyeok':3}),
 ('대기업 집단 규제법','재벌 계열사 간 일감 몰아주기를 막습니다.','大企業グループ規制法','財閥系列会社間の取引集中を防ぎます。','Conglomerate Regulation Act','Bans conglomerates from steering contracts to their own affiliates.',.7,.1,{}),
 ('부동산 공급 확대법','도심 고밀 개발로 주택 공급을 늘립니다.','住宅供給拡大法','都心の高密度開発で住宅供給を増やします。','Housing Supply Act','Boosts housing supply through dense urban development.',-.5,.2,{'hanbyeol':2,'neoreun':2}),
 ('임대료 상한제','전월세 인상률에 상한을 둡니다.','家賃上限制','家賃の値上げ率に上限を設けます。','Rent Cap Act','Caps annual rent increases.',.8,.2,{'hanbyeol':3,'neoreun':-2}),
 ('국가 장학금 확대법','소득 하위 절반의 대학 등록금을 지원합니다.','国家奨学金拡大法','所得下位半分の大学授業料を支援します。','National Scholarship Act','Covers university tuition for the lower half of earners.',.6,.4,{'hanbyeol':2}),
 ('사립학교 자율화법','사립학교의 교육과정·학생 선발 자율을 넓힙니다.','私立学校自律化法','私立学校のカリキュラムと生徒選抜の自由を広げます。','Private School Autonomy Act','Gives private schools more freedom over curriculum and admissions.',-.5,-.3,{'neoreun':2}),
 ('징병제 개편안','복무 기간을 줄이고 모병 비중을 늘립니다.','徴兵制改編案','服務期間を短縮し、志願兵の比重を増やします。','Conscription Reform Act','Shortens service and shifts toward a volunteer force.',.1,.6,{'hanbyeol':2,'bukbang':-2}),
 ('예비군 강화법','예비군 훈련과 장비를 늘립니다.','予備役強化法','予備役の訓練と装備を増やします。','Reserve Forces Act','Expands reserve training and equipment.',-.2,-.8,{'bukbang':3}),
 ('동성 결혼 인정법','동성 부부의 혼인 신고를 받습니다.','同性婚承認法','同性カップルの婚姻届を受理します。','Marriage Equality Act','Allows same-sex couples to register their marriage.',.1,.95,{'hanbyeol':2,'seodeul':-3}),
 ('가족 가치 지원법','다자녀·전통 가정에 세제 혜택을 줍니다.','家族価値支援法','多子世帯・伝統的家庭に税制優遇を与えます。','Family Values Support Act','Gives tax breaks to large and traditional families.',.2,-.8,{'seodeul':3}),
 ('차별금지법','고용·서비스에서 차별을 금지하고 구제 절차를 둡니다.','差別禁止法','雇用やサービスでの差別を禁止し、救済手続きを設けます。','Anti-Discrimination Act','Bans discrimination in jobs and services and sets up remedies.',.2,.8,{'hanbyeol':2}),
 ('공공 와이파이 무료화','전국 공공장소 와이파이를 무료로 엽니다.','公共Wi-Fi無料化','全国の公共の場のWi-Fiを無料で開放します。','Free Public Wi-Fi Act','Opens free Wi-Fi in public places nationwide.',.4,.4,{'seom':2}),
 ('전기요금 현실화','원가에 맞춰 전기요금을 올립니다.','電気料金の適正化','原価に合わせて電気料金を引き上げます。','Electricity Price Reform','Raises power prices to match costs.',-.5,0,{'donghae':-2}),
 ('재생에너지 의무화','발전량의 40%를 재생에너지로 채웁니다.','再生エネルギー義務化','発電量の40%を再生可能エネルギーで賄います。','Renewable Energy Mandate','Requires 40% of power to come from renewables.',.3,.6,{'seom':2,'donghae':-2}),
 ('석탄 발전 조기 폐쇄','석탄 발전소를 10년 앞당겨 닫습니다.','石炭火力の早期廃止','石炭火力発電所を10年前倒しで閉鎖します。','Coal Phase-Out Act','Closes coal plants ten years early.',.3,.5,{'donghae':-3,'hanbyeol':2}),
 ('수소 산업 육성법','수소차와 충전소에 보조금을 줍니다.','水素産業育成法','水素車と充填所に補助金を出します。','Hydrogen Industry Act','Subsidises hydrogen cars and fuelling stations.',-.3,.3,{'donghae':3}),
 ('반도체 특별법','반도체 공장에 세액 공제와 전력망을 지원합니다.','半導体特別法','半導体工場に税額控除と電力網を支援します。','Semiconductor Act','Gives chip plants tax credits and grid support.',-.6,.2,{'neoreun':3}),
 ('중소기업 납품단가 연동제','원자재 값이 오르면 납품 단가도 오르게 합니다.','中小企業納品単価連動制','原材料価格が上がれば納品単価も上がるようにします。','Supplier Price Indexation Act','Ties suppliers\' prices to raw material costs.',.6,0,{'donghae':2}),
 ('자영업 손실 보상법','재난으로 문을 닫은 가게에 손실을 보상합니다.','自営業損失補償法','災害で休業した店に損失を補償します。','Small Business Compensation Act','Compensates shops forced to close by disasters.',.6,-.1,{'seodeul':2}),
 ('지역화폐 확대법','지역 상품권 발행에 국비를 대폭 지원합니다.','地域通貨拡大法','地域商品券の発行に国費を大幅に支援します。','Local Currency Act','Funds local shopping vouchers with national money.',.6,-.2,{'seodeul':2,'seom':2}),
 ('공무원 연금 개혁안','공무원 연금을 국민연금 수준에 맞춥니다.','公務員年金改革案','公務員年金を国民年金の水準に合わせます。','Civil Service Pension Reform','Brings civil service pensions in line with the national pension.',-.6,0,{}),
 ('국민연금 보장 강화안','소득대체율을 올리고 보험료도 올립니다.','国民年金保障強化案','所得代替率と保険料をともに引き上げます。','Pension Benefit Increase','Raises pension benefits along with contributions.',.7,-.1,{'seodeul':3}),
 ('검찰 수사권 축소법','검찰의 직접 수사 범위를 줄입니다.','検察捜査権縮小法','検察の直接捜査の範囲を縮小します。','Prosecution Reform Act','Narrows what prosecutors can investigate directly.',.2,.5,{}),
 ('경찰력 강화법','순찰 인력과 장비를 크게 늘립니다.','警察力強化法','パトロール人員と装備を大幅に増やします。','Police Expansion Act','Adds many more patrol officers and equipment.',-.2,-.7,{'neoreun':2}),
 ('마약 범죄 엄벌법','마약 유통에 무기징역까지 선고할 수 있게 합니다.','麻薬犯罪厳罰法','麻薬の流通に無期懲役まで科せるようにします。','Drug Crime Act','Allows life sentences for drug trafficking.',0,-.7,{}),
 ('사형제 폐지안','사형을 종신형으로 바꿉니다.','死刑廃止案','死刑を終身刑に置き換えます。','Death Penalty Abolition','Replaces the death penalty with life imprisonment.',.1,.8,{'seodeul':-2}),
 ('언론 중재법','허위 보도에 징벌적 손해배상을 물립니다.','言論仲裁法','虚偽報道に懲罰的損害賠償を科します。','Media Liability Act','Imposes punitive damages for false reporting.',.2,-.4,{}),
 ('공영방송 독립법','공영방송 이사회를 정치권 밖에서 뽑습니다.','公共放送独立法','公共放送の理事会を政治の外で選びます。','Public Broadcaster Independence Act','Takes political appointments out of the public broadcaster\'s board.',.1,.6,{}),
 ('선거 연령 하향안','투표 연령을 16세로 낮춥니다.','選挙年齢引き下げ案','投票年齢を16歳に引き下げます。','Voting Age Act','Lowers the voting age to 16.',.2,.7,{'hanbyeol':2}),
 ('비례대표 확대안','지역구를 줄이고 비례 의석을 늘립니다.','比例代表拡大案','小選挙区を減らし比例の議席を増やします。','Proportional Representation Act','Cuts district seats in favour of list seats.',.2,.4,{}),
 ('수도 이전 특별법','행정 수도를 중부 지역으로 옮깁니다.','首都移転特別法','行政首都を中部地域に移します。','Capital Relocation Act','Moves the administrative capital to the central region.',.4,-.1,{'hanbyeol':-3,'seodeul':3}),
 ('관광 비자 면제 확대','관광객 무비자 입국 국가를 늘립니다.','観光ビザ免除拡大','ビザなしで入国できる観光客の国を増やします。','Visa Waiver Expansion','Lets visitors from more countries enter visa-free.',-.3,.6,{'namnyeok':2,'seom':2}),
 ('농지 규제 완화법','농지를 공장·주택 용지로 쉽게 바꿉니다.','農地規制緩和法','農地を工場・住宅用地へ転用しやすくします。','Farmland Deregulation Act','Makes it easy to rezone farmland for factories and housing.',-.6,0,{'neoreun':2,'seodeul':-3}),
 ('스마트팜 지원법','첨단 농업 설비에 보조금을 줍니다.','スマート農業支援法','先端農業設備に補助金を出します。','Smart Farming Act','Subsidises high-tech farming equipment.',-.1,.2,{'seodeul':3}),
]

# 사건: dict(key, ko 제목/본문, ja, en, 효과 필드, resp, 그 밖의 필드)
# 효과 필드는 engine.js EVENTS2 주석 참고. region/reco/rsoc/ramt: 권역 사건. bill: 긴급 법안(제목·설명은 번역 포함).
EVENTS = [
 # ── 일반 사건
 dict(key='pandemic', ko=('신종 감염병 유행','새 감염병이 퍼지기 시작했습니다. 정부가 현장을 챙기지 않으면 다음 분기 대유행으로 번집니다.'),
      ja=('新型感染症の流行','新しい感染症が広がり始めました。政府が現場に対応しなければ、次の四半期に大流行へ広がります。'),
      en=('New disease outbreak','A new infection is spreading. If the government doesn\'t act on the ground, it becomes a full epidemic next quarter.'),
      f=dict(trust=-1), resp=['relief','stimulus','blame'], follow={'key':'pandemic2','unless':'relief'}),
 dict(key='pandemic2', ko=('감염병 대유행','방역에 실패해 병상이 부족하고 가게들이 문을 닫습니다. 정부 책임론이 거셉니다.'),
      ja=('感染症の大流行','防疫に失敗して病床が足りず、店が次々と閉まっています。政府の責任を問う声が強まっています。'),
      en=('Epidemic','Containment failed: hospitals are full and shops are closing. The government is under fire.'),
      f=dict(blameTop=7,funds=-2), resp=['relief','blame','unity'], chain=True),
 dict(key='strike', ko=('항만 총파업','남녘 항만 노조가 총파업에 들어갔습니다. 정부가 중재하지 않으면 장기 파업으로 번집니다.'),
      ja=('港湾ゼネスト','南の港湾労組がゼネストに突入しました。政府が仲裁しなければ長期ストへ広がります。'),
      en=('Port strike','Southern port unions have walked out. If the government doesn\'t mediate, it becomes a long strike.'),
      f=dict(region='namnyeok',reco=1,rsoc=0,ramt=5), resp=['mediate','local','ride'], follow={'key':'strike2','unless':'mediate'}),
 dict(key='strike2', ko=('장기 파업','파업이 길어져 물류가 멈췄습니다. 수출 기업과 시민 모두 정부를 탓합니다.'),
      ja=('長期スト','ストが長引き物流が止まりました。輸出企業も市民も政府を責めています。'),
      en=('Prolonged strike','The strike drags on and logistics have stopped. Exporters and the public both blame the government.'),
      f=dict(blameTop=5,funds=-1), resp=['mediate','blame','protest'], chain=True),
 dict(key='factory', ko=('공장 대형 화재','동해 공단 공장에서 큰불이 나 안전 규제 논쟁이 붙었습니다.'),
      ja=('工場の大規模火災','東海工業団地の工場で大火災が起き、安全規制の論争が起きています。'),
      en=('Factory fire','A major fire at a Donghae industrial plant has sparked a row over safety rules.'),
      f=dict(region='donghae',reco=1,rsoc=.2,ramt=5,trust=-1), resp=['relief','local','blame']),
 dict(key='drought', ko=('가뭄과 흉작','서들 농촌에 가뭄이 이어져 농가가 시름에 빠졌습니다.'),
      ja=('干ばつと凶作','ソドゥル農村で干ばつが続き、農家が苦しんでいます。'),
      en=('Drought and poor harvest','A long drought is hurting farmers in rural Seodeul.'),
      f=dict(region='seodeul',reco=.6,rsoc=-.6,ramt=5), resp=['relief','local','ride']),
 dict(key='newtown', ko=('신도시 교통 대란','너른 신도시권 출퇴근길이 마비돼 광역 교통 대책 요구가 커집니다.'),
      ja=('ニュータウン交通混乱','ノルン新都市圏の通勤が麻痺し、広域交通対策を求める声が高まっています。'),
      en=('Commuter gridlock','Commutes from the Neoreun new towns have ground to a halt; demands for transit grow.'),
      f=dict(region='neoreun',reco=-.5,rsoc=0,ramt=5), resp=['local','stimulus','blame']),
 dict(key='bordershot', ko=('접경 지역 포격','접경에서 포격이 오갔습니다. 정부를 중심으로 뭉치자는 여론이 생깁니다.'),
      ja=('国境地帯の砲撃','国境で砲撃の応酬がありました。政府を中心に団結しようという世論が生まれています。'),
      en=('Border shelling','Shells were exchanged at the border. Opinion rallies around the government.'),
      f=dict(region='bukbang',reco=0,rsoc=-1,ramt=6,boostTop=3), resp=['unity','ride','coop']),
 dict(key='island', ko=('섬 지역 의료 헬기 사고','응급 헬기 사고로 섬·산간 의료 공백이 드러났습니다.'),
      ja=('離島の医療ヘリ事故','救急ヘリの事故で離島・山間部の医療の空白が浮き彫りになりました。'),
      en=('Air ambulance crash','An air ambulance crash exposes the lack of care on islands and in the mountains.'),
      f=dict(region='seom',reco=.6,rsoc=0,ramt=6), resp=['relief','local']),
 dict(key='capitalrent', ko=('수도권 전세 사기','한별 수도권에서 전세 사기 피해가 잇따릅니다. 청년층이 분노합니다.'),
      ja=('首都圏の家賃詐欺','ハンビョル首都圏で賃貸保証金詐欺が相次ぎ、若者が怒っています。'),
      en=('Rental deposit fraud','A wave of deposit scams hits young renters in the Hanbyeol capital region.'),
      f=dict(region='hanbyeol',reco=.6,rsoc=.4,ramt=5), resp=['relief','local','blame']),
 dict(key='inflation', ko=('물가 급등','장바구니 물가가 치솟아 생활비 부담이 커졌습니다.'),
      ja=('物価の急騰','食料品などの物価が急騰し、生活費の負担が増えています。'),
      en=('Price surge','Grocery prices are soaring and living costs bite.'),
      f=dict(eco=.6,soc=0,amt=3,blameTop=3), resp=['stimulus','blame','ride']),
 dict(key='taxshock', ko=('세수 결손','세금이 예상보다 덜 걷혀 나라 살림에 구멍이 났습니다. 긴급 재정 법안이 올라옵니다.'),
      ja=('税収欠損','税収が想定を下回り、財政に穴が開きました。緊急財政法案が提出されます。'),
      en=('Revenue shortfall','Tax revenue came in short, leaving a hole in the budget. An emergency fiscal bill is tabled.'),
      f=dict(funds=-1), resp=['coop','blame'], bill=dict(ko=('긴급 재정 건전화법','지출을 줄이고 일부 세율을 올려 적자를 메웁니다.'), ja=('緊急財政健全化法','支出を削り一部の税率を上げて赤字を埋めます。'), en=('Emergency Fiscal Act','Cuts spending and raises some taxes to close the deficit.'), eco=-.3, soc=0)),
 dict(key='cyber', ko=('대규모 해킹','공공기관 전산망이 해킹당했습니다. 사이버 안보 긴급 법안이 올라옵니다.'),
      ja=('大規模ハッキング','公共機関のネットワークがハッキングされました。サイバー安保の緊急法案が提出されます。'),
      en=('Major cyberattack','Government networks were hacked. An emergency cybersecurity bill is tabled.'),
      f=dict(eco=0,soc=-.7,amt=3), resp=['ride','blame'], bill=dict(ko=('사이버 안보 긴급법','정보기관에 민간 통신망 감시 권한을 줍니다.'), ja=('サイバー安保緊急法','情報機関に民間通信網の監視権限を与えます。'), en=('Emergency Cybersecurity Act','Lets intelligence agencies monitor private networks.'), eco=0, soc=-.7)),
 dict(key='aiboom', ko=('AI 일자리 충격','AI 자동화로 사무직 일자리가 줄어든다는 보고서가 나왔습니다.'),
      ja=('AIによる雇用ショック','AI自動化で事務職の雇用が減るという報告書が出ました。'),
      en=('AI jobs shock','A report warns AI automation will wipe out office jobs.'),
      f=dict(eco=.6,soc=.4,amt=4), resp=['ride','debate']),
 dict(key='birthrate', ko=('출생아 수 역대 최저','출생아 수가 또 최저를 기록했습니다. 가족 지원 경쟁이 붙습니다.'),
      ja=('出生数が過去最低','出生数がまた過去最低を記録しました。家族支援の競争が始まります。'),
      en=('Record-low births','Births hit another record low, setting off a race to support families.'),
      f=dict(eco=.4,soc=-.4,amt=3), resp=['ride','coop']),
 dict(key='olympics', ko=('국제 행사 유치','대형 국제 행사 유치에 성공해 분위기가 들뜹니다.'),
      ja=('国際イベントの誘致','大型国際イベントの誘致に成功し、雰囲気が盛り上がっています。'),
      en=('Major event won','The country won the bid to host a major international event.'),
      f=dict(boostTop=3,unity=2), resp=['ride','local']),
 dict(key='scandal2', ko=('보좌진 갑질 폭로','한 정당 의원의 보좌진 갑질이 폭로됐습니다. 대상 당 신뢰 −3.'),
      ja=('秘書へのパワハラ暴露','ある政党の議員による秘書へのパワハラが暴露されました。対象の党の信頼 −3。'),
      en=('Staff abuse exposé','An MP from one party is exposed for abusing staff. Target party trust −3.'),
      f=dict(target=True,hitTrust=3), resp=['apology','cut','resign','attack']),
 dict(key='defector', ko=('의원 탈당 선언','한 정당의 중진 의원이 탈당을 예고했습니다. 대상 당 결속 −5.'),
      ja=('議員の離党宣言','ある政党の重鎮議員が離党を予告しました。対象の党の結束 −5。'),
      en=('Senior MP threatens to quit','A senior MP announces plans to leave one party. Target party unity −5.'),
      f=dict(target=True,hitUnity=5), resp=['compromise','unity','attack']),
 # ── 조건부 사건
 dict(key='nocon_storm', ko=('내각 총사퇴 요구','정부 수반 당의 신뢰가 바닥을 치자 총사퇴 요구가 쏟아집니다. 대상 당 신뢰 −3.'),
      ja=('内閣総辞職要求','政府首班の党の信頼が底をつき、総辞職を求める声が噴き出しています。対象の党の信頼 −3。'),
      en=('Calls to resign','With the governing party\'s trust at rock bottom, calls for it to step down pour in. Target party trust −3.'),
      f=dict(target=True,hitTrust=3,when='pmWeak'), resp=['coop','resign','protest','attack']),
 dict(key='tvdebate', ko=('총선 TV 토론','총선을 앞두고 정당 대표 TV 토론이 열립니다. 준비한 만큼 결과가 갈립니다.'),
      ja=('総選挙のテレビ討論','総選挙を前に党首のテレビ討論が行われます。準備次第で結果が分かれます。'),
      en=('Election TV debate','Party leaders face off on TV before the election. Preparation decides the outcome.'),
      f=dict(when='election'), resp=['debate','ride']),
 dict(key='split', ko=('분당 위기','결속이 무너진 정당에서 분당 이야기가 나옵니다. 대상 당 결속 −4.'),
      ja=('分党の危機','結束が崩れた政党で分党の話が出ています。対象の党の結束 −4。'),
      en=('Party on the brink','Talk of a split breaks out in a party whose unity has collapsed. Target party unity −4.'),
      f=dict(target=True,hitUnity=4,when='split'), resp=['compromise','unity','resign','attack']),
 dict(key='surge', ko=('신드롬급 돌풍','신뢰가 치솟은 정당에 언론의 검증이 몰립니다. 대상 당 신뢰 −2.'),
      ja=('社会現象級の旋風','信頼が急上昇した政党にメディアの検証が集中しています。対象の党の信頼 −2。'),
      en=('Media frenzy','A party riding high in trust now faces intense media scrutiny. Target party trust −2.'),
      f=dict(target=True,hitTrust=2,when='surge'), resp=['apology','defy','attack']),
 dict(key='fatigue', ko=('정권 심판론','집권이 길어지자 이번에는 바꿔야 한다는 여론이 커집니다. 대상 당 신뢰 −3.'),
      ja=('政権審判論','政権が長引き、今度こそ変えるべきだという世論が強まっています。対象の党の信頼 −3。'),
      en=('Time for a change','After a long time in power, the mood is turning against the governing party. Target party trust −3.'),
      f=dict(target=True,hitTrust=3,when='longGov'), resp=['coop','defy','blame']),
 # ── 나라 전용 사건
 dict(key='kr_semi', ko=('반도체 수출 신기록','반도체 수출이 사상 최대를 기록했습니다. 시장 노선이 힘을 받습니다.'), ja=('半導体輸出が過去最高','半導体輸出が過去最高を記録しました。市場重視の路線が勢いづきます。'), en=('Record chip exports','Semiconductor exports hit an all-time high. Pro-market parties gain.'),
      f=dict(country='kr',eco=-.8,soc=.2,amt=4,funds=1), resp=['ride']),
 dict(key='kr_med', ko=('의대 정원 갈등','의대 정원 확대를 두고 의료계가 집단행동에 나섰습니다. 정부가 중재하지 않으면 의료 공백으로 번집니다.'), ja=('医学部定員の対立','医学部の定員拡大をめぐり医療界が集団行動に出ました。政府が仲裁しなければ医療の空白へ広がります。'), en=('Medical school dispute','Doctors take collective action over medical school quotas. Without mediation, it becomes a care crisis.'),
      f=dict(country='kr',trust=-1), resp=['mediate','blame','ride'], follow={'key':'medical','unless':'mediate'}),
 dict(key='kr_missile', ko=('북한 미사일 발사','북한이 탄도미사일을 쏘았습니다. 안보 노선에 관심이 쏠립니다.'), ja=('北朝鮮のミサイル発射','北朝鮮が弾道ミサイルを発射しました。安保重視の路線に関心が集まります。'), en=('North Korean missile test','North Korea fires a ballistic missile. Security-minded parties gain.'),
      f=dict(country='kr',eco=0,soc=-1,amt=4,region='bukbang',reco=0,rsoc=-1,ramt=4), resp=['ride','unity']),
 dict(key='kr_local', ko=('지방 소멸 경고','지방 군 단위 절반이 소멸 위기라는 보고서가 나왔습니다.'), ja=('地方消滅の警告','地方の郡の半分が消滅の危機にあるという報告書が出ました。'), en=('Rural decline warning','A report says half of rural counties face extinction.'),
      f=dict(country='kr',region='seodeul',reco=.6,rsoc=-.3,ramt=5), resp=['local','ride']),
 dict(key='kr_jeonse', ko=('청년 주거 시위','청년들이 주거비 대책을 요구하며 광장에 모였습니다.'), ja=('若者の住居デモ','若者たちが住居費対策を求めて広場に集まりました。'), en=('Youth housing protest','Young people rally in the square demanding action on housing costs.'),
      f=dict(country='kr',eco=.6,soc=.5,amt=4), resp=['ride','coop','protest']),
 dict(key='jp_yen', ko=('엔저 장기화','엔화 약세가 이어져 수입 물가가 오르고 수출 기업은 웃습니다.'), ja=('円安の長期化','円安が続き、輸入物価が上がる一方で輸出企業は潤っています。'), en=('Weak yen persists','A long slide in the yen lifts import prices while exporters celebrate.'),
      f=dict(country='jp',eco=.4,soc=0,amt=3,funds=1), resp=['stimulus','ride','blame']),
 dict(key='jp_quake', ko=('대지진 발생','큰 지진이 났습니다. 정부가 현장을 챙기지 않으면 복구 지연 논란으로 번집니다.'), ja=('大地震の発生','大きな地震が起きました。政府が現場に対応しなければ復旧遅れの論争へ広がります。'), en=('Major earthquake','A major earthquake strikes. If the government isn\'t on the ground, it turns into a row over slow recovery.'),
      f=dict(country='jp',blameTop=4), resp=['relief','blame','unity'], follow={'key':'recovery','unless':'relief'}),
 dict(key='jp_rice', ko=('쌀값 급등','쌀값이 폭등해 비축미 방출 요구가 커집니다.'), ja=('米価の急騰','米価が高騰し、備蓄米の放出を求める声が高まっています。'), en=('Rice price spike','Rice prices soar and calls to release reserves grow.'),
      f=dict(country='jp',blameTop=3,region='seodeul',reco=.5,rsoc=-.5,ramt=4), resp=['stimulus','blame','local']),
 dict(key='jp_defense', ko=('방위비 증액 논쟁','방위비를 두 배로 늘리는 계획을 두고 논쟁이 붙었습니다.'), ja=('防衛費増額の論争','防衛費を倍増する計画をめぐって論争が起きています。'), en=('Defence budget row','A plan to double defence spending sparks debate.'),
      f=dict(country='jp',eco=-.2,soc=-.8,amt=4), resp=['ride','debate']),
 dict(key='jp_party', ko=('파티권 의혹','한 정당의 정치자금 파티 수입 누락 의혹이 불거졌습니다. 대상 당 신뢰 −4.'), ja=('パーティー券疑惑','ある政党の政治資金パーティー収入の不記載疑惑が浮上しました。対象の党の信頼 −4。'), en=('Fundraiser ticket scandal','One party is accused of hiding fundraiser income. Target party trust −4.'),
      f=dict(country='jp',target=True,hitTrust=4), resp=['apology','cut','resign','attack']),
 dict(key='us_shutdown', ko=('연방정부 셧다운 위기','예산안이 막혀 연방정부가 문을 닫을 위기입니다. 정부가 협치하지 않으면 셧다운으로 번집니다.'), ja=('連邦政府閉鎖の危機','予算案が行き詰まり、連邦政府閉鎖の危機です。政府が協調しなければ閉鎖に至ります。'), en=('Shutdown looms','The budget is stuck and a federal shutdown looms. Without compromise, the government shuts down.'),
      f=dict(country='us',trust=-1), resp=['coop','blame','protest'], follow={'key':'us_shutdown2','unless':'coop'}),
 dict(key='us_shutdown2', ko=('연방정부 셧다운','연방정부가 멈췄습니다. 공무원 무급 휴직에 여론이 나빠집니다.'), ja=('連邦政府閉鎖','連邦政府が止まりました。公務員の無給休職に世論が悪化しています。'), en=('Government shutdown','The federal government has shut down. Unpaid furloughs sour the public mood.'),
      f=dict(country='us',blameTop=6,trust=-2), resp=['coop','blame'], chain=True),
 dict(key='us_court', ko=('대법원 판결 논쟁','대법원의 사회 쟁점 판결로 나라가 둘로 갈렸습니다.'), ja=('最高裁判決の論争','最高裁の社会問題に関する判決で国が二分されました。'), en=('Supreme Court ruling','A Supreme Court ruling on a social issue splits the country.'),
      f=dict(country='us',eco=0,soc=.8,amt=4), resp=['ride','protest','debate']),
 dict(key='us_tariff', ko=('관세 전쟁','주요 교역국과 관세 보복이 오갑니다. 농가와 공장이 흔들립니다.'), ja=('関税戦争','主要貿易国と関税の報復合戦が起きています。農家と工場が揺れています。'), en=('Tariff war','Tit-for-tat tariffs with a major trading partner hit farms and factories.'),
      f=dict(country='us',funds=-1,region='seodeul',reco=.3,rsoc=-.5,ramt=4), resp=['stimulus','ride','blame']),
 dict(key='us_border', ko=('국경 이민 급증','남부 국경으로 이민자가 몰려 이민 정책 논쟁이 커집니다.'), ja=('国境の移民急増','南部国境に移民が押し寄せ、移民政策の論争が激しくなっています。'), en=('Border surge','A surge at the southern border inflames the immigration debate.'),
      f=dict(country='us',eco=0,soc=-.8,amt=4), resp=['ride','blame']),
 dict(key='us_gun', ko=('총기 참사','총기 참사 뒤 총기 규제 논쟁이 다시 불붙었습니다.'), ja=('銃乱射事件','銃乱射事件のあと、銃規制の論争が再燃しています。'), en=('Mass shooting','After a mass shooting, the gun control debate reignites.'),
      f=dict(country='us',eco=0,soc=.7,amt=4), resp=['ride','unity']),
 dict(key='uk_nhs', ko=('NHS 대기 명단 최장','국민보건서비스 대기 명단이 역대 최장을 기록했습니다.'), ja=('NHS待機リストが過去最長','国民保健サービスの待機リストが過去最長を記録しました。'), en=('NHS waiting lists hit record','NHS waiting lists reach their longest ever.'),
      f=dict(country='uk',eco=.7,soc=0,amt=4,blameTop=3), resp=['stimulus','blame','ride']),
 dict(key='uk_scot', ko=('스코틀랜드 독립 여론','스코틀랜드 독립 찬성 여론이 과반을 넘었습니다.'), ja=('スコットランド独立世論','スコットランド独立への賛成が過半数を超えました。'), en=('Scottish independence poll','Support for Scottish independence passes 50%.'),
      f=dict(country='uk',trust=-1), resp=['unity','ride','debate']),
 dict(key='uk_living', ko=('생활비 위기','에너지와 식료품 값이 올라 생활비 위기가 깊어집니다.'), ja=('生活費危機','エネルギーと食料品の価格が上がり、生活費危機が深まっています。'), en=('Cost-of-living crisis','Energy and food prices deepen the cost-of-living crisis.'),
      f=dict(country='uk',eco=.6,soc=0,amt=4,funds=-1), resp=['stimulus','blame','ride']),
 dict(key='uk_eu', ko=('유럽연합 관계 재협상','유럽연합과의 무역 협정 재협상을 두고 논쟁이 붙었습니다.'), ja=('EUとの関係再交渉','EUとの貿易協定の再交渉をめぐって論争が起きています。'), en=('EU relations reset','A renegotiation of trade terms with the EU divides opinion.'),
      f=dict(country='uk',eco=-.2,soc=.7,amt=4), resp=['ride','debate']),
 dict(key='uk_royal', ko=('왕실 경사','왕실 경사로 나라 분위기가 들뜹니다. 모든 정당 결속 +3.'), ja=('王室の慶事','王室の慶事で国中が祝賀ムードです。全政党の結束 +3。'), en=('Royal celebration','A royal celebration lifts the national mood. All parties unity +3.'),
      f=dict(country='uk',unity=3), resp=[]),
 dict(key='fr_pension', ko=('연금 개혁 시위','연금 수령 나이를 늦추는 계획에 대규모 시위가 일어났습니다. 정부가 중재하지 않으면 총파업으로 번집니다.'), ja=('年金改革デモ','年金受給年齢を引き上げる計画に大規模なデモが起きています。政府が仲裁しなければゼネストへ広がります。'), en=('Pension reform protests','Mass protests erupt over raising the pension age. Without mediation, it becomes a general strike.'),
      f=dict(country='fr',eco=.6,soc=0,amt=3), resp=['mediate','protest','ride'], follow={'key':'strike2','unless':'mediate'}),
 dict(key='fr_farmers', ko=('농민 트랙터 시위','농민들이 트랙터로 고속도로를 막았습니다.'), ja=('農民のトラクターデモ','農民がトラクターで高速道路を封鎖しました。'), en=('Farmers\' tractor blockade','Farmers block motorways with tractors.'),
      f=dict(country='fr',region='seodeul',reco=.3,rsoc=-.6,ramt=5), resp=['local','mediate','blame']),
 dict(key='fr_riots', ko=('교외 소요 사태','교외 지역에서 소요가 번져 치안과 사회 통합 논쟁이 붙었습니다.'), ja=('郊外の暴動','郊外で暴動が広がり、治安と社会統合をめぐる論争が起きています。'), en=('Suburban unrest','Unrest spreads in the suburbs, sparking a debate over policing and integration.'),
      f=dict(country='fr',eco=0,soc=-.6,amt=4), resp=['ride','unity','coop']),
 dict(key='fr_energy', ko=('에너지 가격 급등','전기와 가스 값이 급등해 가격 상한 요구가 커집니다.'), ja=('エネルギー価格の急騰','電気とガスの価格が急騰し、価格上限を求める声が高まっています。'), en=('Energy price spike','Power and gas prices surge, fuelling calls for a price cap.'),
      f=dict(country='fr',eco=.6,soc=0,amt=3,blameTop=2), resp=['stimulus','blame']),
 dict(key='fr_493', ko=('표결 없는 법안 통과 논란','정부가 표결 없이 법안을 통과시키는 헌법 조항을 쓰려 해 반발이 큽니다. 대상 당 신뢰 −3.'), ja=('採決なしの法案成立をめぐる論争','政府が採決なしで法案を成立させる憲法条項を使おうとして反発が強まっています。対象の党の信頼 −3。'), en=('Bill forced through without a vote','The government\'s move to pass a bill without a vote under a constitutional clause sparks outrage. Target party trust −3.'),
      f=dict(country='fr',target=True,hitTrust=3,when='longGov'), resp=['coop','defy','protest','attack']),
]

def js(v):
    return json.dumps(v, ensure_ascii=False)

def main():
    src = ENGINE.read_text(encoding='utf-8')
    rows = []
    have = {l.split('\t')[0] for l in TSV.read_text(encoding='utf-8').splitlines() if l and not l.startswith('#')}
    def tr(ko, ja, en):
        if ko not in have:
            rows.append(f'{ko}\t{ja}\t{en}'); have.add(ko)

    # 법안
    bi = src.index('  const BILLS=[')
    be = src.index('\n  ];', bi)
    block = src[bi:be]
    add = []
    for ko, kd, ja, jd, en, ed, eco, soc, pas in BILLS:
        tr(ko, ja, en); tr(kd, jd, ed)
        if f"title:'{ko}'" in block or f'title:"{ko}"' in block:
            continue
        add.append(f"\n    {{title:{js(ko)},desc:{js(kd)},eco:{eco},soc:{soc},pass:{js(pas).replace(chr(34),chr(39))}}},")
    src = src[:be] + ''.join(add) + src[be:]

    # 사건
    ei = src.index('  const EVENTS2={')
    ee = src.index('\n  };', ei)
    block = src[ei:ee]
    addE = []
    for e in EVENTS:
        (kt, kx), (jt, jx), (et, ex) = e['ko'], e['ja'], e['en']
        tr(kt, jt, et); tr(kx, jx, ex)
        if f"\n    {e['key']}:" in block:
            continue
        f = dict(e.get('f', {}))
        parts = [f"title:{js(kt)}", f"text:{js(kx)}"]
        for k, v in f.items():
            parts.append(f"{k}:{'true' if v is True else js(v)}")
        parts.append('resp:' + js(e['resp']))
        if e.get('follow'): parts.append('follow:' + js(e['follow']))
        if e.get('chain'): parts.append('chain:true')
        if e.get('bill'):
            b = e['bill']; (bt, bd), (bjt, bjd), (bet, bed) = b['ko'], b['ja'], b['en']
            tr(bt, bjt, bet); tr(bd, bjd, bed)
            parts.append(f"bill:{{title:{js(bt)},desc:{js(bd)},eco:{b['eco']},soc:{b['soc']}}}")
        addE.append(f"\n    {e['key']}:{{{','.join(parts)}}},")
    src = src[:ee] + ''.join(addE) + src[ee:]
    ENGINE.write_text(src, encoding='utf-8')
    if rows:
        with TSV.open('a', encoding='utf-8') as fh:
            fh.write('\n'.join(rows) + '\n')
    print(f'법안 +{len(add)}, 사건 +{len(addE)}, 번역 +{len(rows)}')

if __name__ == '__main__':
    main()

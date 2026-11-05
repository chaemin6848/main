/* 도감 도우미 공통 엔진. 각 게임 폴더의 data.js 가 window.GAME 을 먼저 채운다.
   GAME = { id, storeKey, cookie, vers:[{k,code,tag,name:{ko,ja,en}}×2], D, PLACE, EVO, T:{ko,ja,en} }
   D 한 줄: [번호, 한국어, 일본어, 영어, 전단계, 진화, 입수처 토큰, 버전전용 태그, 특수 S/C/B]
   진화: 숫자=레벨, 그 밖은 EVO 키 ("trade"로 시작하면 교환 진화)
   입수처 토큰: 숫자=도로 번호, 문자열=PLACE 키, "T:장소:주는번호"=게임 내 교환
   특수: S=스타팅 택1, C=화석 등 택1, B=교배로만 얻음, X=이 게임에서는 못 잡고 다른 게임에서 데려옴
   numOffset: 화면에 보이는 번호 = 내부 번호 + numOffset (도감이 000번부터 시작하는 게임용) */
(function(){
"use strict";
const G=window.GAME, D=G.D, V=G.vers;

/* ===== 후원 링크 =====
   url을 채우면 버튼이 나타나요. 비워 두면 후원 영역 전체가 숨겨져요. */
const DONATE=[
  {label:"Buy Me a Coffee",url:"https://buymeacoffee.com/attl6848"},
  {label:"투네이션",url:"",only:"ko"}
];

const LANGS=["ko","ja","en"], LI={ko:0,ja:1,en:2};
const EVO=Object.assign({
 thunder:["천둥의돌","かみなりのいし","Thunder Stone"],moon:["문스톤","つきのいし","Moon Stone"],
 fire:["불꽃의돌","ほのおのいし","Fire Stone"],water:["물의돌","みずのいし","Water Stone"],
 leaf:["리프의돌","リーフのいし","Leaf Stone"],trade:["교환","通信交換","Trade"]
},G.EVO||{});
const PLACE=Object.assign({
 etc:["등","など","etc."],
 x2:["(2마리)","（2匹）","(2 of them)"],
 rare:["(드묾)","（まれ）","(rare)"],
 event:["이벤트 배포 한정 · 목표에서 제외","イベント配布のみ・目標から除外","Event only · not counted"]
},G.PLACE||{});
const SUFFIX=["etc","x2","rare"];

// 받침 유무로 조사 고르기 (을/를, 은/는)
const jo=(w,a,b)=>{const c=w.charCodeAt(w.length-1);return w+((c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28)?a:b)};
const BASE={
 ko:{
  back:"← 게임 선택",saveLbl:"완성할 세이브",tabPlan:"할 일",tabDex:"전체 도감",
  q:"번호나 이름으로 검색 (한·일·영)",fAll:"전체",fNeed:"미등록",tagV:s=>`${s} 전용`,tagT:"교환 진화",
  noMatch:"조건에 맞는 포켓몬이 없어요.",
  backupLbl:"백업 코드 · 다른 기기에서 붙여넣으면 체크 상태를 옮길 수 있어요",
  copy:"코드 복사",load:"붙여넣은 코드 불러오기",reset:"체크 전부 지우기",resetArm:"한 번 더 누르면 초기화",
  mCopied:"복사했어요",mSelected:"선택했어요. 길게 눌러 복사하세요",mBad:(a,b)=>`코드 형식이 달라요. ${a}….${b}… 전체를 붙여넣어 주세요`,
  mFail:"코드를 읽지 못했어요",mLoaded:"불러왔어요",mReset:"초기화했어요",mCkOn:"쿠키 저장을 켰어요",mCkOff:"기본 저장만 사용해요",
  mImported:"이전 주소의 체크 기록을 옮겨 왔어요",mImportAsk:"이전 주소의 백업 코드를 아래 칸에 넣어 뒀어요. '붙여넣은 코드 불러오기'를 누르면 지금 기록을 덮어써요",
  where0:"저장 위치: 이 기기 브라우저",where1:"저장 위치: 이 기기 브라우저 + 쿠키",whereAcc:" + Google 계정",login:"로그인",
  privacy:"개인정보처리방침",cookieSet:"쿠키 설정",
  ckT:"체크 기록을 쿠키에도 저장할까요?",
  ckP:c=>`체크 상태는 기본으로 이 기기 브라우저 저장소에 남아요. 허용하면 같은 내용을 쿠키(${c}, 1년)에도 저장해서, 브라우저 저장소가 지워져도 기록을 되살릴 수 있어요. 서버로 보내는 정보는 없어요.`,
  ckMore:"자세히 보기",ckYes:"쿠키 허용",ckNo:"거부 (기본 저장만)",
  supHide:"후원 안내 닫기",supShow:"☕ Buy Me a Coffee",mSupHid:"후원 안내를 닫았어요. 맨 아래 Buy Me a Coffee 링크는 그대로 있어요",
  supP:"이 도우미가 도감 채우는 데 도움이 됐다면 후원으로 응원해 주세요. 후원은 외부 사이트에서 진행돼요.",
  credit:"비공식 팬 제작 도구입니다. 포켓몬 관련 권리는 Nintendo · Creatures · GAME FREAK에 있습니다.",
  pill:v=>`${v} 등록`,
  lv:n=>`Lv${n}`,
  route:ns=>`${ns.join("·")}번도로`,
  trade:(pl,give)=>`${pl} NPC 교환 (${give} 주기)`,
  sep:" · ",
  recvT:O=>`${O} 세이브에서 받기`,recvN:O=>`${O}에 이미 등록된 포켓몬이에요. 교환으로 보냈다가 돌려받으면 둘 다 등록돼요.`,
  recvTE:"받기만 해도 등록 (교환 진화형)",recvReg:"상대 세이브에 등록됨",
  tradeT:"교환 진화",tradeN:"전 단계를 상대 세이브로 보냈다가 돌려받으면 진화해요.",
  tradeHow:(f,m,inT,O)=>(inT?`${jo(f,"을","를")} 교환`:`${f}(${O}에 있음) 교환`)+(m?` · ${m}`:""),
  orCatch:l=>`또는 직접 잡기: ${l}`,orEvo:(f,m)=>`또는 ${f}에서 진화 (${m})`,
  evoT:"진화시키기",evoN:"전 단계를 갖고 있어요. 레벨업이나 진화의 돌 등으로 끝나요.",
  evoHow:(f,m,inT,O)=>`${f} → ${m}${inT?"":` · ${jo(f,"은","는")} ${O}에서 받아오기`}`,
  exclT:O=>`${O}에서 잡아 받기`,exclN:T=>`${T}에서는 야생으로 안 나오는 버전 전용이에요.`,
  catchT:"직접 잡기",
  extT:"다른 게임에서 데려오기",extN:"이 게임 안에서는 잡을 수 없어요. 다른 게임이나 앱에서 데려와야 해요.",
  breedT:"교배로 얻기",breedN:"키우미집에 진화형을 맡기면 알로 얻어요. 진화형을 먼저 채우세요.",
  choiceT:"선택지 (택1)",choiceN:"",
  preT:"전 단계부터",preN:"전 단계가 양쪽 세이브 모두에 없어요. 아래 진행 순서대로 채우면 돼요.",
  preHow:(f,m,b,bl)=>`${f} ${m} · 시작: ${b}, ${bl}`,
  intro:(T,n,a,b)=>`${T}에 남은 ${n}종을 지금 할 수 있는 순서로 묶었어요. ${a}·${b} 버튼을 누르면 해당 세이브에 등록돼요.`,
  count:n=>`${n}종`
 },
 ja:{
  back:"← ゲーム選択",saveLbl:"完成させるセーブ",tabPlan:"やること",tabDex:"図鑑一覧",
  q:"番号・名前で検索（日・韓・英）",fAll:"すべて",fNeed:"未登録",tagV:s=>`${s}限定`,tagT:"通信進化",
  noMatch:"条件に合うポケモンがいません。",
  backupLbl:"バックアップコード・別の端末に貼り付けるとチェック状態を移せます",
  copy:"コードをコピー",load:"貼り付けたコードを読み込む",reset:"チェックをすべて消す",resetArm:"もう一度押すとリセット",
  mCopied:"コピーしました",mSelected:"選択しました。長押しでコピーしてください",mBad:(a,b)=>`コードの形式が違います。${a}….${b}… を丸ごと貼り付けてください`,
  mFail:"コードを読み込めませんでした",mLoaded:"読み込みました",mReset:"リセットしました",mCkOn:"クッキー保存をオンにしました",mCkOff:"基本の保存のみ使います",
  mImported:"以前のアドレスのチェック記録を移しました",mImportAsk:"以前のアドレスのバックアップコードを下の欄に入れました。「貼り付けたコードを読み込む」を押すと今の記録を上書きします",
  where0:"保存先：この端末のブラウザ",where1:"保存先：この端末のブラウザ＋クッキー",whereAcc:"＋Googleアカウント",login:"ログイン",
  privacy:"プライバシーポリシー",cookieSet:"クッキー設定",
  ckT:"チェック記録をクッキーにも保存しますか？",
  ckP:c=>`チェック状態は基本的にこの端末のブラウザ内に保存されます。許可すると同じ内容をクッキー（${c}、1年間）にも保存し、ブラウザの保存データが消えても記録を復元できます。サーバーに送信される情報はありません。`,
  ckMore:"詳しく見る",ckYes:"クッキーを許可",ckNo:"拒否（基本の保存のみ）",
  supHide:"支援の案内を閉じる",supShow:"☕ Buy Me a Coffee",mSupHid:"支援の案内を閉じました。いちばん下のBuy Me a Coffeeリンクはそのまま使えます",
  supP:"このヘルパーが図鑑埋めの役に立ったら、応援していただけるとうれしいです。支援は外部サイトで行われます。",
  credit:"非公式のファン制作ツールです。ポケモンに関する権利は Nintendo・Creatures・GAME FREAK に帰属します。",
  pill:v=>`${v}に登録`,
  lv:n=>`Lv${n}`,
  route:ns=>`${ns.join("・")}番道路`,
  trade:(pl,give)=>`${pl}のゲーム内交換（${give}を渡す）`,
  sep:"・",
  recvT:O=>`${O}のセーブから受け取る`,recvN:O=>`${O}ですでに登録済みのポケモンです。交換で送って返してもらえば両方に登録されます。`,
  recvTE:"受け取るだけで登録（通信進化後）",recvReg:"相手のセーブに登録済み",
  tradeT:"通信進化",tradeN:"進化前を相手のセーブに送って返してもらうと進化します。",
  tradeHow:(f,m,inT,O)=>`${f}${inT?"":`（${O}にいる）`}を通信交換`+(m?`・${m}`:""),
  orCatch:l=>`または野生で捕まえる：${l}`,orEvo:(f,m)=>`または${f}から進化（${m}）`,
  evoT:"進化させる",evoN:"進化前を持っています。レベルアップや進化の石などで完了です。",
  evoHow:(f,m,inT,O)=>`${f} → ${m}${inT?"":`・${f}は${O}から受け取る`}`,
  exclT:O=>`${O}で捕まえて受け取る`,exclN:T=>`${T}では野生で出ないバージョン限定です。`,
  catchT:"自分で捕まえる",
  extT:"ほかのソフトから連れてくる",extN:"このソフトの中では捕まえられません。ほかのソフトやアプリから連れてきましょう。",
  breedT:"タマゴで手に入れる",breedN:"育て屋に進化後のポケモンを預けるとタマゴで手に入ります。先に進化後を埋めましょう。",
  choiceT:"選択（どちらか1つ）",choiceN:"",
  preT:"進化前から",preN:"進化前がどちらのセーブにもいません。下の順番で埋めていきましょう。",
  preHow:(f,m,b,bl)=>`${f} ${m}・スタート：${b}／${bl}`,
  intro:(T,n,a,b)=>`${T}に残っている${n}匹を、今できる順にまとめました。${a}・${b}ボタンを押すとそのセーブに登録されます。`,
  count:n=>`${n}匹`
 },
 en:{
  back:"← Choose a game",saveLbl:"Save to complete",tabPlan:"To do",tabDex:"Full Dex",
  q:"Search by number or name (EN · JA · KO)",fAll:"All",fNeed:"Missing",tagV:s=>`${s} only`,tagT:"Trade evo",
  noMatch:"No Pokémon match these filters.",
  backupLbl:"Backup code · paste it on another device to move your checks",
  copy:"Copy code",load:"Load pasted code",reset:"Clear all checks",resetArm:"Press again to clear",
  mCopied:"Copied",mSelected:"Selected. Long-press to copy",mBad:(a,b)=>`That code doesn't look right. Paste the whole ${a}….${b}… code`,
  mFail:"Couldn't read that code",mLoaded:"Loaded",mReset:"Cleared",mCkOn:"Cookie saving is on",mCkOff:"Using browser storage only",
  mImported:"Moved your checks over from the old address",mImportAsk:"Your backup code from the old address is in the box below. Press \"Load pasted code\" to replace your current checks with it",
  where0:"Saved in: this browser",where1:"Saved in: this browser + cookie",whereAcc:" + Google account",login:"Log in",
  privacy:"Privacy Policy",cookieSet:"Cookie settings",
  ckT:"Also save your checks in a cookie?",
  ckP:c=>`Your checks are always kept in this browser's storage. If you allow it, the same data is also saved in a cookie (${c}, 1 year), so it can be restored if browser storage gets cleared. Nothing is sent to a server.`,
  ckMore:"Learn more",ckYes:"Allow cookie",ckNo:"Decline (browser storage only)",
  supHide:"Hide tip banner",supShow:"☕ Buy Me a Coffee",mSupHid:"Tip banner hidden. The Buy Me a Coffee link at the bottom is still there",
  supP:"If this helper saved you some time, you can support it with a tip. Tips are handled on an external site.",
  credit:"Unofficial fan-made tool. Pokémon and related names are trademarks of Nintendo, Creatures and GAME FREAK.",
  pill:v=>`Registered in ${v}`,
  lv:n=>`Lv. ${n}`,
  route:ns=>ns.length>1?`Routes ${ns.join(", ")}`:`Route ${ns[0]}`,
  trade:(pl,give)=>`In-game trade at ${pl} (give ${give})`,
  sep:" · ",
  recvT:O=>`Get from your ${O} save`,recvN:O=>`Already registered in ${O}. Trade it over and back to register it in both.`,
  recvTE:"Registers on receipt (already trade-evolved)",recvReg:"Registered in the other save",
  tradeT:"Trade evolutions",tradeN:"Send the previous stage to the other save and trade it back to evolve.",
  tradeHow:(f,m,inT,O)=>`Trade ${f}${inT?"":` (in ${O})`}`+(m?` · ${m}`:""),
  orCatch:l=>`or catch one: ${l}`,orEvo:(f,m)=>`or evolve ${f} (${m})`,
  evoT:"Evolve",evoN:"You already have the previous stage. Level it up, use a stone, and so on.",
  evoHow:(f,m,inT,O)=>`${f} → ${m}${inT?"":` · get ${f} from ${O}`}`,
  exclT:O=>`Catch in ${O} and trade over`,exclN:T=>`Version exclusives that don't appear in the wild in ${T}.`,
  catchT:"Catch",
  extT:"Bring from another game",extN:"Can't be caught in this game. Bring it over from another game or app.",
  breedT:"Get from an Egg",breedN:"Leave the evolved form at the Day Care to get an Egg. Fill in the evolved form first.",
  choiceT:"Choices (pick one)",choiceN:"",
  preT:"Start from earlier stages",preN:"Neither save has the previous stage yet. Work through them in this order.",
  preHow:(f,m,b,bl)=>`${f} ${m} · start: ${b}, ${bl}`,
  intro:(T,n,a,b)=>`${n} Pokémon left in ${T}, grouped by what you can do now. Tap ${a} or ${b} to mark it in that save.`,
  count:n=>`${n}`
 }
};
const T={};LANGS.forEach(l=>T[l]=Object.assign({},BASE[l],(G.T||{})[l]||{}));

const P={},ORDER=[];
D.forEach(r=>{P[r[0]]={no:r[0],ko:r[1],ja:r[2],en:r[3],from:r[4]||0,evo:r[5]||0,loc:r[6]||[],ver:r[7]||"",ch:r[8]||""};ORDER.push(r[0])});
D.forEach(r=>{const p=P[r[0]];if(!p.ver&&p.from&&P[p.from].ver)p.ver=P[p.from].ver});
ORDER.forEach(n=>P[n].ev=P[n].loc.includes("event"));
const GOAL=ORDER.filter(n=>!P[n].ev), MAX=Math.max(...ORDER);
const isTrade=p=>typeof p.evo==="string"&&p.evo.startsWith("trade");

/* ===== 저장 ===== */
const KEY=G.storeKey, CKEY="dex-cookie-consent", CNAME=G.cookie, LKEY="dex-lang";
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
function getCookie(n){const m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):null}
function setCookie(n,v,days){const sec=location.protocol==="https:"?"; Secure":"";document.cookie=`${n}=${encodeURIComponent(v)}; Max-Age=${days*86400}; Path=/; SameSite=Lax${sec}`}
const delCookie=n=>{document.cookie=`${n}=; Max-Age=0; Path=/; SameSite=Lax`};
function detectLang(){const s=lsGet(LKEY);if(LANGS.includes(s))return s;const l=(navigator.language||"").toLowerCase();return l.startsWith("ko")?"ko":l.startsWith("ja")?"ja":"en"}
// 예전 FRLG 단독 시절 동의 기록(frlg-cookie-consent)도 이어받는다
let consent=lsGet(CKEY)||lsGet("frlg-cookie-consent")||(getCookie(CKEY)==="yes"||getCookie("frlg-cookie-consent")==="yes"?"yes":null);
const K0=V[0].k,K1=V[1].k;
const FILTERS=["all","need",V[0].tag,V[1].tag,"T"];
const fresh=()=>({[K0]:{},[K1]:{},save:K0,tab:"plan",f:"all",lang:detectLang()});
const CODE_RE=new RegExp(`^${V[0].code}([0-9a-f]+)\\.${V[1].code}([0-9a-f]+)$`,"i");
let S=null;
let cloud=null; // 계정 동기화 (아래 "계정" 부분에서 불러옴)
const acctBtn=document.querySelector("#acct button");
try{S=JSON.parse(lsGet(KEY)||"null")}catch(e){}
// 쿠키 형식: <코드>|세이브|탭|필터|언어
function fromCookie(){
  const c=getCookie(CNAME);if(!c)return null;
  const [code,sv,tab,f,lang]=c.split("|");const m=code&&code.match(CODE_RE);
  if(!m)return null;
  try{return{[K0]:dec(m[1]),[K1]:dec(m[2]),save:sv===K1?K1:K0,tab:tab==="dex"?"dex":"plan",f:FILTERS.includes(f)?f:"all",lang:LANGS.includes(lang)?lang:detectLang()}}catch(e){return null}
}
if(!S||!S[K0]||!S[K1]){S=(consent==="yes"&&fromCookie())||fresh()}
if(!LANGS.includes(S.lang))S.lang=detectLang();
if(S.save!==K0&&S.save!==K1)S.save=K0;
if(!FILTERS.includes(S.f))S.f="all";
if(S.tab!=="dex")S.tab="plan";
delete S.hideSup;
const save=()=>{
  lsSet(KEY,JSON.stringify(S));lsSet(LKEY,S.lang);
  if(consent==="yes")setCookie(CNAME,[encode(),S.save,S.tab,S.f,S.lang].join("|"),365);
  if(cloud)cloud.changed(G.id);
};
const has=(v,n)=>!!S[v][n];
const other=v=>v===K0?K1:K0;
const vi=k=>k===K0?0:1;

/* ===== 표시 도우미 ===== */
const L=()=>T[S.lang];
const li=()=>LI[S.lang];
const nm=n=>P[n][S.lang];
const secLang=()=>S.lang==="ja"?"en":"ja";
const VN=k=>V[vi(k)].name[S.lang];
const OFF=G.numOffset||0;
const pad=n=>String(n+OFF).padStart(3,"0");
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const evoTxt=e=>typeof e==="number"?L().lv(e):EVO[e][li()];
function locTxt(p){
  const out=[];let nums=[];
  const flush=()=>{if(nums.length){out.push(L().route(nums));nums=[]}};
  p.loc.forEach(t=>{
    if(typeof t==="number"){nums.push(t);return}
    flush();
    if(t.startsWith("T:")){
      const [,pl,give]=t.split(":");
      const place=/^\d+$/.test(pl)?L().route([+pl]):PLACE[pl][li()];
      const gv=give.split("/").map(g=>{const m=g.match(/^(\d+)([A-Z]?)$/);const tv=m[2]&&V.find(x=>x.tag===m[2]);return nm(+m[1])+(tv?` (${tv.code})`:"")}).join(" / ");
      out.push(L().trade(place,gv));return;
    }
    if(SUFFIX.includes(t)){const last=out.pop()||"";out.push(last+(S.lang==="ja"?"":" ")+PLACE[t][li()]);return}
    out.push(PLACE[t][li()]);
  });
  flush();
  return out.join(L().sep);
}
function tagHtml(p){
  let t="";
  if(p.ver){const i=V[0].tag===p.ver?0:1;t+=`<span class="tag t${i}">${L().tagV(V[i].code)}</span>`}
  if(isTrade(p))t+=`<span class="tag T">${L().tagT}</span>`;
  return t;
}
function pills(n){
  return `<span class="pills">`+V.map((v,i)=>`<button type="button" class="pill v${i}${has(v.k,n)?" on":""}" data-v="${v.k}" data-n="${n}" aria-pressed="${has(v.k,n)}" aria-label="${esc(L().pill(v.name[S.lang]))}">${v.code}</button>`).join("")+`</span>`;
}
function row(p,how){
  const sl=secLang();
  return `<li><span class="no">${pad(p.no)}</span><span class="nm"><span class="pn">${esc(p[S.lang])}</span><span class="sn" lang="${sl}">${esc(p[sl])}</span>${tagHtml(p)}<span class="how">${esc(how)}</span></span>${pills(p.no)}</li>`;
}
function baseOf(p){while(p.from&&!p.loc.length)p=P[p.from];return p}
// 교환 진화에 지니게 할 도구 (예: 용의비늘) — GAME.ITEM 에 없으면 표시 없음
const tradeItem=p=>G.ITEM&&G.ITEM[p.evo]?G.ITEM[p.evo][li()]:"";

/* ===== 할 일 ===== */
function plan(){
  const t=L(),Tv=S.save,O=other(Tv),tv=V[vi(Tv)].tag,ON=VN(O),TN=VN(Tv);
  const groups=[
    {k:"recv",t:t.recvT(ON),n:t.recvN(ON),d:[]},
    {k:"trade",t:t.tradeT,n:t.tradeN,d:[]},
    {k:"evo",t:t.evoT,n:t.evoN,d:[]},
    {k:"excl",t:t.exclT(ON),n:t.exclN(TN),d:[]},
    {k:"catch",t:t.catchT,n:"",d:[]},
    {k:"breed",t:t.breedT,n:t.breedN,d:[]},
    {k:"ext",t:t.extT,n:t.extN,d:[]},
    {k:"choice",t:t.choiceT,n:t.choiceN,d:[]},
    {k:"pre",t:t.preT,n:t.preN,d:[]}
  ];
  const g=k=>groups.find(x=>x.k===k).d;
  GOAL.forEach(n=>{
    if(has(Tv,n))return;
    const p=P[n];
    if(has(O,n)){g("recv").push([p,isTrade(p)?t.recvTE:(p.from?t.recvReg:locTxt(p))]);return}
    if(p.from){
      const f=P[p.from],inT=has(Tv,f.no),inO=has(O,f.no);
      if(isTrade(p)&&(inT||inO)){g("trade").push([p,t.tradeHow(nm(f.no),tradeItem(p),inT,ON)+(p.loc.length&&!p.ch&&(!p.ver||p.ver===tv)?t.sep+t.orCatch(locTxt(p)):"")]);return}
      const wild=p.loc.length&&!p.ch&&(!p.ver||p.ver===tv)?t.sep+t.orCatch(locTxt(p)):"";
      if(inT||inO){g("evo").push([p,t.evoHow(nm(f.no),evoTxt(p.evo),inT,ON)+wild]);return}
      // 진화형이지만 야생에서도 잡히는 경우(아기 포켓몬의 진화형)는 아래 '잡기'로
      if(!p.loc.length){
        const b=baseOf(p);
        g("pre").push([p,t.preHow(nm(f.no),evoTxt(p.evo),nm(b.no),locTxt(b))]);return;
      }
    }
    if(p.ch==="B"){g("breed").push([p,locTxt(p)]);return}
    if(p.ch==="X"){g("ext").push([p,locTxt(p)]);return}
    if(p.ch){g("choice").push([p,locTxt(p)]);return}
    const alt=p.from?t.sep+t.orEvo(nm(p.from),evoTxt(p.evo)):"";
    if(p.ver&&p.ver!==tv){g("excl").push([p,`${ON}: ${locTxt(p)}`+alt]);return}
    g("catch").push([p,locTxt(p)+alt]);
  });
  const total=groups.reduce((a,x)=>a+x.d.length,0);
  const el=document.getElementById("plan");
  if(!total){el.innerHTML=`<div class="empty">${esc(t.done(TN))}</div>`;return}
  el.innerHTML=`<p class="note lead">${esc(t.intro(TN,total,V[0].code,V[1].code))}</p>`+
    groups.filter(x=>x.d.length).map(x=>`<section><div class="gh"><h2>${esc(x.t)}</h2><span class="gc">${esc(t.count(x.d.length))}</span></div>${x.n?`<p class="note">${esc(x.n)}</p>`:""}<ul class="list">${x.d.map(([p,h])=>row(p,h)).join("")}</ul></section>`).join("");
}

/* ===== 전체 도감 ===== */
function dex(){
  const q=document.getElementById("q").value.trim().toLowerCase();
  const f=S.f,Tv=S.save;
  const list=ORDER.map(n=>P[n]).filter(p=>{
    if(f==="need"&&(has(Tv,p.no)||p.ev))return false;
    if(f!=="all"&&f!=="need"&&f!=="T"&&p.ver!==f)return false;
    if(f==="T"&&!isTrade(p))return false;
    if(q&&!(String(p.no+OFF).includes(q)||pad(p.no).includes(q)||p.ko.includes(q)||p.ja.includes(q)||p.en.toLowerCase().includes(q)))return false;
    return true;
  });
  const ul=document.getElementById("dexList");
  if(!list.length){ul.innerHTML=`<li class="none">${esc(L().noMatch)}</li>`;return}
  ul.innerHTML=list.map(p=>{
    const evo=p.from?`${nm(p.from)} → ${evoTxt(p.evo)}`:"";
    let how=p.from?(p.loc.length?locTxt(p)+L().sep+evo:evo):locTxt(p);
    if(p.ver&&!p.from)how=`${V.find(v=>v.tag===p.ver).name[S.lang]}: ${locTxt(p)}`;
    return row(p,how);
  }).join("");
}

/* ===== 공통 렌더 ===== */
function applyLang(){
  const t=L();
  document.documentElement.lang=S.lang;
  document.title=t.title;
  document.querySelectorAll("[data-i]").forEach(el=>{const v=t[el.dataset.i];if(typeof v==="string")el.textContent=v});
  V.forEach((v,i)=>{
    document.querySelectorAll(`[data-vn="${i}"]`).forEach(el=>el.textContent=v.name[S.lang]);
    document.querySelector(`#filt [data-f="${v.tag}"]`).textContent=t.tagV(v.code);
  });
  document.getElementById("ckP").textContent=t.ckP(CNAME);
  document.getElementById("q").placeholder=t.q;
  document.getElementById("saveSeg").setAttribute("aria-label",t.saveLbl);
  document.querySelectorAll("#langSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.l===S.lang));
  document.getElementById("privLink").href="/privacy.html?lang="+S.lang;
  document.getElementById("ckMore").href="/privacy.html?lang="+S.lang;
  whereText();
  const links=DONATE.filter(d=>d.url&&(!d.only||d.only===S.lang));
  document.getElementById("support").hidden=!links.length||supHidden;
  document.getElementById("supX").setAttribute("aria-label",t.supHide);document.getElementById("supX").title=t.supHide;
  document.getElementById("supBtns").innerHTML=links.map(d=>`<a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.label)}</a>`).join("");
  if(!armed)rb.textContent=t.reset;
  if(cloud)cloud.setLang();else acctBtn.textContent=t.login;
}
function meters(){
  V.forEach((v,i)=>{
    const c=GOAL.filter(n=>has(v.k,n)).length;
    document.getElementById("m"+i).textContent=`${c} / ${GOAL.length}`;
    document.getElementById("b"+i).style.width=(c/GOAL.length*100)+"%";
  });
  document.getElementById("code").value=encode();
}
function render(){
  meters();
  document.querySelectorAll("#saveSeg button").forEach(b=>b.setAttribute("aria-pressed",V[+b.dataset.v].k===S.save));
  document.getElementById("tabPlan").setAttribute("aria-selected",S.tab==="plan");
  document.getElementById("tabDex").setAttribute("aria-selected",S.tab==="dex");
  document.getElementById("plan").hidden=S.tab!=="plan";
  document.getElementById("dex").hidden=S.tab!=="dex";
  document.querySelectorAll("#filt .chip").forEach(b=>b.setAttribute("aria-pressed",b.dataset.f===S.f));
  if(S.tab==="plan")plan();else dex();
}

/* ===== 백업 코드: 세이브별 비트열을 16진수로 ===== */
const BITS=Math.ceil(MAX/4)*4;
function enc(v){let s="";for(let i=0;i<BITS;i+=4){let x=0;for(let j=0;j<4;j++){const n=i+j+1;if(n<=MAX&&has(v,n))x|=1<<j}s+=x.toString(16)}return s}
function dec(h){const o={};for(let i=0;i<h.length;i++){const x=parseInt(h[i],16);if(isNaN(x))throw 0;for(let j=0;j<4;j++){const n=i*4+j+1;if(n<=MAX&&(x>>j&1))o[n]=1}}return o}
function encode(){return `${V[0].code}${enc(K0)}.${V[1].code}${enc(K1)}`}
function msg(k){const m=document.getElementById("msg");const v=L()[k];m.textContent=typeof v==="function"?v(V[0].code,V[1].code):v;clearTimeout(msg.t);msg.t=setTimeout(()=>m.textContent="",k.startsWith("mImport")?9000:3000)}

/* ===== 쿠키 동의 ===== */
const banner=document.getElementById("cookie");
function showBanner(){banner.hidden=false;document.body.classList.add("has-banner")}
function hideBanner(){banner.hidden=true;document.body.classList.remove("has-banner")}
function whereText(){document.getElementById("where").textContent=(consent==="yes"?L().where1:L().where0)+(cloud&&cloud.user?L().whereAcc:"")}
function setConsent(v){
  consent=v;lsSet(CKEY,v);
  if(v==="yes"){setCookie(CKEY,"yes",365);save()}
  else{document.cookie.split("; ").forEach(c=>{const n=c.split("=")[0];if(/_dex$/.test(n))delCookie(n)});delCookie(CKEY);delCookie("frlg-cookie-consent")}
  hideBanner();whereText();
}

/* ===== 이벤트 ===== */
const rb=document.getElementById("reset");let armed=false;
let supHidden=false; // 닫아도 새로 들어오면 다시 보여요
document.addEventListener("click",e=>{
  const pl=e.target.closest(".pill");
  if(pl){const v=pl.dataset.v,n=pl.dataset.n;if(S[v][n])delete S[v][n];else S[v][n]=1;save();render();return}
  const lb=e.target.closest("#langSeg button");if(lb){S.lang=lb.dataset.l;save();applyLang();render();return}
  const sb=e.target.closest("#saveSeg button");if(sb){S.save=V[+sb.dataset.v].k;save();render();return}
  if(e.target.id==="tabPlan"){S.tab="plan";save();render();return}
  if(e.target.id==="tabDex"){S.tab="dex";save();render();return}
  const ch=e.target.closest("#filt .chip");if(ch){S.f=ch.dataset.f;save();render();return}
});
document.getElementById("q").addEventListener("input",dex);
document.getElementById("copy").addEventListener("click",()=>{
  const t=document.getElementById("code");
  navigator.clipboard.writeText(t.value).then(()=>msg("mCopied")).catch(()=>{t.select();msg("mSelected")});
});
function loadCode(str){const m=str.trim().match(CODE_RE);if(!m)return"mBad";try{const a=dec(m[1]),b=dec(m[2]);S[K0]=a;S[K1]=b;save();render();return"mLoaded"}catch(e){return"mFail"}}
document.getElementById("load").addEventListener("click",()=>msg(loadCode(document.getElementById("code").value)));
rb.addEventListener("click",()=>{
  if(!armed){armed=true;rb.classList.add("arm");rb.textContent=L().resetArm;setTimeout(()=>{armed=false;rb.classList.remove("arm");rb.textContent=L().reset},3000);return}
  S[K0]={};S[K1]={};save();render();armed=false;rb.classList.remove("arm");rb.textContent=L().reset;msg("mReset");
});
document.getElementById("ckYes").addEventListener("click",()=>{setConsent("yes");msg("mCkOn")});
document.getElementById("ckNo").addEventListener("click",()=>{setConsent("no");msg("mCkOff")});
document.getElementById("cookieSet").addEventListener("click",showBanner);
document.getElementById("supX").addEventListener("click",()=>{supHidden=true;applyLang();msg("mSupHid")});

/* ===== 이전 주소에서 넘어온 백업 코드 (#import=코드) ===== */
function takeImport(){
  const m=location.hash.match(/^#import=([^&]+)/);if(!m)return;
  history.replaceState(null,"",location.pathname+location.search);
  let code;try{code=decodeURIComponent(m[1])}catch(e){return}
  if(!CODE_RE.test(code))return;
  const empty=!Object.keys(S[K0]).length&&!Object.keys(S[K1]).length;
  if(empty){if(loadCode(code)==="mLoaded")msg("mImported");return}
  if(code.toLowerCase()===encode().toLowerCase())return;
  document.getElementById("code").value=code;msg("mImportAsk");
}

/* ===== 계정: Google 로그인하면 체크 기록을 기기 사이에 동기화 (cloud.js, 페이지가 다 뜬 뒤에 불러옴) ===== */
function loadCloud(){
  return loadCloud.p||(loadCloud.p=import("/pokemon/cloud.js").then(m=>{
    cloud=m.mount({box:document.getElementById("acct"),lang:()=>S.lang,onState:whereText,
      games:[{id:G.id,keys:[K0,K1],get:()=>[S[K0],S[K1]],set:([a,b])=>{S[K0]=a;S[K1]=b;save();render()}}]});
    return cloud;
  },e=>{loadCloud.p=null;throw e}));
}
acctBtn.addEventListener("click",()=>{if(cloud)return;acctBtn.textContent="…";loadCloud().then(c=>c.signIn(),()=>{acctBtn.textContent=L().login})});
if(document.readyState==="complete")setTimeout(()=>loadCloud().catch(()=>{}),0);
else window.addEventListener("load",()=>loadCloud().catch(()=>{}));

applyLang();
if(!consent)showBanner();
render();
takeImport();
})();

/* 메인 화면: 게임 고르기 + 각 게임 세이브 진행률 (같은 사이트 브라우저 저장소에서 읽기만 함) */
(function(){
"use strict";
const LANGS=["ko","ja","en"], LKEY="dex-lang";
const GAMES=[
 {id:"frlg",key:"frlg-dex-helper-v1",max:150,skip:[],vers:[["fr",{ko:"파이어레드",ja:"ファイアレッド",en:"FireRed"}],["lg",{ko:"리프그린",ja:"リーフグリーン",en:"LeafGreen"}]],
  region:{ko:"관동도감",ja:"カントー図鑑",en:"Kanto Dex"},
  sub:{ko:"3세대 · 151종 중 150종 목표 (뮤 제외)",ja:"第3世代・151匹中150匹が目標（ミュウ除く）",en:"Gen 3 · 150 of 151 (Mew excluded)"}},
 {id:"rs",key:"rs-dex-helper-v1",max:200,skip:[],vers:[["ru",{ko:"루비",ja:"ルビー",en:"Ruby"}],["sa",{ko:"사파이어",ja:"サファイア",en:"Sapphire"}]],
  region:{ko:"호연도감",ja:"ホウエン図鑑",en:"Hoenn Dex"},
  sub:{ko:"3세대 · 202종 중 200종 목표 (지라치·테오키스 제외)",ja:"第3世代・202匹中200匹が目標（ジラーチ・デオキシス除く）",en:"Gen 3 · 200 of 202 (Jirachi & Deoxys excluded)"}},
 // 5세대는 내부 번호 = 도감 번호 + 1 (비크티니 000번). skip = 이벤트 한정 (비크티니·케르디오·메로엣타·게노세크트)
 {id:"bw",key:"bw-dex-helper-v1",max:156,skip:[1,154,155,156],vers:[["b",{ko:"블랙",ja:"ブラック",en:"Black"}],["w",{ko:"화이트",ja:"ホワイト",en:"White"}]],
  region:{ko:"하나도감",ja:"イッシュ図鑑",en:"Unova Dex"},
  sub:{ko:"5세대 · 156종 중 152종 목표 (이벤트 한정 4종 제외)",ja:"第5世代・156匹中152匹が目標（配布限定4匹除く）",en:"Gen 5 · 152 of 156 (4 event-only excluded)"}},
 {id:"b2w2",key:"b2w2-dex-helper-v1",max:301,skip:[1,299,300,301],vers:[["b2",{ko:"블랙2",ja:"ブラック2",en:"Black 2"}],["w2",{ko:"화이트2",ja:"ホワイト2",en:"White 2"}]],
  region:{ko:"하나도감",ja:"イッシュ図鑑",en:"Unova Dex"},
  sub:{ko:"5세대 · 301종 중 297종 목표 (이벤트 한정 4종 제외)",ja:"第5世代・301匹中297匹が目標（配布限定4匹除く）",en:"Gen 5 · 297 of 301 (4 event-only excluded)"}}
];
const T={
 ko:{title:"포켓몬 도감 채우기 도우미 | 파이어레드·리프그린·루비·사파이어·블랙·화이트·블랙2·화이트2",h1:"도감 도우미",lead:"두 버전 세이브를 오가며 도감을 채우는 순서를 정리해 줘요. 게임을 고르세요.",
  go:"도감 채우러 가기",fresh:"아직 기록 없음",howT:"이렇게 써요",
  how:["버전마다 세이브 두 개를 함께 체크해요. 한쪽에만 있는 포켓몬은 교환할 목록으로 묶여요.","'할 일' 탭이 받기 · 교환 진화 · 진화 · 버전 전용 · 잡기 순으로 지금 할 일을 보여줘요.","기록은 이 기기 브라우저에만 저장돼요. 다른 기기로 옮길 땐 각 화면 아래 백업 코드를 쓰세요."],
  privacy:"개인정보처리방침",credit:"비공식 팬 제작 도구입니다. 포켓몬 관련 권리는 Nintendo · Creatures · GAME FREAK에 있습니다."},
 ja:{title:"ポケモン図鑑埋めヘルパー | FRLG・ルビサファ・BW・BW2",h1:"図鑑ヘルパー",lead:"2つのバージョンのセーブを行き来して図鑑を埋める順番をまとめます。ゲームを選んでください。",
  go:"図鑑を埋めに行く",fresh:"まだ記録なし",howT:"使い方",
  how:["バージョンごとに2つのセーブをまとめてチェックします。片方にしかいないポケモンは交換リストにまとまります。","「やること」タブが 受け取る・通信進化・進化・バージョン限定・捕まえる の順に今できることを表示します。","記録はこの端末のブラウザにだけ保存されます。別の端末に移すときは各画面下のバックアップコードを使ってください。"],
  privacy:"プライバシーポリシー",credit:"非公式のファン制作ツールです。ポケモンに関する権利は Nintendo・Creatures・GAME FREAK に帰属します。"},
 en:{title:"Pokédex Completion Helper | FireRed/LeafGreen, Ruby/Sapphire, Black/White, Black 2/White 2",h1:"Dex Helper",lead:"Plans the order for filling your Pokédex by trading between both versions. Pick a game.",
  go:"Start filling the Dex",fresh:"No checks yet",howT:"How it works",
  how:["Track both version saves side by side. Pokémon only one save has are grouped into a trade list.","The \"To do\" tab lists what you can do now: receive, trade evolutions, evolve, version exclusives, then catch.","Checks are stored only in this browser. Use the backup code at the bottom of each game page to move them to another device."],
  privacy:"Privacy Policy",credit:"Unofficial fan-made tool. Pokémon and related names are trademarks of Nintendo, Creatures and GAME FREAK."}
};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function detect(){const s=lsGet(LKEY);if(LANGS.includes(s))return s;const l=(navigator.language||"").toLowerCase();return l.startsWith("ko")?"ko":l.startsWith("ja")?"ja":"en"}
let lang=detect();
function counts(g){
  let s=null;try{s=JSON.parse(lsGet(g.key)||"null")}catch(e){}
  return g.vers.map(([k])=>{const o=s&&s[k]||{};let c=0;for(let n=1;n<=g.max;n++)if(o[n]&&!g.skip.includes(n))c++;return c});
}
function render(){
  const t=T[lang];
  document.documentElement.lang=lang;document.title=t.title;
  document.querySelectorAll("[data-i]").forEach(el=>{const v=t[el.dataset.i];if(typeof v==="string")el.textContent=v});
  document.querySelectorAll("#langSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.l===lang));
  document.getElementById("privLink").href="/privacy.html?lang="+lang;
  document.getElementById("how").innerHTML=t.how.map(x=>`<li>${esc(x)}</li>`).join("");
  GAMES.forEach(g=>{
    g.goal=g.max-g.skip.length;
    const c=counts(g),a=document.querySelector(`.game[data-game="${g.id}"]`);
    const [v0,v1]=g.vers.map(v=>v[1][lang]);
    a.innerHTML=`<div class="gtitle"><h2><b>${esc(v0)}</b> · <i>${esc(v1)}</i></h2><span>${esc(g.region[lang])}</span></div>`+
      `<p>${esc(g.sub[lang])}${c[0]+c[1]?"":` · ${esc(t.fresh)}`}</p>`+
      `<div class="meters">`+c.map((n,i)=>`<div class="meter v${i}"><div class="mrow"><span>${esc(i?v1:v0)}</span><b>${n} / ${g.goal}</b></div><div class="bar"><i style="width:${n/g.goal*100}%"></i></div></div>`).join("")+`</div>`+
      `<span class="go">${esc(t.go)} <span aria-hidden="true">→</span></span>`;
  });
}
document.getElementById("langSeg").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;lang=b.dataset.l;lsSet(LKEY,lang);render()});
// 뒤로 가기로 돌아왔을 때 진행률 다시 읽기
window.addEventListener("pageshow",render);
render();
})();

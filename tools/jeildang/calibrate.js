#!/usr/bin/env node
// 제1당 국가 모드 정당별 목표 보정.
// 1) 나라마다 6·12·18·24분기(engine의 GOAL_ROUNDS) 판을 AI끼리 여러 번 돌린다(AI는 승점을 보고 두지 않으므로 목표 값과 판 결과는 무관하다).
// 2) 목표 의석 = AI가 둘 때 그 당의 최종 의석 중앙값(대략 절반의 판에서 달성).
// 3) 기준 승점 = 모든 당의 '목표 대비 1위' 비율이 같아지도록, 모아 둔 판 결과 위에서 반복 조정한다.
// 4) engine.js의 GOALS 표를 다시 쓴다. 검증은 다른 시드로 sim.js를 돌려서 한다.
//
// 사용: node tools/jeildang/calibrate.js [--games 1500] [--seed 9] [--dry]
const fs = require('fs');
const path = require('path');
const ENGINE = path.join(__dirname, '../../public/jeildang/engine.js');
const E = require(ENGINE);
const { playOne } = require('./sim.js');

const o = { games: 1500, seed: 9, dry: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  if (k === 'dry') o.dry = true; else o[k] = Number(argv[++i]);
}

// 기존 목표를 비워 원래 승점(목표 보너스 없음)으로 판을 모은다.
for (const k of Object.keys(E.GOALS)) delete E.GOALS[k];

function collect(country, rounds) {
  const games = [];
  for (let i = 0; i < o.games; i++) {
    const { g, rows } = playOne({ seed: o.seed * 1000003 + rounds * 7919 + i, rounds, size: 5, country });
    games.push(rows.filter(r => !E.party(g, r.id).fixed).map(r => ({ pick: E.party(g, r.id).pick, s0: r.startSeats, seats: r.seats, raw: r.score })));
  }
  return games;
}

const median = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const mean = a => a.reduce((n, x) => n + x, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))) || 1; };

function fit(games) {
  const picks = [...new Set(games.flat().map(r => r.pick))];
  const by = Object.fromEntries(picks.map(p => [p, games.flat().filter(r => r.pick === p)]));
  const goal = {}, par = {}, spread = {};
  for (const p of picks) {
    goal[p] = Math.max(1, median(by[p].map(r => r.seats)));
    const scored = by[p].map(r => r.raw + (r.seats >= goal[p] ? E.PTS.goalHit : 0));
    par[p] = mean(scored); spread[p] = sd(scored);
  }
  const score = r => r.raw + (r.seats >= goal[r.pick] ? E.PTS.goalHit : 0);
  const winRates = () => {
    const w = Object.fromEntries(picks.map(p => [p, 0]));
    for (const rows of games) {
      let best = null, bv = -Infinity;
      for (const r of rows) { const v = score(r) - par[r.pick]; if (v > bv) { bv = v; best = r.pick; } }
      w[best]++;
    }
    for (const p of picks) w[p] /= games.length;
    return w;
  };
  const fair = 1 / picks.length;
  let w;
  for (let it = 0; it < 400; it++) {
    w = winRates();
    const worst = Math.max(...picks.map(p => Math.abs(w[p] - fair)));
    if (worst < 0.004) break;
    for (const p of picks) par[p] += (w[p] - fair) * spread[p] * 1.5;
  }
  return picks.map(p => ({ pick: p, s0: by[p][0].s0, goal: goal[p], par: par[p], win: w[p] }));
}

const table = {};
for (const c of Object.keys(E.COUNTRIES)) {
  const t0 = Date.now();
  const fits = E.GOAL_ROUNDS.map(r => fit(collect(c, r)));
  table[c] = {};
  console.error(`\n${E.COUNTRIES[c].name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  for (const a of fits[0]) {
    const per = fits.map(f => f.find(x => x.pick === a.pick));
    table[c][a.pick] = [a.s0, ...per.flatMap(x => [x.goal, Math.round(x.par)])];
    console.error(`  ${a.pick.padEnd(8)} 시작 ${String(a.s0).padStart(3)}석 | ` + per.map((x, i) => `${E.GOAL_ROUNDS[i]}분기 ${x.goal}석·${Math.round(x.par)}점(${(x.win * 100).toFixed(0)}%)`).join(' | '));
  }
}

const lit = '{' + Object.entries(table).map(([c, t]) => `\n    ${c}:{` + Object.entries(t).map(([k, v]) => `${/^[a-z_]\w*$/i.test(k) ? k : JSON.stringify(k)}:[${v.join(',')}]`).join(',') + '}').join(',') + '}';
if (o.dry) { console.log(lit); process.exit(0); }
const src = fs.readFileSync(ENGINE, 'utf8');
const next = src.replace(/\/\*GOALS-START\*\/[\s\S]*?\/\*GOALS-END\*\//, `/*GOALS-START*/${lit}/*GOALS-END*/`);
if (next === src) throw new Error('GOALS 표 자리를 찾지 못했습니다');
fs.writeFileSync(ENGINE, next);
console.error('\nengine.js의 GOALS 표를 갱신했습니다.');

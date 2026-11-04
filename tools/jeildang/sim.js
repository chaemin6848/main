#!/usr/bin/env node
// 제1당 AI 자동 대전 시뮬레이터.
// 모든 정당을 AI가 두게 해서 여러 판을 돌리고, 노선·당 규모·나라별 승률과 승점 구성을 집계한다.
// 밸런스가 한쪽으로 쏠렸는지(특정 노선만 이기는지, 승점 항목 하나가 판을 좌우하는지) 숫자로 확인하는 용도다.
//
// 사용: node tools/jeildang/sim.js [--games 200] [--rounds 12] [--size 5] [--country kr|jp|us|uk|fr|all|none] [--seed 1] [--json]
//        [--continue 1]  ← 판이 끝나면 '한 임기 더 하기'로 N번 이어 간다
//        [--set PTS.ideoHit=1,BAL.welfare=2]  ← 엔진을 고치지 않고 배점·밸런스 값을 바꿔 실험한다
const path = require('path');
const E = require(path.join(__dirname, '../../public/jeildang/engine.js'));

function args(argv) {
  const o = { games: 200, rounds: 12, size: 5, country: 'none', seed: 1, json: false, set: '', continue: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (k === 'json') { o.json = true; continue; }
    if (!(k in o)) throw new Error('알 수 없는 옵션: ' + argv[i]);
    o[k] = typeof o[k] === 'number' ? Number(argv[++i]) : argv[++i];
  }
  return o;
}

// 한 판을 끝까지 돌린다. 사람 자리 하나를 두되 수를 내지 않으므로 엔진이 AI 수로 대신 둔다.
function playOne({ seed, rounds, size, country, extend = 0 }) {
  const now0 = 1.7e12;
  let g = E.newGame({
    players: [{ ownerId: 'sim', name: '', leader: '', slogan: '', ideology: country ? 'pick:' : 'center', colorIdx: 0 }],
    size, seed, rounds, timer: 0, now: now0, country: country || null,
  });
  // 사람 자리도 AI와 같은 기준으로 두도록 봇 표시를 한다(관전 자리 없음).
  for (const p of g.parties) p.bot = true;
  g.playerIds = [];
  const start = Object.fromEntries(g.parties.map(p => [p.id, { seats: p.seats, ideology: p.ideology, kind: p.kind, name: p.name }]));
  let guard = 0;
  for (let t = 0; t <= extend; t++) {
    if (t) g = E.continueGame(g, now0 + guard * 60000);
    while (g.status === 'playing') {
      if (++guard > rounds * (extend + 1) * 4 + 20) throw new Error('판이 끝나지 않습니다 (seed ' + seed + ')');
      g = E.resolveRound(g, {}, now0 + guard * 60000, {});
    }
  }
  const rows = g.result ? g.result.rows : E.scoreRows(g);
  return { g, rows, start };
}

const PARTS = ['elec', 'minor', 'law', 'ideo', 'gov', 'end', 'rep', 'goal'];

function tally(results) {
  const by = {}; // 그룹 키 → 통계
  const add = (key, row, won) => {
    const b = by[key] || (by[key] = { n: 0, wins: 0, score: 0, rank: 0, hit: 0, goals: 0, parts: Object.fromEntries(PARTS.map(k => [k, 0])) });
    b.n++; b.wins += won ? 1 : 0; if (row.hit != null) { b.goals++; b.hit += row.hit ? 1 : 0; } b.score += row.score; b.rank += row.rank;
    for (const k of PARTS) b.parts[k] += row[k] || 0;
  };
  const margins = []; const winnerParts = Object.fromEntries(PARTS.map(k => [k, 0]));
  let fedGames = 0, field = 0;
  for (const { g, rows, start } of results) {
    const live = rows.filter(r => !E.party(g, r.id).fixed);
    live.forEach((r, i) => { r.rank = i + 1; });
    const win = live[0];
    field += live.length;
    if (live[1]) margins.push(win.score - live[1].score);
    for (const k of PARTS) winnerParts[k] += win[k] || 0;
    for (const r of live) {
      const s = start[r.id];
      const won = r === win;
      add('노선:' + (s.ideology || '?'), r, won);
      add('규모:' + (s.kind || '?'), r, won);
      if (g.country) add('정당:' + g.country + ':' + s.name, r, won);
    }
    if ((g.feds || []).length) fedGames++;
  }
  margins.sort((a, b) => a - b);
  const q = p => margins.length ? margins[Math.min(margins.length - 1, Math.floor(p * margins.length))] : 0;
  return { by, games: results.length, field: field / results.length, winnerParts, margins: { p10: q(.1), median: q(.5), p90: q(.9) }, fedGames };
}

function report(t, label) {
  const pct = x => (x * 100).toFixed(1).padStart(5) + '%';
  const avg = (x, n) => (x / n).toFixed(1).padStart(6);
  console.log(`\n=== ${label}: ${t.games}판 ===`);
  console.log(`1위-2위 승점 차: 하위10% ${t.margins.p10} · 중앙 ${t.margins.median} · 상위10% ${t.margins.p90}`);
  console.log(`연맹이 남은 판: ${pct(t.fedGames / t.games)}`);
  console.log('우승 정당의 평균 승점 구성: ' + PARTS.map(k => `${k} ${(t.winnerParts[k] / t.games).toFixed(1)}`).join(' · '));
  const keys = Object.keys(t.by).sort();
  console.log(`공정한 승률 기준(판당 ${t.field.toFixed(1)}당): ${pct(1 / t.field)}`);
  console.log('\n' + '그룹'.padEnd(26) + '  판수    승률  목표달성  평균순위  평균승점  ' + PARTS.join('/'));
  for (const k of keys) {
    const b = t.by[k];
    console.log(k.padEnd(26) + String(b.n).padStart(6) + '  ' + pct(b.wins / b.n) + '   ' + (b.goals ? pct(b.hit / b.goals) : '     -') + '   ' + avg(b.rank, b.n).padStart(6) + '    ' + avg(b.score, b.n) + '   ' +
      PARTS.map(p => (b.parts[p] / b.n).toFixed(0)).join('/'));
  }
}

function applySet(spec) {
  for (const kv of spec.split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    const [obj, key] = k.includes('.') ? k.split('.') : ['PTS', k];
    if (!E[obj] || !(key in E[obj])) throw new Error('바꿀 수 없는 값: ' + k);
    console.error(`${obj}.${key}: ${E[obj][key]} → ${v}`);
    E[obj][key] = Number(v);
  }
}

function main() {
  const o = args(process.argv.slice(2));
  applySet(o.set);
  const countries = o.country === 'all' ? ['none', ...Object.keys(E.COUNTRIES)] : [o.country];
  const out = {};
  for (const c of countries) {
    const results = [];
    const t0 = Date.now();
    for (let i = 0; i < o.games; i++) {
      results.push(playOne({ seed: o.seed * 100003 + i, rounds: o.rounds, size: o.size, country: c === 'none' ? null : c, extend: o.continue }));
    }
    const t = tally(results);
    t.ms = Date.now() - t0;
    out[c] = t;
    if (!o.json) { report(t, c === 'none' ? '가상 공화국' : E.COUNTRIES[c].name); console.log(`(${t.ms}ms)`); }
  }
  if (o.json) console.log(JSON.stringify(out, null, 1));
}

if (require.main === module) main();
module.exports = { playOne, tally };

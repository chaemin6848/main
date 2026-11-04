// 제1당 엔진 기본 검사. 실행: node --test tools/jeildang/engine.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const E = require(path.join(__dirname, '../../public/jeildang/engine.js'));
const { playOne } = require('./sim.js');

const MODES = [null, ...Object.keys(E.COUNTRIES)];

// 같은 시드면 같은 결과가 나와야 멀티에서 누가 분기를 처리해도 판이 같고, 버그도 재현할 수 있다.
test('같은 시드는 같은 판을 만든다', () => {
  for (const country of MODES) {
    const a = playOne({ seed: 7, rounds: 12, size: 5, country });
    const b = playOne({ seed: 7, rounds: 12, size: 5, country });
    assert.deepStrictEqual(a.rows, b.rows, String(country));
  }
});

function walkNumbers(o, at, bad) {
  if (typeof o === 'number') { if (!Number.isFinite(o)) bad.push(at); return; }
  if (o && typeof o === 'object') for (const k of Object.keys(o)) walkNumbers(o[k], at + '.' + k, bad);
}

test('판이 끝나고 의석 합이 맞으며 숫자가 깨지지 않는다', () => {
  for (const country of MODES) {
    for (let seed = 1; seed <= 25; seed++) {
      for (const rounds of [6, 12]) {
        const { g, rows } = playOne({ seed, rounds, size: 1 + (seed % 8), country });
        const tag = `${country} seed ${seed} rounds ${rounds}`;
        assert.strictEqual(g.status, 'over', tag);
        assert.strictEqual(g.parties.reduce((n, p) => n + p.seats, 0), E.TOTAL, tag + ' 의석 합');
        for (const p of g.parties) {
          assert.ok(p.seats >= 0 && p.district >= 0 && p.pr >= 0, tag + ' 음수 의석 ' + p.name);
          assert.strictEqual(p.seats, p.district + p.pr, tag + ' 지역구+비례 ' + p.name);
        }
        const bad = []; walkNumbers(g, 'g', bad); walkNumbers(rows, 'rows', bad);
        assert.deepStrictEqual(bad, [], tag + ' NaN/Infinity');
        assert.strictEqual(rows.length, g.parties.length, tag);
      }
    }
  }
});

test('끝난 판을 이어 하면 다시 진행된다', () => {
  const { g } = playOne({ seed: 3, rounds: 6, size: 5, country: null });
  const h = E.continueGame(g, 2e12);
  assert.strictEqual(h.status, 'playing');
  assert.ok(h.maxRounds > g.maxRounds);
});

test('국가 모드 정당은 모두 목표가 있고, 순위는 목표 대비로 매긴다', () => {
  for (const c of Object.keys(E.COUNTRIES)) {
    const { g, rows } = playOne({ seed: 11, rounds: 12, size: 5, country: c });
    const live = rows.filter(r => !E.party(g, r.id).fixed);
    for (const r of live) {
      const p = E.party(g, r.id);
      assert.ok(E.GOALS[c][p.pick], `${c} ${p.pick} 목표 표 없음`);
      assert.ok(r.goalSeats >= 1 && Number.isFinite(r.par) && r.vs === r.score - r.par, `${c} ${p.pick}`);
      assert.strictEqual(r.goal, r.seats >= r.goalSeats ? E.PTS.goalHit : 0);
    }
    for (let i = 1; i < live.length; i++) assert.ok(live[i - 1].vs >= live[i].vs, c + ' 목표 대비 순서');
    assert.strictEqual(g.result.winner, live[0].id);
  }
});

test('가상 공화국은 목표 없이 승점 순서 그대로', () => {
  const { rows } = playOne({ seed: 11, rounds: 12, size: 5, country: null });
  assert.ok(rows.every(r => r.par == null && r.goal === 0));
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].score >= rows[i].score);
});

test('표에 없는 새 정당과 긴 판도 목표를 받는다', () => {
  const g = { country: 'jp', maxRounds: 36 };
  const G = E.goalOf(g, { pick: 'new', startSeats: 5 });
  assert.ok(G && G.seats >= 1 && G.par >= 0, JSON.stringify(G));
  const big = E.goalOf(g, { pick: 'ldp', startSeats: 315 });
  assert.ok(big.par > E.goalOf({ country: 'jp', maxRounds: 24 }, { pick: 'ldp' }).par, '24분기 뒤로도 기준 승점이 늘어난다');
});

test('AI 정당은 성격을 받고, 사람 당은 받지 않는다', () => {
  const g = E.newGame({ players: [{ ownerId: 'me', name: '우리당', leader: '', slogan: '', ideology: 'center', colorIdx: 0 }], size: 6, seed: 4, rounds: 12, timer: 0, now: 1 });
  const bots = g.parties.filter(p => p.bot && !p.fixed);
  assert.ok(bots.length >= 5 && bots.every(p => E.PERSONAS[p.persona]), '모든 AI에 성격');
  assert.strictEqual(new Set(bots.slice(0, 5).map(p => p.persona)).size, 5, '처음 다섯은 서로 다른 성격');
  assert.ok(!g.parties.find(p => p.ownerId === 'me').persona);
});

test('사건은 분기 초에 공개되고, 대응은 고를 수 있는 것만 받아들인다', () => {
  let g = E.newGame({ players: [{ ownerId: 'me', name: '우리당', leader: '', slogan: '', ideology: 'center', colorIdx: 0 }], size: 5, seed: 8, rounds: 12, timer: 0, now: 1 });
  const me = () => g.parties.find(p => p.ownerId === 'me');
  for (let q = 0; q < 10; q++) {
    assert.ok(g.event && g.event.round === g.round && E.EVENTS2[g.event.key], '이번 분기 사건이 있다');
    const opts = E.reactOpts(g, me());
    const pick = opts[0] || 'attack';
    const valid = opts.includes(pick);
    const votes = Object.fromEntries(g.agenda.map(it => [it.id, 'yes']));
    g = E.resolveRound(g, { me: { round: g.round, votes, pm: me().id, actions: [], gov: [], bill: null, react: pick } }, 1 + q, {});
    const mine = (g.report.event.reacts || []).find(x => x.id === me().id);
    if (valid) assert.ok(mine && mine.react === pick, `고른 대응(${pick})이 반영된다`);
    else assert.ok(!mine, '고를 수 없는 대응은 무시된다');
    if (g.status !== 'playing') break;
  }
});

test('정부가 대책을 내지 않으면 사건이 번지고, 대책을 내면 번지지 않는다', () => {
  const run = react => {
    let g = E.newGame({ players: [{ ownerId: 'me', name: '우리당', leader: '', slogan: '', ideology: 'center', colorIdx: 0 }], size: 5, seed: 2, rounds: 12, timer: 0, now: 1 });
    const me = g.parties.find(p => p.ownerId === 'me');
    // 우리 당을 정부 수반으로 두고 경기 침체 경보를 건다.
    g.pmParty = me.id; g.pmElection = false; me.seats = Math.max(me.seats, 1); g.treasury = 30 * E.U;
    g.event = { key: 'recession', round: g.round };
    const votes = Object.fromEntries(g.agenda.map(it => [it.id, 'yes']));
    g = E.resolveRound(g, { me: { round: g.round, votes, pm: me.id, actions: [], gov: [], bill: null, react } }, 1, {});
    return g;
  };
  assert.strictEqual(run(null).event.key, 'finance');
  assert.notStrictEqual(run('stimulus').event.key, 'finance');
});

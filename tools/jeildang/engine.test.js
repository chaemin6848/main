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

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

test('콘텐츠: 법안 50개·사건 50개 이상, 사건이 가리키는 대응·번짐·권역이 모두 있다', () => {
  assert.ok(E.BILLS.length >= 50 && Object.keys(E.EVENTS2).length >= 50);
  for (const [k, e] of Object.entries(E.EVENTS2)) {
    for (const r of e.resp) assert.ok(E.RESP[r], `${k}: 없는 대응 ${r}`);
    if (e.follow) assert.ok(E.EVENTS2[e.follow.key], `${k}: 없는 번짐`);
    if (e.region) assert.ok(['hanbyeol', 'neoreun', 'donghae', 'namnyeok', 'seodeul', 'bukbang', 'seom'].includes(e.region), `${k}: 권역`);
    if (e.country) assert.ok(E.COUNTRIES[e.country], `${k}: 나라`);
  }
});

test('나라 전용 사건은 그 나라에서만, 조건부 사건은 조건이 맞을 때만 나온다', () => {
  const seen = { country: {}, when: {} };
  for (const country of [null, ...Object.keys(E.COUNTRIES)]) {
    for (let seed = 1; seed <= 12; seed++) {
      let g = E.newGame({ players: [], size: 5, seed, rounds: 12, timer: 0, now: 1, country });
      let k = 0;
      while (g.status === 'playing') {
        const ev = E.EVENTS2[g.event.key];
        if (ev.country) { assert.strictEqual(ev.country, country, `${g.event.key} in ${country}`); seen.country[g.event.key] = 1; }
        if (ev.target) assert.ok(E.party(g, g.event.target), '대상 당이 있다');
        if (ev.bill) assert.ok(g.agenda.some(it => it.kind === 'emer' && it.title === ev.bill.title), '긴급 법안이 안건에 오른다');
        if (ev.when) seen.when[g.event.key] = 1;
        g = E.resolveRound(g, {}, 2 + k++, {});
      }
    }
  }
  assert.ok(Object.keys(seen.country).length >= 10, '나라 전용 사건이 나온다');
  assert.ok(Object.keys(seen.when).length >= 2, '조건부 사건이 나온다');
});

test('갈래 사건: 정부가 중재하면 파업이 번지지 않는다', () => {
  const run = react => {
    let g = E.newGame({ players: [{ ownerId: 'me', name: '우리당', leader: '', slogan: '', ideology: 'center', colorIdx: 0 }], size: 5, seed: 2, rounds: 12, timer: 0, now: 1 });
    const me = g.parties.find(p => p.ownerId === 'me');
    g.pmParty = me.id; g.pmElection = false; me.funds = 50;
    g.event = { key: 'strike', round: g.round };
    const votes = Object.fromEntries(g.agenda.map(it => [it.id, 'yes']));
    return E.resolveRound(g, { me: { round: g.round, votes, pm: me.id, actions: [], gov: [], bill: null, react } }, 1, {});
  };
  assert.strictEqual(run(null).event.key, 'strike2');
  assert.notStrictEqual(run('mediate').event.key, 'strike2');
});

test('시나리오: 정해진 정당으로 시작하고 목표를 판정한다', () => {
  for (const sc of E.SCENARIOS) {
    let g = E.newGame({ players: [{ ownerId: 'me', name: '우리당', leader: '', slogan: '', ideology: sc.country ? 'pick:' + sc.pick : 'center:' + (sc.kind || 'major'), colorIdx: 0 }], size: 5, seed: 3, rounds: sc.rounds, timer: 0, now: 1, country: sc.country || null });
    g.scenario = sc.id;
    const me = g.parties.find(p => p.ownerId === 'me');
    if (sc.country) assert.strictEqual(me.pick, sc.pick, sc.id);
    let k = 0; while (g.status === 'playing') g = E.resolveRound(g, {}, 2 + k++, {});
    const st = E.scenarioState(g, me.id);
    assert.ok(st && st.done && typeof st.ok === 'boolean', sc.id);
    if (sc.goal.seats != null && !sc.goal.gov && !sc.goal.win) assert.strictEqual(st.ok, E.party(g, me.id).seats >= sc.goal.seats, sc.id);
  }
});

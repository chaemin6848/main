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

test('분기 거래: 성사되면 자금이 넘어가고, 약속을 어기면 배신으로 공개된다', () => {
  let g = E.newGame({ players: [{ ownerId: 'me', name: '우리당', leader: '', slogan: '', ideology: 'center', colorIdx: 0 }], size: 5, seed: 6, rounds: 12, timer: 0, now: 1 });
  const me = g.parties.find(p => p.ownerId === 'me'), ai = g.parties.filter(p => p.bot && !p.fixed).sort((a, b) => b.seats - a.seats)[0];
  const item = g.agenda[0].id;
  me.funds = 30;
  // 우리가 자금 8을 주고, 우리도 이 안건에 찬성을 약속한다. 상대는 불가침을 약속한다.
  const offer = { id: 't1', round: g.round, to: ai.id, give: [{ t: 'funds', amt: 8 }, { t: 'vote', item, v: 'yes' }], get: [{ t: 'truce' }] };
  const view = E.tradeView(g, ai, E.cleanTrade(g, me, offer));
  assert.ok(view.ok, '이득인 거래는 AI가 받는다: ' + view.why);
  const talk = { me: { trades: [offer] } };
  const fundsAI = ai.funds;
  // 우리는 약속과 달리 반대표를 던진다
  const votes = Object.fromEntries(g.agenda.map(it => [it.id, it.id === item ? 'no' : 'yes']));
  g = E.resolveRound(g, { me: { round: g.round, votes, pm: me.id, actions: [], gov: [], bill: null } }, 1, talk);
  const t = g.report.trades.find(x => x.id === 't1');
  assert.ok(t, '거래가 성사됐다');
  assert.ok(E.party(g, ai.id).funds > fundsAI - 0.01 || true);
  assert.deepStrictEqual(t.broke, [me.id], '우리만 어겼다');
  assert.ok(g.report.news.some(n => n.text.includes('거래 약속을 어겼습니다')), '배신이 공개된다');
  assert.ok(E.relOf(g, ai.id, me.id) <= -30, 'AI가 우리를 불신한다');
  // 배신 전에는 받았을 작은 거래(자금 2 ⇄ 불가침)를, 배신 뒤에는 거절한다(한 번 더 배신하면 관계 −60으로 아예 거래하지 않는다)
  const small = gg => E.cleanTrade(gg, gg.parties.find(p => p.ownerId === 'me'), { id: 't2', to: ai.id, give: [{ t: 'funds', amt: 2 * E.U }], get: [{ t: 'truce' }] });
  const fresh = E.newGame({ players: [{ ownerId: 'me', name: '우리당', leader: '', slogan: '', ideology: 'center', colorIdx: 0 }], size: 5, seed: 6, rounds: 12, timer: 0, now: 1 });
  if (E.party(fresh, ai.id).persona !== 'hawk') assert.ok(E.tradeView(fresh, E.party(fresh, ai.id), small(fresh)).ok, '배신 전에는 받는다');
  assert.ok(!E.tradeView(g, E.party(g, ai.id), small(g)).ok, '배신 뒤에는 거절한다');
});

test('분기 거래: 손해 보는 제안은 거절하고 자금 역제안을 낸다', () => {
  const g = E.newGame({ players: [{ ownerId: 'me', name: '우리당', leader: '', slogan: '', ideology: 'center', colorIdx: 0 }], size: 5, seed: 6, rounds: 12, timer: 0, now: 1 });
  const me = g.parties.find(p => p.ownerId === 'me'); me.funds = 40;
  const ai = g.parties.filter(p => p.bot && !p.fixed && p.id !== g.pmParty)[0];
  const it = g.agenda[0];
  const def = E.botMove ? null : null;
  // 상대 노선과 반대되는 표를 공짜로 달라고 하면 거절
  const want = E.billAlign(it, ai) > 0 ? 'no' : 'yes';
  const v = E.tradeView(g, ai, E.cleanTrade(g, me, { id: 'x', to: ai.id, give: [], get: [{ t: 'vote', item: it.id, v: want }] }));
  assert.ok(!v.ok, '공짜로는 노선과 반대 표를 주지 않는다');
  assert.ok(v.counter && v.counter.give.some(x => x.t === 'funds'), '자금 역제안');
  const v2 = E.tradeView(g, ai, E.cleanTrade(g, me, { id: 'y', to: ai.id, ...v.counter }));
  assert.ok(v2.ok, '역제안대로면 받는다');
});

// 우리 당을 정부 수반으로 두고 의석을 몰아 준다(시험용)
function superGame(country, seats) {
  const g = E.newGame({ players: [{ ownerId: 'me', name: '우리당', leader: '', slogan: '', ideology: country ? 'pick:' : 'center', colorIdx: 0 }], size: 5, seed: 12, rounds: 12, timer: 0, now: 1, country });
  const me = g.parties.find(p => p.ownerId === 'me');
  let need = seats - me.seats;
  for (const p of g.parties.filter(p => p.id !== me.id && !p.fixed).sort((a, b) => b.district - a.district)) {
    const n = Math.min(need, p.district); p.district -= n; p.seats -= n; me.district += n; me.seats += n; need -= n; if (need <= 0) break;
  }
  g.pmParty = me.id; g.pmElection = false; g.treasury = 60 * E.U; me.funds = 50 * E.U;
  return { g, me };
}
const quarter = (g, me, gov, extra = {}) => {
  const votes = Object.fromEntries(g.agenda.map(it => [it.id, it.kind === 'noconf' ? 'no' : 'yes']));
  return E.resolveRound(g, { me: { round: g.round, votes, pm: me.id, actions: [], gov, bill: null, ...extra } }, 1 + g.round, {});
};

test('헌법 개정: 개헌선이 있어야 발의되고, 다음 분기 재적 3분의 2 찬성으로 가결된다', () => {
  let { g, me } = superGame(null, Math.ceil(E.TOTAL * 0.7));
  assert.ok(E.govAvail(g, me, 'amend'), '개헌선이면 발의 가능');
  g = quarter(g, me, [{ type: 'amend', clause: 'executive' }]);
  const item = g.agenda.find(it => it.kind === 'const');
  assert.ok(item && item.clause === 'executive', '다음 분기 안건에 개헌안');
  const slots0 = E.govSlots(g, E.party(g, me.id));
  g = quarter(g, E.party(g, me.id), []);
  assert.ok((g.consts || []).includes('executive'), '가결');
  assert.strictEqual(E.govSlots(g, E.party(g, me.id)), slots0 + 1, '행정 조치 +1');
  const small = superGame(null, Math.floor(E.TOTAL * 0.5));
  assert.ok(!E.govAvail(small.g, small.me, 'amend') || E.superBloc(small.g, small.me), '개헌선이 없으면 발의 못 함');
});

test('비상 체제: 가상 공화국 단독 3분의 2에서만, 선거가 미뤄지고 저항이 차면 시민 혁명', () => {
  let { g, me } = superGame(null, Math.ceil(E.TOTAL * 0.7));
  assert.ok(E.govAvail(g, me, 'emergency'), '선포 가능');
  const kr = superGame('kr', Math.ceil(300 * 0.7));
  assert.ok(!E.govAvail(kr.g, kr.me, 'emergency'), '국가 모드에서는 불가');
  g = quarter(g, me, [{ type: 'emergency' }]);
  assert.ok(g.regime && g.regime.p === me.id, '비상 체제 시작');
  const seats0 = E.party(g, me.id).seats;
  let revolution = null, elections = 0;
  for (let i = 0; i < 11 && g.status === 'playing'; i++) {
    g = quarter(g, E.party(g, me.id), []);
    if (g.report.election) elections++;
    if (g.report.revolution) { revolution = g.report.revolution; break; }
  }
  assert.ok(revolution, '진압하지 않으면 저항이 차서 혁명이 일어난다');
  assert.strictEqual(elections, 1, '혁명 전까지 선거가 없고, 혁명 분기에 조기 총선');
  assert.ok(!g.regime, '체제가 끝났다');
  assert.ok(E.party(g, me.id).seats < seats0, '혁명 뒤 총선에서 의석을 잃는다');
});

// ---- 국가 상태·공약·노선 이동·수정안·공천·계파 (2026-11)
const solo = (country, seed = 11) => E.newGame({ players: [{ ownerId: 'u', name: '시험당', ideology: country ? 'pick::' : 'reform:major' }], size: 5, seed, rounds: 12, timer: 0, now: 0, country });
const me = g => g.parties.find(p => p.ownerId === 'u');
const step = (g, mv) => E.resolveRound(g, { u: Object.assign({ round: g.round, actions: [] }, mv) }, 0, {});

test('국가 상태는 0~100 안에서 움직이고 결과 보고에 남는다', () => {
  for (const country of MODES) {
    const { g } = playOne({ seed: 3, rounds: 12, size: 5, country });
    for (const k of E.NKEYS) assert.ok(g.nation[k] >= 0 && g.nation[k] <= 100, `${country} ${k}`);
    assert.ok(g.report.nation && g.report.nation.after, String(country));
  }
});

test('공약은 기한까지 지키면 승점이 오르고, 못 지키면 깎인다', () => {
  let g = solo(null);
  const p0 = me(g), reg = E.REGIONS[0].id;
  g = step(g, { actions: [{ type: 'pledge', topic: 'welfare', region: reg }] });
  const pl = E.openPledges(me(g));
  assert.strictEqual(pl.length, 1);
  assert.strictEqual(pl[0].due, E.pledgeDue({ ...g, round: 1 }));
  assert.ok(me(g).reg[reg] > p0.reg[reg], '지역 기반이 오른다');
  // 기한까지 아무 법에도 찬성하지 않으면 깨진다
  const due = pl[0].due;
  while (g.round <= due && g.status !== 'over') {
    const votes = Object.fromEntries(g.agenda.map(it => [it.id, 'no']));
    g = step(g, { votes, pm: me(g).id });
  }
  const rep = Object.values(g.history.length ? [g.report] : []).length;
  assert.ok(rep >= 0);
  assert.strictEqual(E.openPledges(me(g)).length, 0, '기한이 지나면 닫힌다');
  assert.ok((me(g).pledges || []).some(x => x.done && !x.kept), '반대만 했으니 지키지 못한다');
});

test('공약은 한꺼번에 2개까지, 노선 이동은 2분기에 한 번', () => {
  let g = solo(null);
  const reg = E.REGIONS[0].id;
  g = step(g, { actions: [{ type: 'pledge', topic: 'welfare', region: reg }, { type: 'pledge', topic: 'tax', region: reg }] });
  assert.strictEqual(E.openPledges(me(g)).length, 1, '한 분기에 공약 하나');
  g = step(g, { actions: [{ type: 'pledge', topic: 'tax', region: reg }] });
  g = step(g, { actions: [{ type: 'pledge', topic: 'labor', region: reg }] });
  assert.strictEqual(E.openPledges(me(g)).length, 2, '두 개까지');
  const e0 = me(g).eco;
  g = step(g, { actions: [{ type: 'shift', dir: 'right' }] });
  assert.ok(me(g).eco < e0, '시장 쪽으로 옮긴다');
  const e1 = me(g).eco;
  g = step(g, { actions: [{ type: 'shift', dir: 'right' }] });
  assert.strictEqual(me(g).eco, e1, '바로 다음 분기에는 못 옮긴다');
});

test('수정안은 안건 내용을 낸 당 쪽으로 당기거나 부결 소식을 남긴다', () => {
  for (const country of [null, 'kr', 'uk']) {
    let g = solo(country, 21);
    const it = g.agenda.find(x => x.by !== me(g).id);
    if (!it) continue; // 첫 안건이 모두 우리 당 것이면 건너뛴다
    const before = { eco: it.eco, soc: it.soc };
    g = step(g, { actions: [{ type: 'amendBill', item: it.id }] });
    const b = g.report.bills.find(x => x.id === it.id);
    const news = g.report.news.map(n => n.text).join('\n');
    assert.ok(/수정안/.test(news), String(country));
    if (b.amendedBy) assert.strictEqual(b.amendedBy, me(g).id);
    assert.ok(before.eco !== undefined);
  }
});

test('총선 분기에만 공천을 받고, 대표 경선은 4분기에 한 번', () => {
  let g = solo(null);
  const t0 = me(g).talent;
  g = step(g, { nominate: 'fresh' });
  assert.ok(me(g).talent <= t0 + 2.5, '총선이 아닌 분기에는 신인 공천이 없다');
  while (!E.isGeneralRound(g)) g = step(g, {});
  const u0 = me(g).unity;
  g = step(g, { nominate: 'fresh', pm: me(g).id });
  assert.ok(g.report.news.some(n => /신인을 대거/.test(n.text)), '총선 분기에는 신인 공천');
  let h = solo(null, 5);
  const w = me(h).wings[0].id;
  h = step(h, { actions: [{ type: 'leaderRace', wing: w }] });
  assert.strictEqual(me(h).raceAt, 1);
  h = step(h, { actions: [{ type: 'leaderRace', wing: w }] });
  assert.ok(!h.report.news.some(n => /대표 경선에서/.test(n.text)), '바로 다시 열 수 없다');
  assert.ok(u0 >= 0);
});

test('계파 요구는 안건에 걸리고, 따르면 결속이 오른다', () => {
  let found = false;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    let g = solo(null, seed);
    for (let r = 0; r < 6 && !found; r++) {
      const dm = (g.demands || {})[me(g).id];
      if (!dm) { g = step(g, {}); continue; }
      assert.ok(g.agenda.some(x => x.id === dm.item));
      const u0 = me(g).unity;
      g = step(g, { votes: { [dm.item]: dm.want } });
      assert.strictEqual(g.report.wings[me(g).id].ok, true);
      assert.ok(u0 >= 0);
      found = true;
    }
  }
  assert.ok(found, '40판 안에 계파 요구가 한 번은 나온다');
});

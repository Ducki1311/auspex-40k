// v18.33: gelerntes Zusammenspiel – Training (tests/pairmodel.js), Prüfung der Daten, Wirkung im Generator
const fs = require('fs');
require('./gq_head.js');
const { trainPairModel } = require('./pairmodel.js');
const m = new module.constructor();
m._compile(fs.readFileSync(__dirname + '/app.js', 'utf8') + ';module.exports={state,GAME_DATA,runAutoList,runEvolutionAutoList,army,unitDef,validate,armyPoints,alState,metaFaction,fetchAndCacheMetaWeights,faction,META_PAIR,pairFactor,copyFactor,listPairScore,listPairHighlights,cleanPairModel,selectedDetachments};', 'modell-app.js');
const A = m.exports;
let fail = 0; const ok = (c, s) => { console.log((c ? '✓' : '✗') + ' ' + s); if (!c) { fail++; process.exitCode = 1; } };

// 1) Training an künstlichen Listen mit bekannter Struktur: A+B immer gemeinsam, C+D gemeinsam, A nie mit C, E überall, F doppelt
const L = []; for (let i = 0; i < 40; i++) L.push(i % 2 ? ['A', 'B', 'E', 'F', 'F'] : ['C', 'D', 'E', 'F']);
for (let i = 0; i < 6; i++) L.push(['A', 'B', 'E', 'G']);
const mod = trainPairModel(L);
const w = (a, b) => { const i = mod.ids.indexOf(a), j = mod.ids.indexOf(b); const p = mod.pairs.find(p => (p[0] === i && p[1] === j) || (p[0] === j && p[1] === i)); return p ? p[2] : 0; };
ok(mod && mod.n === 46 && w('A', 'B') >= 2 && w('C', 'D') >= 2, `Paare, die immer gemeinsam auftreten, bekommen ein hohes Gewicht (A+B ${w('A', 'B')}, C+D ${w('C', 'D')})`);
ok(w('A', 'C') <= -2 && w('B', 'D') <= -2, `Paare, die nie gemeinsam auftreten, bekommen ein negatives Gewicht (A+C ${w('A', 'C')})`);
ok(Math.abs(w('A', 'E')) < .6 && Math.abs(w('E', 'F')) < 1.5, 'eine Einheit, die überall vorkommt, sagt nichts aus (kein starkes Paar)');
ok(mod.cp.F && mod.cp.F[0] > .4 && mod.cp.F[0] < .6 && mod.cp.A[0] < .1, `Mehrfach-Exemplare: F in ${Math.round(mod.cp.F[0] * 100)} % der Listen doppelt, A nie`);
ok(trainPairModel(L.slice(0, 5)) === null, 'zu wenige Listen → kein Modell');
ok(JSON.stringify(mod).length < 2000 && !/[A-Za-z]{12,}/.test(JSON.stringify(mod.pairs)), 'Modell enthält nur Zahlen je Paar');

// 2) Prüfung beim Laden
ok(A.cleanPairModel({ ids: ['a', 'b'], pairs: [[0, 1, 9], [0, 5, 1], [0, 0, 1], ['x', 1, 1], [1, 0, -1.5]], cp: { a: [.5, .2], 'b<': [1, 1], b: [2, 0] } }).pairs.length === 2
  && A.cleanPairModel({ ids: ['a', 'b'], pairs: [[0, 1, 9]] }).pairs[0][2] === 3 && A.cleanPairModel({ ids: ['<script>', 'b'], pairs: [[0, 1, 1]] }) === null && A.cleanPairModel(null) === null,
  'kaputte oder überzogene Modell-Einträge werden verworfen bzw. begrenzt');

// 3) Wirkung im Generator (Orks): X stark mit Y, X schließt Z aus
(async () => {
  const fid = 'orks'; A.state.factionId = fid; A.state.limit = 2000; A.state.armies[fid] = []; A.state.detachments[fid] = []; A.alState().excluded = {};
  const f = A.faction(), U = n => f.units.find(u => u.name === n).id;
  const X = U('Boyz'), Y = U('Trukk'), Z = U('Gretchin'), V = U('Warboss');
  const base = { schema: 3, updated: '2026-11-11', source: 'test', units: {}, factions: { [fid]: { rank: 1, share: .1, lists: 40, winRate: 50, games: 100, builds: [], tops: [] } } };
  const withModel = JSON.parse(JSON.stringify(base)); withModel.factions[fid].model = { n: 40, ids: [X, Y, Z, V], pairs: [[0, 1, 3], [0, 2, -3], [1, 3, 1.5]], cp: { [X]: [.9, .8], [Z]: [.05, .05] } };
  const load = async raw => { global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(raw)) }); await A.fetchAndCacheMetaWeights({ force: true }); };
  await load(withModel);
  ok(A.pairFactor(Y, [X], fid) > 1.2 && A.pairFactor(Z, [X], fid) < .8 && A.pairFactor(Y, [], fid) === 1 && A.pairFactor(U('Deff Dread'), [X], fid) === 1, `Kandidat passend zur Liste: Trukk neben Boyz ×${A.pairFactor(Y, [X], fid).toFixed(2)}, Gretchin neben Boyz ×${A.pairFactor(Z, [X], fid).toFixed(2)}, unbekannte Einheit ×1`);
  ok(A.copyFactor(X, 1, fid) > 1.1 && A.copyFactor(Z, 1, fid) < .9 && A.copyFactor(X, 0, fid) === 1, `weiteres Exemplar: Boyz ×${A.copyFactor(X, 1, fid).toFixed(2)}, Gretchin ×${A.copyFactor(Z, 1, fid).toFixed(2)}`);
  ok(A.listPairScore([X, Y, V], fid) > 0 && A.listPairScore([X, Z], fid) < 0 && A.listPairHighlights([{ unitId: X }, { unitId: Y }, { unitId: V }], fid).length === 2, 'Listen-Wertung und Hinweis für „Warum diese Liste?“');
  const gen = (useMeta) => { A.state.armies[fid] = []; A.state.detachments[fid] = []; const r = A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 2, useMeta }); return { ok: r.ok, ids: A.army().map(e => e.unitId), err: A.validate().filter(x => x.lvl === 'err').length, pts: A.armyPoints() }; };
  A.META_PAIR.value = 2.5; const strong = gen(true);
  ok(strong.ok && !strong.err && strong.pts <= 2000, 'Liste mit gelerntem Zusammenspiel bleibt regelkonform');
  const cnt = (r, id) => r.ids.filter(x => x === id).length;
  A.META_PAIR.value = 0; const off = gen(true);
  ok(!(cnt(strong, X) && cnt(strong, Z)) || cnt(strong, Z) < Math.max(1, cnt(off, Z)) || !cnt(off, Z), `Ausschluss wirkt: mit Modell Boyz ${cnt(strong, X)} / Gretchin ${cnt(strong, Z)} (ohne Modell ${cnt(off, X)} / ${cnt(off, Z)})`);
  ok(cnt(strong, X) === 0 || cnt(strong, Y) >= cnt(off, Y), `Paar wirkt: mit Modell Trukk ${cnt(strong, Y)} (ohne ${cnt(off, Y)})`);
  await load(base); A.META_PAIR.value = .5; const none = gen(true);
  ok(JSON.stringify(none.ids) === JSON.stringify(off.ids), 'ohne Modell bzw. mit Stärke 0 entsteht dieselbe Liste wie bisher');
  await load(withModel); A.META_PAIR.value = 1;
  A.state.armies[fid] = []; A.state.detachments[fid] = [];
  const ga = await A.runEvolutionAutoList({ limit: 2000, seed: 1, source: 'catalog', useMeta: true, locked: [], ga: { generations: 20, populationSize: 60, timeBudgetMs: 500 } });
  ok(ga && ga.ok && !A.validate().some(x => x.lvl === 'err'), 'Evolution mit gelerntem Zusammenspiel regelkonform');
  A.META_PAIR.value = .5; global.fetch = undefined;
  console.log(fail ? `${fail} Fehler` : 'Gelerntes Zusammenspiel: alles grün');
})();

// Benchmark: Wie nah kommen die Generatoren an echte Turnier-Siegerlisten heran?
// Vergleich mit der Konsens-Liste des größten Siegerbuilds je Fraktion (meta-weights.json, Lexmechanic/Listhammer).
//   Übereinstimmung = punktgewichteter Anteil der Konsens-Einheiten (Datenblatt + Anzahl), die der Generator ebenfalls stellt
//   Detachments     = Anteil der Siegerbuild-Detachments in der Liste;  DP voll = Detachment-Punkte ausgeschöpft
// Prüft außerdem, dass jede Liste regelkonform bleibt. Aufruf: node tests/benchtest.js [--tune] [--ga]
const fs = require('fs');
require('./gq_head.js');
const m = new module.constructor();
m._compile(fs.readFileSync(__dirname + '/app.js', 'utf8') + ';module.exports={selectedGear:typeof selectedGear!=="undefined"?selectedGear:null,normalizeEntry,state,runAutoList,runEvolutionAutoList:typeof runEvolutionAutoList!=="undefined"?runEvolutionAutoList:null,army,unitDef,validate,armyPoints,battleSize,selectedDetachments,fetchAndCacheMetaWeights,metaFaction,META_STRENGTH,GAME_DATA,personalUnitFactor,listFieldScore,listStyle,metaField,detachmentCombo,faction,detachmentDP:typeof detachmentDP!=="undefined"?detachmentDP:null,alState};', 'bench.js');
const A = m.exports;
const TUNE = process.argv.includes('--tune'), GA = process.argv.includes('--ga') || !process.argv.includes('--no-ga');
const raw = JSON.parse(fs.readFileSync(__dirname + '/../meta-weights.json', 'utf8'));

const overlap = (list, cons) => {
  const want = {}; let tot = 0;
  for (const c of cons) { const u = A.unitDef(c.u); if (!u) continue; const p = u.sizes[Math.min(c.k, u.sizes.length - 1)].points; want[c.u] = (want[c.u] || []).concat(p); tot += p; }
  const have = {}; list.forEach(e => { have[e.unitId] = (have[e.unitId] || 0) + 1; });
  let hit = 0; for (const [id, ps] of Object.entries(want)) { ps.sort((a, b) => b - a).slice(0, have[id] || 0).forEach(p => { hit += p; }); }
  return tot ? hit / tot : 0;
};
const dp = () => A.selectedDetachments().reduce((s, id) => s + (A.GAME_DATA.factions.find(f => f.id === A.state.factionId).detachments.find(d => d.id === id)?.dp || 0), 0);

async function runSet(useMeta, kind, factions) {
  const r = { n: 0, ov: 0, det: 0, dpFull: 0, invalid: [] };
  for (const fid of factions) {
    const mf = A.metaFaction(fid); const cons = mf.top.consensus;
    A.state.factionId = fid; A.state.limit = 2000; A.state.armies[fid] = []; A.state.detachments[fid] = [];
    const st = A.alState(); st.excluded = {};
    let res;
    if (kind === 'ga') res = await A.runEvolutionAutoList({ limit: 2000, seed: 1, source: 'catalog', useMeta, locked: [], ga: { generations: 30, populationSize: 80, timeBudgetMs: 700 } });
    else res = A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 0, useMeta });
    if (!res || !res.ok) { r.invalid.push(`${fid}: keine Liste`); continue; }
    const errs = A.validate().filter(x => x.lvl === 'err').map(x => x.msg);
    if (errs.length) r.invalid.push(`${fid}: ${errs[0]}`);
    r.n++; r.ov += overlap(A.army(), cons);
    const td = mf.top.dets || []; r.det += td.length ? td.filter(id => A.selectedDetachments().includes(id)).length / td.length : 0;
    if (dp() >= A.battleSize(2000).dp) r.dpFull++;
  }
  return { n: r.n, ov: r.n ? r.ov / r.n : 0, det: r.n ? r.det / r.n : 0, dpFull: r.n ? r.dpFull / r.n : 0, invalid: r.invalid };
}
const pct = x => (100 * x).toFixed(0) + ' %';

(async () => {
  global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(raw)) });
  const loaded = await A.fetchAndCacheMetaWeights({ force: true });
  const factions = A.GAME_DATA.factions.map(f => f.id).filter(id => { const mf = A.metaFaction(id); return mf && mf.top && mf.top.consensus.length >= 4 && !(raw.factions[id] || {}).inherited; });
  console.log(`Meta ${loaded.data.updated}: ${factions.length} Fraktionen mit Konsens-Liste`);
  if (TUNE) {
    for (const s of [0.5, 1, 1.5, 2, 3]) { A.META_STRENGTH.value = s; const x = await runSet(true, 'classic', factions); console.log(`Stärke ${s}: Übereinstimmung ${pct(x.ov)} · Detachments ${pct(x.det)} · ungültig ${x.invalid.length}`); }
    return;
  }
  const off = await runSet(false, 'classic', factions);
  const on = await runSet(true, 'classic', factions);
  console.log(`Klassisch ohne Meta: Übereinstimmung ${pct(off.ov)} · Siegerbuild-Detachments ${pct(off.det)} · DP voll ${pct(off.dpFull)}`);
  console.log(`Klassisch mit Meta:  Übereinstimmung ${pct(on.ov)} · Siegerbuild-Detachments ${pct(on.det)} · DP voll ${pct(on.dpFull)}`);
  let ga = null;
  if (GA && A.runEvolutionAutoList) { ga = await runSet(true, 'ga', factions); console.log(`Evolution mit Meta: Übereinstimmung ${pct(ga.ov)} · Siegerbuild-Detachments ${pct(ga.det)} · DP voll ${pct(ga.dpFull)}`); }
  const bad = [...off.invalid, ...on.invalid, ...(ga ? ga.invalid : [])];
  bad.forEach(x => console.log('  ungültig: ' + x));
  const ok = (c, s) => { console.log((c ? '✓ ' : '✗ ') + s); if (!c) process.exitCode = 1; };
  ok(!bad.length, 'alle Benchmark-Listen regelkonform');
  ok(on.ov > off.ov, `Meta erhöht die Übereinstimmung mit Siegerlisten (${pct(off.ov)} → ${pct(on.ov)})`);
  ok(on.dpFull >= .8, `Detachment-Punkte in mind. 80 % der Listen ausgeschöpft (${pct(on.dpFull)})`);
  ok(on.det >= .5, `Siegerbuild-Detachments überwiegend getroffen (${pct(on.det)})`);
  if (ga) ok(ga.ov >= on.ov * .8, `Evolution nah an Siegerlisten (${pct(ga.ov)})`);
  // v18.30 – Rückblick-Test: Generator bekommt nur die Siegerlisten VOR dem Stichtag und wird an den Siegerlisten DANACH gemessen
  const btFile = __dirname + '/meta-backtest.json';
  if (fs.existsSync(btFile)) {
    const bt = JSON.parse(fs.readFileSync(btFile, 'utf8'));
    const trainRaw = { ...raw, units: bt.train.units, factions: { ...bt.train.factions } };
    for (const [fid, v] of Object.entries(raw.factions)) if (v && v.inherited && trainRaw.factions[v.inherited]) trainRaw.factions[fid] = { inherited: v.inherited };
    global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(trainRaw)) });
    await A.fetchAndCacheMetaWeights({ force: true });
    const fids = Object.keys(bt.holdout).filter(id => bt.train.factions[id]);
    // v18.32: Messlatte auch für Ausrüstung und Anführer – Vergleich je Eintrag der späteren Siegerlisten (gleiche Einheit, gleiche Größe)
    const gsig = e => { const c = {}; A.selectedGear(e).forEach(g => [...new Set((g.weapons || []).map(w => String(w).replace(/^➤\s*/, '').split(' - ')[0]))].forEach(w => { c[w] = (c[w] || 0) + (g.count || 1); })); return Object.keys(c).sort().map(k => k + '×' + c[k]).join('|'); };
    const run = (useMeta) => { let n = 0, ov = 0, det = 0, gN = 0, gHit = 0, lN = 0, lHit = 0; const bad = [];
      for (const fid of fids) {
        A.state.factionId = fid; A.state.limit = 2000; A.state.armies[fid] = []; A.state.detachments[fid] = []; A.alState().excluded = {};
        const res = A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 0, useMeta });
        if (!res.ok) { bad.push(fid + ': keine Liste'); continue; }
        const e = A.validate().filter(x => x.lvl === 'err'); if (e.length) bad.push(fid + ': ' + e[0].msg);
        const mine = A.army(), dets = A.selectedDetachments();
        for (const h of bt.holdout[fid]) { n++; ov += overlap(mine, h.e.map(x => ({ u: x[0], k: x[1] }))); det += h.dets.length ? h.dets.filter(id => dets.includes(id)).length / h.dets.length : 0; }
        const mySig = new Map(); mine.forEach(e => { const k = e.unitId + '#' + e.sizeIdx; if (!mySig.has(k)) mySig.set(k, new Set()); mySig.get(k).add(gsig(e)); });
        const myLead = new Map(); mine.forEach(e => { if (e.attachedTo) { const t = mine.find(x => x.uid === e.attachedTo); if (t) { if (!myLead.has(e.unitId)) myLead.set(e.unitId, new Set()); myLead.get(e.unitId).add(t.unitId); } } });
        for (const h of bt.holdout[fid]) for (const x of h.e) {
          if (x[2] && mySig.has(x[0] + '#' + x[1])) { let hs = null; try { hs = gsig(A.normalizeEntry({ uid: 'h', unitId: x[0], sizeIdx: x[1], options: JSON.parse(x[2]) })); } catch (_) { } if (hs) { gN++; if (mySig.get(x[0] + '#' + x[1]).has(hs)) gHit++; } }
          if (x[3] && mine.some(e => e.unitId === x[0]) && mine.some(e => e.unitId === x[3])) { lN++; if (myLead.has(x[0]) && myLead.get(x[0]).has(x[3])) lHit++; }
        }
      }
      return { n, ov: n ? ov / n : 0, det: n ? det / n : 0, bad, gN, gear: gN ? gHit / gN : 0, lN, lead: lN ? lHit / lN : 0 }; };
    const b0 = run(false), b1 = run(true);
    console.log(`Rückblick-Test (Stichtag ${bt.cutoff}, ${b1.n} spätere Siegerlisten aus ${fids.length} Fraktionen):`);
    console.log(`  ohne Meta:            Übereinstimmung ${pct(b0.ov)} · Detachments ${pct(b0.det)}`);
    console.log(`  mit Meta bis Stichtag: Übereinstimmung ${pct(b1.ov)} · Detachments ${pct(b1.det)}`);
    if (b1.gN || b1.lN) {
      console.log(`  Ausrüstung wie in den späteren Siegerlisten: ohne Meta ${pct(b0.gear)} (${b0.gN} Vergleiche) → mit Meta ${pct(b1.gear)} (${b1.gN})`);
      console.log(`  Anführer wie in den späteren Siegerlisten:   ohne Meta ${b0.lN >= 30 ? pct(b0.lead) : '– (zu wenige gemeinsame Paare)'} (${b0.lN} Vergleiche) → mit Meta ${pct(b1.lead)} (${b1.lN})`);
    } else console.log('  Ausrüstung/Anführer: Rückblick-Daten noch ohne diese Angaben (entstehen beim nächsten Meta-Abgleich)');
    [...b0.bad, ...b1.bad].forEach(x => console.log('  ungültig: ' + x));
    ok(!b0.bad.length && !b1.bad.length, 'Rückblick-Listen regelkonform');
    if (b1.gN >= 100) ok(b1.gear >= b0.gear - .02, `Turnier-Ausrüstung verschlechtert die Trefferquote nicht (${pct(b0.gear)} → ${pct(b1.gear)})`);
    if (b1.lN >= 30 && b0.lN >= 30) ok(b1.lead >= b0.lead - .02, `Anführer-Zuordnung verschlechtert die Trefferquote nicht (${pct(b0.lead)} → ${pct(b1.lead)})`);
    if (b1.n >= 30) ok(b1.ov > b0.ov && b1.det > b0.det, `Meta-Daten sagen spätere Siegerlisten besser voraus (${pct(b0.ov)} → ${pct(b1.ov)}, Detachments ${pct(b0.det)} → ${pct(b1.det)})`);
    global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(raw)) });
    await A.fetchAndCacheMetaWeights({ force: true });
  } else console.log('Rückblick-Test: tests/meta-backtest.json fehlt (entsteht beim nächsten Meta-Abgleich)');
  // Meta-Feld & Spielstil
  A.state.factionId = 'orks'; A.state.armies.orks = []; A.state.detachments.orks = [];
  A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 0, useMeta: true });
  const fs1 = A.listFieldScore(A.army());
  ok(fs1 && fs1.per.length === A.metaField().length && fs1.per.length >= 1 && fs1.score > 0 && fs1.score <= 1 && fs1.per.every(x => x.out >= 0 && x.inc >= 0), `Turnierfeld: ${fs1 ? fs1.per.length : 0} Gegnerlisten, Index ${fs1 ? pct(fs1.mean) : '-'} (am schwersten ${fs1 ? fs1.worst.fid : '-'})`);
  const horde = A.listStyle([{ u: A.faction().units.find(u => u.name === 'Gretchin').id, k: 1 }, { u: A.faction().units.find(u => u.name === 'Boyz').id, k: 1 }]);
  ok(horde.key === 'horde', `Spielstil Gretchin + Boyz = ${horde.label}`);
  // Eigene Spiele: Einheit mit 4 Siegen in 4 Spielen → Faktor > 1; Einheit nur in Niederlagen → < 1
  const unitsO = A.faction().units.filter(u => !u.legends);
  const hero = unitsO[3].id, zero = unitsO[5].id, base = unitsO[7].id;
  A.state.ext = A.state.ext || {};
  A.state.ext.games = [1, 2, 3, 4].map(i => ({ t: i, f: 'orks', me: 80, op: 40, units: [hero, base] })).concat([5, 6, 7, 8].map(i => ({ t: i, f: 'orks', me: 30, op: 70, units: [zero, base], lost: [zero] })));
  const ph = A.personalUnitFactor(hero, 'orks'), pz = A.personalUnitFactor(zero, 'orks');
  ok(ph && ph.f > 1 && pz && pz.f < 1, `eigene Spiele: Sieger-Einheit ×${ph && ph.f.toFixed(3)}, Verlierer-Einheit ×${pz && pz.f.toFixed(3)}`);
  A.state.ext.games = [];
  // Detachment-Kombination ohne Meta-Daten: gierig bis zum DP-Budget
  const f0 = A.faction(); const combo = A.detachmentCombo(f0.units.filter(u => !u.legends), f0, 3, { useMeta: false });
  ok(combo.reduce((s, id) => s + (f0.detachments.find(d => d.id === id).dp || 0), 0) <= 3 && combo.length >= 1, `Kombination ohne Meta: ${combo.length} Detachment(s)`);
})();

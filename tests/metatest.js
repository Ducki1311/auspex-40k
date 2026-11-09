// Tests: Meta-Loader, Meta-Weighted Fitness, Lock-Vorrang, Badge
const fs = require('fs');
require('./gq_head.js');
const m = new module.constructor();
m._compile(fs.readFileSync(__dirname + '/app.js', 'utf8') + ';module.exports={state,runAutoList,army,fetchAndCacheMetaWeights,sanitizeMetaWeights,metaUnitFactor,metaWeightedFitness,renderMetaBadge,isMetaStaple,metaInfo,META_STRENGTH:typeof META_STRENGTH!=="undefined"?META_STRENGTH:{value:1},unitDef,faction,metaToggleHTML,handleAction,runEvolutionAutoList,alState};', 'meta.js');
const M = m.exports;
const ok = (c, s) => { console.log((c ? '✓' : '✗') + ' ' + s); if (!c) process.exitCode = 1; };
(async () => {
  const fid = 'space_marines'; M.state.factionId = fid; M.state.armies[fid] = []; M.state.detachments[fid] = [];
  // 1) Offline: kein fetch → neutral
  global.fetch = undefined;
  let r = await M.fetchAndCacheMetaWeights();
  ok(r.origin === 'fallback' && M.metaUnitFactor('x') === 1, 'offline ohne Cache → neutral 1.0');
  const base = M.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 0 });
  const baseIds = base.picks.map(p => p.unitId);
  // 2) Netz liefert Daten: eine bisher nicht gewählte Einheit stark boosten, eine gewählte drücken
  const f = M.faction();
  const cand = f.units.find(u => !baseIds.includes(u.id) && u.role !== 'character' && !u.legends && u.sizes[0].points <= 200 && !/Transport/i.test(u.role));
  const victim = base.picks.find(p => !/character/.test(M.unitDef(p.unitId).role));
  const data = { updated: '2026-11-04', source: 'test', units: { [cand.id]: { weight: 9, pickRate: .52, name: cand.name }, [victim.unitId]: { weight: .5, pickRate: .03 }, bad: { weight: 'x' } } };
  global.fetch = async () => ({ ok: true, json: async () => data });
  r = await M.fetchAndCacheMetaWeights();
  ok(r.origin === 'network' && r.data.units[cand.id].weight === 1.6, 'Netz geladen, Gewicht 9 → geklemmt 1.6');
  ok(r.data.units.bad.weight === 1, 'kaputtes Gewicht → 1.0');
  ok(Math.abs(M.metaWeightedFitness(10, 1.2, cand.id) - 10 * 1.2 * Math.pow(1.6, M.META_STRENGTH.value)) < 1e-9, `Formel 10 × 1.2 × 1.6^${M.META_STRENGTH.value}`);
  ok(M.metaWeightedFitness(10, 1.2, cand.id, { locked: new Set([cand.id]) }) === 12, 'Lock → Meta ignoriert');
  const meta = M.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 0 });
  const cnt = (res, id) => res.picks.filter(p => p.unitId === id).length;
  ok(cnt(meta, cand.id) > 0, `Meta-Pick bevorzugt: ${cand.name} ${cnt(base, cand.id)} → ${cnt(meta, cand.id)}`);
  ok(cnt(meta, victim.unitId) <= cnt(base, victim.unitId), `Underperformer ${victim.name.replace(/ #\d+$/, '')} ${cnt(base, victim.unitId)} → ${cnt(meta, victim.unitId)}`);
  ok(meta.points <= 2000, 'Limit eingehalten: ' + meta.points);
  // 3) Lock: Underperformer fixiert → bleibt drin
  M.state.armies[fid] = JSON.parse(JSON.stringify(base.entries || M.army()));
  const lockE = M.army().find(e => e.unitId === victim.unitId);
  const lk = M.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [lockE.uid], seed: 0 });
  ok(lk.picks.some(p => p.unitId === victim.unitId && p.locked), 'fixierte Einheit trotz Meta 0.5 behalten');
  // 4) Offline danach → Cache
  global.fetch = async () => { throw new Error('offline'); };
  r = await M.fetchAndCacheMetaWeights();
  ok(r.origin === 'cache' && r.data.units[cand.id].weight === 1.6, 'offline → Cache (localStorage)');
  // 5) Badge
  ok(/meta-badge/.test(M.renderMetaBadge(cand.id)) && /52/.test(M.renderMetaBadge(cand.id)), 'Badge mit Pick-Rate: ' + M.renderMetaBadge(cand.id));
  ok(M.renderMetaBadge(victim.unitId) === '' && M.renderMetaBadge('nix') === '', 'kein Badge für Underperformer/unbekannt');
  // 6) Abschaltbar
  M.state.armies[fid] = [];
  const off = M.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 0, useMeta: false });
  ok(off.picks.map(p => p.unitId).sort().join() === base.picks.map(p => p.unitId).sort().join(), 'useMeta:false = identisch zur Basis');
  ok(M.sanitizeMetaWeights(null) === null && M.sanitizeMetaWeights({ units: 5 }) === null, 'Schema-Prüfung');
  // 7) Schalter in beiden Dialogen + GA
  M.state.autoList = Object.assign(M.alState(), M.state.autoList || {});
  M.state.autoList.useMeta = true;
  ok(/aria-checked="true"/.test(M.metaToggleHTML('evo')) && /gewichtete/.test(M.metaToggleHTML('evo')), 'Schalter An (Amber): ' + M.metaToggleHTML('evo').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  M.state.autoList.useMeta = false;
  ok(/aria-checked="false"/.test(M.metaToggleHTML('al')), 'Schalter Aus (klassisch)');
  M.state.autoList.useMeta = true;
  const ga = async um => { M.state.armies[fid] = []; const r = await M.runEvolutionAutoList({ limit: 2000, seed: 0, useMeta: um, ga: { timeBudgetMs: 1200 } }); return r.army ? r.army.filter(e => e.unitId === cand.id).length : M.army().filter(e => e.unitId === cand.id).length; };
  const gOn = await ga(true), gOff = await ga(false);
  ok(gOn >= gOff, `GA respektiert Schalter: ${cand.name} an ${gOn} / aus ${gOff}`);
})();
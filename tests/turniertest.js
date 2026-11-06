/* v18.21: Turnier-Audit – unabhängige Prüfung generierter Listen (klassisch + Evolution) gegen die Bauregeln:
 * Punkte, Kriegsherr, Rule of Three, Enhancements, Anführer, Transporte, Detachment-Punkte, Legends, Zusammensetzung. */
const A = require('./harness.js');
const bad = [];
const audit = (tag, f) => {
  const list = A.army(), bs = A.battleSize(A.state.limit), dets = A.selectedDetachments().map(id => f.detachments.find(d => d.id === id)).filter(Boolean);
  const err = m => bad.push(`${tag}: ${m}`);
  const pts = A.armyPoints(); if (pts > A.state.limit) err(`Punkte ${pts} > ${A.state.limit}`);
  const isChar = u => u.role === 'character' || u.character || (u.kw || []).some(k => /^character$/i.test(k));
  const wl = list.filter(e => e.warlord); if (wl.length !== 1) err(`${wl.length} Kriegsherren`); else if (!isChar(A.unitDef(wl[0].unitId))) err('Kriegsherr ist kein Charakter');
  const cnt = {}; list.forEach(e => { cnt[e.unitId] = (cnt[e.unitId] || 0) + 1; });
  Object.entries(cnt).forEach(([id, n]) => { const u = A.unitDef(id); const lim = u.epicHero ? 1 : (u.role === 'transport' || A.isBattleline(u, A.selectedDetachments())) ? bs.unitLimit * 2 : bs.unitLimit; if (n > lim) err(`${u.name} ${n}× (erlaubt ${lim})`); });
  const enh = list.filter(e => e.enhancementId);
  const detNames = new Set(dets.map(d => (d._i && d._i.name && d._i.name.en) || d.name));
  if (enh.filter(e => !(A.enhDef(e.enhancementId) || {}).upgrade).length > bs.enhancements) err(`${enh.length} Enhancements (max ${bs.enhancements})`);
  if (new Set(enh.map(e => e.enhancementId)).size !== enh.length) err('Enhancement doppelt');
  enh.forEach(e => { const en = A.enhDef(e.enhancementId), u = A.unitDef(e.unitId); if (!en) { err('unbekanntes Enhancement'); return; }
    if (!en.upgrade && (!isChar(u) || u.epicHero)) err(`Enhancement auf ${u.name} (kein Charakter/Epic Hero)`);
    const dn = (en._i && en._i.detachment && en._i.detachment.en) || en.detachment; if (dn && detNames.size && !detNames.has(dn)) err(`Enhancement ${en.name} aus fremdem Detachment`); });
  const byUid = new Map(list.map(e => [e.uid, e]));
  const heads = {};
  list.forEach(e => { if (!e.attachedTo) return; const t = byUid.get(e.attachedTo), u = A.unitDef(e.unitId);
    if (!t) { err(`${u.name} an fehlende Einheit angeschlossen`); return; }
    if (!(u.leads || []).includes(t.unitId)) err(`${u.name} darf ${A.unitDef(t.unitId).name} nicht anführen`);
    if (t.attachedTo) err(`${u.name} an angeschlossene Einheit`);
    const k = t.uid + '|' + (u.charType || 'leader'); heads[k] = (heads[k] || 0) + 1; if (heads[k] > 1) err(`${A.unitDef(t.unitId).name}: mehrere ${u.charType || 'leader'}`); });
  const load = {};
  list.forEach(e => { if (!e.embarkedIn) return; const t = byUid.get(e.embarkedIn); if (!t) { err('Transport fehlt'); return; } const tu = A.unitDef(t.unitId);
    if (!tu.transport) err(`${tu.name} ist kein Transporter`);
    load[t.uid] = (load[t.uid] || 0) + Object.values(A.modelCounts(e)).reduce((a, b) => a + b, 0); });
  Object.entries(load).forEach(([uid, n]) => { const tu = A.unitDef(byUid.get(uid).unitId); const cap = tu.transport && tu.transport.cap; if (cap && n > cap) err(`${tu.name} trägt ${n} > ${cap}`); });
  if (dets.reduce((a, d) => a + (d.dp || 0), 0) > bs.dp) err('Detachment-Punkte überschritten');
  if (!dets.length) err('kein Detachment');
  list.forEach(e => { const u = A.unitDef(e.unitId);
    if (u.legends) err(`Legends: ${u.name}`);
    if (!A.unitAllowedByDetachment(u, A.selectedDetachments())) err(`${u.name} im Detachment nicht erlaubt`);
    if (!(e.sizeIdx >= 0 && e.sizeIdx < u.sizes.length)) err(`${u.name} ungültige Größe`);
    const c = A.modelCounts(e), S = u.sizes[e.sizeIdx].models; if (Object.values(c).reduce((a, b) => a + b, 0) !== S) err(`${u.name} Modellzahl ≠ ${S}`); });
  A.validate().filter(w => w.lvl === 'err').forEach(w => err('validate: ' + w.msg));
};
(async () => {
  let n = 0;
  for (const f of A.GAME_DATA.factions) for (const lim of [1000, 2000, 3000]) for (const arch of ['balanced', 'shooting', 'melee', 'control']) {
    A.state.factionId = f.id; A.state.limit = lim; A.state.armies[f.id] = []; A.state.detachments[f.id] = [];
    const r = A.runAutoList({ limit: lim, archetype: arch, source: 'catalog', locked: [], seed: 0 }); if (!r.ok) { bad.push(`${f.id} ${lim} ${arch}: keine Liste (${r.error})`); continue; }
    n++; audit(`${f.id} ${lim} ${arch}`, f);
  }
  let g = 0;
  if (A.runEvolutionAutoList && !process.env.NO_GA) for (const f of A.GAME_DATA.factions) {
    A.state.factionId = f.id; A.state.limit = 2000; A.state.armies[f.id] = []; A.state.detachments[f.id] = [];
    Object.assign(A.alState(), { source: 'catalog', limit: 2000 });
    try { const r = await A.runEvolutionAutoList({ limit: 2000, seed: 0, ga: { generations: 30, populationSize: 80, timeBudgetMs: 600 } }); if (r && r.ok) { g++; audit(`${f.id} GA`, f); } else bad.push(`${f.id} GA: keine Liste`); }
    catch (e) { bad.push(`${f.id} GA: ${e.message}`); }
  }
  // „Nie vorschlagen“: drei Datenblätter der ersten Liste ausschließen → dürfen in neuen Listen nicht mehr auftauchen
  let x = 0;
  for (const f of A.GAME_DATA.factions) {
    A.state.factionId = f.id; A.state.limit = 2000; A.state.armies[f.id] = []; A.state.detachments[f.id] = [];
    const st = A.alState(); st.excluded = {};
    const r0 = A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 0 }); if (!r0.ok) continue;
    const ids = [...new Set(A.state.armies[f.id].map(e => e.unitId))].slice(0, 3); st.excluded[f.id] = ids;
    for (const kind of ['klassisch', 'GA']) {
      A.state.armies[f.id] = []; A.state.detachments[f.id] = [];
      const r = kind === 'GA' ? (A.runEvolutionAutoList && !process.env.NO_GA ? await A.runEvolutionAutoList({ limit: 2000, seed: 1, ga: { generations: 20, populationSize: 60, timeBudgetMs: 400 } }) : null)
        : A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 1 });
      if (!r) continue; if (!r.ok) { bad.push(`${f.id} Ausschluss ${kind}: keine Liste`); continue; }
      x++; const hit = A.state.armies[f.id].filter(e => ids.includes(e.unitId)).map(e => A.unitDef(e.unitId).name);
      if (hit.length) bad.push(`${f.id} Ausschluss ${kind}: ausgeschlossen, aber drin: ${[...new Set(hit)].join(', ')}`);
      audit(`${f.id} Ausschluss ${kind}`, f);
    }
    st.excluded = {};
  }
  console.log(`Ausschluss-Prüfung: ${x} Listen`);
  console.log(`Turnier-Audit: ${n} klassische + ${g} Evolutions-Listen | Befunde ${bad.length}`);
  const grp = {}; bad.forEach(b => { const k = b.replace(/^[a-z_]+ (\d+ \w+|GA): /, ''); (grp[k] = grp[k] || []).push(b.split(':')[0]); });
  Object.entries(grp).sort((a, b) => b[1].length - a[1].length).slice(0, 40).forEach(([k, v]) => console.log(`  ✗ ${v.length}× ${k}  [${v.slice(0, 3).join('; ')}]`));
  process.exit(bad.length ? 1 : 0);
})();

// v18.31: Ausrüstung und Anführer-Zuordnung – Import (GW-App „Attached Unit“-Blöcke, WTC/New-Recruit-Details) und
// Übernahme aus den Sieger-Builds in die Generatoren. Aufruf: node tests/siegertest.js
const fs = require('fs');
require('./gq_head.js');
const m = new module.constructor();
m._compile(fs.readFileSync(__dirname + '/app.js', 'utf8') + ';module.exports={state,GAME_DATA,runAutoList,army,unitDef,validate,armyPoints,parseImport,resolveImport,normalizeEntry,selectedGear,faction,makeEntry,modelCounts,enOf,alState,metaFaction,fetchAndCacheMetaWeights,sanitizeMetaFactions,selectedDetachments,entryPoints};', 'sieger-app.js');
const A = m.exports;
const GEAR_MIN = .9, DBG = process.argv.includes('--debug');
let fail = 0; const ok = (c, s) => { console.log((c ? '✓' : '✗') + ' ' + s); if (!c) { fail++; process.exitCode = 1; } };
const en = (o, k) => A.enOf(o, k) || o[k];
const clean = w => String(w).replace(/^➤\s*/, '').split(' - ')[0].replace(/\s*\(.*?\)/g, '').trim();
// je Waffe einmal pro Ausrüstungsteil (mehrere Profile derselben Waffe zählen nicht doppelt) – so listet es auch die GW-App
const weaponsOf = e => { const c = {}; A.selectedGear(e).forEach(g => [...new Set((g.weapons || []).map(clean))].forEach(n => { c[n] = (c[n] || 0) + (g.count || 1); })); return c; };
const sig = e => { const c = weaponsOf(e); return Object.keys(c).sort().map(k => k + '×' + c[k]).join('|'); };

// 1) GW-App (11. Edition): „Attached Unit N“-Blöcke
const GW = `Orks
Blitz Brigade (3 Detachment Points)
Strike Force (2000 points)

Attached Units
Attached Unit 1

Beastboss (105 points)
• Attached as: Leader (Character)
• 1x Beast Snagga Klaw and Beastchoppa
1x Shoota
• Enhancement: Da Gobshot Thunderbuss

Beast Snagga Boyz (80 points)
• Attached as: Bodyguard (Battleline)
• 9x Beast Snagga Boy
• 9x Choppa
9x Slugga
1x Thump Gun
• 1x Nob
• 1x Power Snappa
1x Slugga

CHARACTERS

Beastboss on Squigosaur (160 points)
• 1x Beastchoppa
1x Slugga
1x Squigosaur’s Jaws
1x Thump Gun
• Warlord

BATTLELINE

Beast Snagga Boyz (80 points)
• 10x Beast Snagga Boy
`;
{
  A.state.factionId = 'orks';
  const r = A.resolveImport(A.parseImport(GW));
  const name = e => A.unitDef(e.unitId).name;
  const boss = r.entries.find(e => name(e) === 'Beastboss'), boyz = r.entries.filter(e => name(e) === 'Beast Snagga Boyz'), squig = r.entries.find(e => /Squigosaur/.test(name(e)));
  ok(r.ok && r.entries.length === 4, 'GW-App: 4 Einheiten gelesen (Block-Überschriften sind keine Einheiten)');
  ok(boss && boyz.length === 2 && boss.attachedTo === boyz[0].uid, 'GW-App: Anführer aus „Attached Unit 1“ hängt an der Leibwache desselben Blocks');
  ok(squig && !squig.attachedTo && squig.warlord, 'GW-App: Einheit außerhalb der Blöcke bleibt ohne Zuordnung, Kriegsherr erkannt');
  ok(boyz[0].options['m|Beast Snagga Boy w/ Thump gun'] === 1 && Object.keys(squig.options).some(k => /Thump Gun/.test(k)), 'GW-App: Ausrüstung aus den Waffenzeilen übernommen');
}
// 2) WTC/New Recruit: Kopfzeilen, „Leading X“, „Attached to: X“ bei der Leibwache
const WTC = `+ FACTION KEYWORD: Xenos - Orks
+ DETACHMENT: War Horde
+ TOTAL ARMY POINTS: 2000pts
+ WARLORD: Char1: Warboss
+ ENHANCEMENT: Follow Me Ladz (on Char1: Warboss)

Char1: 1x Warboss (100 pts): Attack Squig, Kombi-weapon, Power klaw, Twin sluggas
  Leading Boyz
Char2: 1x Painboy (80 pts): Power klaw, 'Urty syringe

10x Boyz (80 pts)
• 9x Boy
  1x Big shoota, 8x Choppa, 8x Slugga
• 1x Boss Nob: Big choppa, Slugga
10x Boyz (80 pts)
• 9x Boy: 9x Shoota
• 1x Boss Nob: Power klaw, Slugga
  Attached to: Painboy
`;
{
  A.state.factionId = 'orks';
  const r = A.resolveImport(A.parseImport(WTC));
  const name = e => A.unitDef(e.unitId).name;
  const wb = r.entries.find(e => name(e) === 'Warboss'), pb = r.entries.find(e => name(e) === 'Painboy'), boyz = r.entries.filter(e => name(e) === 'Boyz');
  ok(r.ok && wb && pb && boyz.length === 2, 'WTC: Einheiten gelesen');
  ok(wb.warlord && !!wb.enhancementId, 'WTC: Kriegsherr und Enhancement aus den Kopfzeilen');
  ok(wb.attachedTo === boyz[0].uid, 'WTC: „Leading Boyz“ → Warboss führt den ersten Boyz-Trupp');
  ok(pb.attachedTo === boyz[1].uid, 'WTC: „Attached to: Painboy“ bei der Leibwache → Painboy führt genau diesen Trupp');
  ok(boyz[0].options['m|Boy w/ Big shoota'] === 1, 'WTC: Spezialwaffen-Modelle gezählt');
}

// 2b) weitere Schreibweisen: „└ Leads: X ×10“, Mehrzahl ohne „Squad“
{
  A.state.factionId = 'world_eaters';
  const r = A.resolveImport(A.parseImport(`World Eaters\nStrike Force (2000 points)\n\nKhorne Berzerkers (180 pts)\nMaster of Executions (80 pts)\n  └ Leads: Khorne Berzerkers ×10\nKhorne Berzerkers (180 pts)\n`), { factions: ['world_eaters'] });
  const moe = r.ok && r.entries.find(e => /Executions/.test(A.enOf(A.unitDef(e.unitId), 'name')));
  ok(r.ok && r.entries.length === 3 && !r.misses.length && moe && !!moe.attachedTo, '„└ Leads: …“ wird als Zuordnung gelesen, nicht als Einheit');
  A.state.factionId = 'adeptus_custodes';
  const c = A.resolveImport(A.parseImport(`Adeptus Custodes\nStrike Force (2000 points)\n\nProsecutors (45 points)\nCustodian Guard (150 points)\n`), { factions: ['adeptus_custodes'] });
  ok(c.ok && !c.misses.length && c.entries.length === 2, '„Prosecutors“ wird als „Prosecutor Squad“ erkannt');
}

// 2c) v18.32 – Verbündete nach Armeeregel: Freeblades/Dreadblades, Assigned Agents, Daemonic Pact
{
  const mk = (fid, names, limit = 2000) => { A.state.factionId = fid; A.state.limit = limit; A.state.detachments[fid] = []; const f = A.faction();
    A.state.armies[fid] = names.map(n => { const u = f.units.find(u => A.enOf(u, 'name') === n); if (!u) throw new Error('fehlt: ' + fid + ' ' + n); return A.normalizeEntry(A.makeEntry(u.id)); });
    return A.validate().filter(x => x.lvl === 'err' && /^(ally|allies|det-unit)/.test(x.code || '')).map(x => x.code); };
  const none = a => a.length === 0, has = (a, c) => a.includes(c);
  ok(none(mk('death_guard', ['Knight Despoiler'])), 'Dreadblades: ein großer Chaos-Ritter bei Death Guard erlaubt');
  ok(has(mk('death_guard', ['Knight Despoiler', 'Knight Rampager']), 'ally-knights') && has(mk('death_guard', ['Knight Despoiler', 'War Dog Executioner']), 'ally-knights'), 'Dreadblades: zwei große oder groß + War Dog → Fehler');
  ok(none(mk('world_eaters', ['War Dog Executioner', 'War Dog Executioner', 'War Dog Stalker'])) && has(mk('world_eaters', ['War Dog Executioner', 'War Dog Executioner', 'War Dog Stalker', 'War Dog Brigand']), 'ally-knights'), 'Dreadblades: bis zu drei War Dogs, vier → Fehler');
  ok(none(mk('space_marines', ['Armiger Warglaive', 'Armiger Warglaive', 'Armiger Helverin'])) && none(mk('ultramarines', ['Canis Rex'])) && none(mk('adeptus_custodes', ['Knight Paladin'])), 'Freeblades: Armiger ×3 bzw. ein großer Ritter bei Imperiums-Fraktionen (auch Orden)');
  ok(none(mk('space_marines', ['Callidus Assassin', 'Vindicare Assassin', 'Inquisitorial Agents'])) && has(mk('space_marines', ['Callidus Assassin', 'Vindicare Assassin', 'Eversor Assassin']), 'ally-agents') && has(mk('astra_militarum', ['Callidus Assassin', 'Vindicare Assassin'], 1000), 'ally-agents'), 'Assigned Agents: Grenzen je Spielgröße (2 Charaktere bei Strike Force, 1 bei Incursion)');
  ok(none(mk('chaos_knights', ['Nurglings', 'Nurglings'])) && none(mk('death_guard', ['Nurglings'])) && has(mk('chaos_space_marines', ['Bloodthirster']), 'ally-pact-bl') && none(mk('chaos_space_marines', ['Bloodthirster', 'Bloodletters'])), 'Daemonic Pact: Dämonen erlaubt, je Gott nicht mehr andere Einheiten als Battleline');
  const many = mk('chaos_space_marines', ['Bloodletters', 'Bloodletters', 'Bloodthirster', 'Bloodthirster']);
  ok(has(many, 'ally-pact'), 'Daemonic Pact: mehr als 500 Punkte bei Strike Force → Fehler');
  A.state.factionId = 'death_guard'; const kd = A.faction().units.find(u => A.enOf(u, 'name') === 'Knight Despoiler'); const e = A.normalizeEntry(A.makeEntry(kd.id)); e.warlord = true; A.state.armies.death_guard = [e];
  ok(A.validate().some(x => x.code === 'warlord-faction') && !!kd.wpn && A.selectedGear(e).length > 0 && A.selectedGear(e).every(g => (g.weapons || []).every(w => !!kd.wpn[w] || !!A.faction().weapons[w])), 'verbündeter Ritter: kein Kriegsherr, Waffenprofile der Herkunftsfraktion vorhanden');
  ok(!A.GAME_DATA.factions.find(f => f.id === 'orks').units.some(u => u.allyRule) && !A.GAME_DATA.factions.find(f => f.id === 'chaos_knights').units.some(u => u.allyRule === 'dreadblades'), 'Xenos ohne diese Verbündeten, Ritter-Fraktion ohne sich selbst');
  // Import: Death-Guard-Liste mit Ritter bleibt Death Guard; reine Ritter-Liste bleibt Chaos Knights
  const r1 = A.resolveImport(A.parseImport('My list (2000 points)\n\nMortarion (380 points)\nPlague Marines (90 points)\nPlague Marines (90 points)\nDeathshroud Terminators (140 points)\nKnight Despoiler (360 points)\n'));
  const r2 = A.resolveImport(A.parseImport('My list (2000 points)\n\nKnight Despoiler (360 points)\nKnight Rampager (360 points)\nWar Dog Executioner (140 points)\nWar Dog Stalker (140 points)\n'));
  ok(r1.ok && r1.f.id === 'death_guard' && !r1.misses.length && r2.ok && r2.f.id === 'chaos_knights', 'Import: Liste mit verbündetem Ritter wird der richtigen Fraktion zugeordnet');
  const r3 = A.resolveImport(A.parseImport('Orks\nStrike Force (2000 points)\n\n10 Beast Snagga Boyz (95 pts)\nFrimeurs (80 points)\nKamion (65 points)\n'), { factions: ['orks'] });
  ok(r3.ok && !r3.misses.length && r3.entries.length === 3, 'Import: „10 Beast Snagga Boyz“ ohne x und häufige französische Namen');
}

// 2d) Staffelpreise: das teurere 2. Exemplar bleibt dieselbe Truppgröße
{
  let n = 0, good = 0;
  for (const f of A.GAME_DATA.factions.filter(x => !x.parent)) {
    const u = f.units.find(u => !u.ally && !u.legends && (u.escalation || []).length && u.sizes.length >= 2 && !u.epicHero); if (!u) continue;
    const add = u.escalation.slice().sort((a, b) => a.after - b.after)[0].add, nm = A.enOf(u, 'name');
    A.state.factionId = f.id;
    const r = A.resolveImport(A.parseImport(`${A.enOf(f, 'name')}\nStrike Force (2000 points)\n\n${nm} (${u.sizes[0].points} points)\n\n${nm} (${u.sizes[0].points + add} points)\n`), { factions: [f.id] });
    n++; if (r.ok && r.entries.length === 2 && r.entries.every(e => e.sizeIdx === 0)) good++;
  }
  ok(n >= 5 && good === n, `Staffelpreise: 2. Exemplar mit Aufpreis wird nicht als größere Truppstufe gelesen (${good}/${n} Fraktionen)`);
}

// 3) Rundreise für alle Fraktionen: erzeugte Liste → GW-App-Text mit echten Waffen und Blöcken → Import
(async () => {
  let ents = 0, gearSame = 0, leaders = 0, leadSame = 0, lists = 0, invalid = 0;
  const worst = {};
  for (const f of A.GAME_DATA.factions) {
    A.state.factionId = f.id; A.state.limit = 2000; A.state.armies[f.id] = []; A.state.detachments[f.id] = []; A.alState().excluded = {};
    const res = A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 3, useMeta: false });
    if (!res || !res.ok) continue;
    lists++;
    const list = JSON.parse(JSON.stringify(A.army()));
    const block = e => { const u = A.unitDef(e.unitId); const out = [`${en(u, 'name')} (${A.entryPoints(e)} points)`];
      const c = A.modelCounts(e); Object.entries(c).filter(([, n]) => n).forEach(([mn, n]) => out.push(`• ${n}x ${mn.replace(/\s+w\/.*$/i, '')}`));
      Object.entries(weaponsOf(e)).forEach(([w, n], i) => out.push((i ? '' : '• ') + `${n}x ${w}`));
      if (e.warlord) out.push('• Warlord'); return out; };
    const txt = [en(f, 'name'), 'Strike Force (2000 points)', '', 'Attached Units']; let gi = 0;
    const bodies = list.filter(e => list.some(x => x.attachedTo === e.uid));
    bodies.forEach(b => { txt.push(`Attached Unit ${++gi}`, ''); list.filter(x => x.attachedTo === b.uid).forEach(l => { const o = block(l); o.splice(1, 0, '• Attached as: Leader (Character)'); txt.push(...o, ''); }); const o = block(b); o.splice(1, 0, '• Attached as: Bodyguard'); txt.push(...o, ''); });
    txt.push('OTHER DATASHEETS', ''); list.filter(e => !e.attachedTo && !bodies.includes(e)).forEach(e => txt.push(...block(e), ''));
    const want = list.map(e => ({ u: e.unitId, k: e.sizeIdx, s: sig(e), to: e.attachedTo ? list.find(x => x.uid === e.attachedTo).unitId : null }));
    const r = A.resolveImport(A.parseImport(txt.join('\n')), { factions: [f.id] });
    if (!r.ok) { invalid++; continue; }
    A.state.factionId = r.f.id; A.state.armies[r.f.id] = r.entries.map(e => A.normalizeEntry({ ...e }));
    const got = A.army().map(e => ({ u: e.unitId, k: e.sizeIdx, s: sig(e), to: e.attachedTo ? (A.army().find(x => x.uid === e.attachedTo) || {}).unitId : null }));
    const pool = got.slice();
    want.forEach(w => {
      ents++; if (w.to) leaders++;
      let i = pool.findIndex(g => g.u === w.u && g.k === w.k && g.s === w.s && g.to === w.to); if (i < 0) i = pool.findIndex(g => g.u === w.u && g.k === w.k && g.s === w.s); if (i < 0) i = pool.findIndex(g => g.u === w.u);
      if (i < 0) return; const g = pool.splice(i, 1)[0];
      if (g.s === w.s && g.k === w.k) gearSame++; else { worst[f.id] = (worst[f.id] || 0) + 1; if (DBG) console.log(`   ${f.id} · ${A.unitDef(w.u).name} k${w.k}/${g.k}\n      soll ${w.s}\n      ist  ${g.s}`); }
      if (w.to && g.to === w.to) leadSame++;
    });
    if (A.validate().some(x => x.lvl === 'err' && /Ausrüstung|wargear/i.test(x.msg))) invalid++;
  }
  const gp = gearSame / ents, lp = leaders ? leadSame / leaders : 1;
  console.log(`Rundreise Ausrüstung: ${lists} Listen, ${ents} Einträge – Ausrüstung identisch ${(100 * gp).toFixed(1)} %, Anführer-Zuordnung ${leadSame}/${leaders} (${(100 * lp).toFixed(1)} %)`);
  console.log('  meiste Abweichungen:', Object.entries(worst).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => k + ' ' + n).join(', '));
  ok(lists >= 30 && !invalid, `alle ${lists} Listen importierbar, keine Ausrüstungs-Regelfehler`);
  ok(gp >= GEAR_MIN, `Ausrüstung zu mindestens ${Math.round(100 * GEAR_MIN)} % identisch gelesen`);
  ok(lp >= .95, 'Anführer-Zuordnung aus den Blöcken zu mindestens 95 % identisch');

  // 4) Übernahme in den Generator: Meta-Daten mit Ausrüstung/Anführern aus einer erzeugten Liste → gleiche Ausrüstung, weiter regelkonform
  let nG = 0, nGok = 0, nL = 0, errs = 0, over = 0, facs = 0;
  for (const f of A.GAME_DATA.factions.filter(x => !x.parent).slice(0, 14)) {
    A.state.factionId = f.id; A.state.limit = 2000; A.state.armies[f.id] = []; A.state.detachments[f.id] = []; A.alState().excluded = {};
    global.fetch = undefined;
    const base = A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 5, useMeta: false }); if (!base || !base.ok) continue;
    const list = JSON.parse(JSON.stringify(A.army())), dets = [...A.selectedDetachments()];
    // „Sieger-Ausrüstung“: Standard-Ausrüstung (leere Optionen wären nicht unterscheidbar → erste abweichende Slot-Wahl je Einheit)
    const gear = {}, leads = {}, consensus = [];
    list.forEach(e => { if (!consensus.some(c => c.u === e.unitId)) consensus.push({ u: e.unitId, k: e.sizeIdx });
      const u = A.unitDef(e.unitId); const mdl = (u.models || []).find(x => x.lo && (x.lo.slots || []).some(s => s.max <= 1 && s.opts.length > 1)); if (!mdl || gear[e.unitId]) return;
      const sl = mdl.lo.slots.find(s => s.max <= 1 && s.opts.length > 1); const alt = sl.opts.find(o => o.n !== sl.def && !(o.p > 0)); if (alt) gear[e.unitId] = { [`s|${mdl.n}|${sl.n}`]: alt.n };
      if (e.attachedTo) leads[e.unitId] = list.find(x => x.uid === e.attachedTo).unitId; });
    const rates = {}; consensus.forEach(c => { rates[c.u] = 1; });
    const top = { dets, disp: null, lists: 9, readable: 9, pts: 2000, record: { w: 40, l: 5, d: 0 }, consensus, rates, spine: consensus.map(c => c.u), flex: [], gear: { ...gear, 'bad<id>': { 's|x|y': 'z' }, [consensus[0].u]: gear[consensus[0].u] || { 'x|kaputt': 1 } }, leads: { ...leads, 'nope': '<script>' } };
    const raw = { schema: 3, updated: '2026-11-10', source: 'test', units: Object.fromEntries(consensus.map(c => [c.u, { weight: 1.3, pickRate: 1, name: 'x', f: f.id }])), factions: { [f.id]: { rank: 1, share: .1, lists: 9, winRate: 52, games: 100, builds: [{ dets, lists: 9, share: 1, record: { w: 40, l: 5, d: 0 } }], top, tops: [top] } } };
    global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(raw)) });
    await A.fetchAndCacheMetaWeights({ force: true });
    const t = A.metaFaction(f.id).tops[0];
    if (Object.keys(t.gear).some(k => /[<>]/.test(k)) || Object.keys(t.leads).includes('nope') || (t.gear[consensus[0].u] && Object.keys(t.gear[consensus[0].u]).some(k => /^x\|/.test(k)))) { errs++; console.log('  ✗ Prüfung der Meta-Daten lässt kaputte Ausrüstung durch:', f.id); }
    A.state.armies[f.id] = []; A.state.detachments[f.id] = dets;
    const res = A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 5, useMeta: true }); if (!res || !res.ok) { errs++; continue; }
    facs++;
    const bad = A.validate().filter(x => x.lvl === 'err'); if (bad.length) { errs++; console.log('  ✗', f.id, bad[0].msg); }
    if (A.armyPoints() > 2000) over++;
    A.army().forEach(e => { const g = t.gear[e.unitId]; const c = consensus.find(x => x.u === e.unitId);
      if (g && c && c.k === e.sizeIdx) { nG++; if (e.metaGear && Object.entries(g).every(([k, v]) => JSON.stringify(e.options[k]) === JSON.stringify(v))) nGok++; }
      if (e.metaLead && e.attachedTo) nL++; });
  }
  { // v18.32: verbündeter Ritter aus den Siegerlisten
    const fid = 'death_guard'; A.state.factionId = fid; A.state.limit = 2000; A.state.armies[fid] = []; A.state.detachments[fid] = []; A.alState().excluded = {};
    global.fetch = undefined; const base = A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 5, useMeta: false });
    const list = JSON.parse(JSON.stringify(A.army())), dets = [...A.selectedDetachments()], kd = A.faction().units.find(u => A.enOf(u, 'name') === 'Knight Despoiler');
    const consensus = [{ u: kd.id, k: 0 }]; list.forEach(e => { if (!consensus.some(c => c.u === e.unitId)) consensus.push({ u: e.unitId, k: e.sizeIdx }); });
    const rates = Object.fromEntries(consensus.map(c => [c.u, 1])); const top = { dets, lists: 9, readable: 9, pts: 2000, record: { w: 40, l: 5, d: 0 }, consensus, rates, spine: consensus.map(c => c.u), flex: [] };
    const raw = { schema: 3, updated: '2026-11-11', source: 'test', units: Object.fromEntries(consensus.map(c => [c.u, { weight: 1.4, pickRate: 1, name: 'x', f: fid }])), factions: { [fid]: { rank: 1, share: .1, lists: 9, winRate: 52, games: 100, builds: [{ dets, lists: 9, share: 1, record: { w: 40, l: 5, d: 0 } }], top, tops: [top] } } };
    global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(raw)) }); await A.fetchAndCacheMetaWeights({ force: true });
    A.state.armies[fid] = []; A.state.detachments[fid] = dets;
    const res = A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 5, useMeta: true });
    const kn = A.army().filter(e => A.unitDef(e.unitId).allyRule), bad = A.validate().filter(x => x.lvl === 'err');
    ok(res.ok && base.ok && kn.length === 1 && kn[0].unitId === kd.id && !kn[0].warlord && !kn[0].enhancementId && !bad.length && A.armyPoints() <= 2000, `Generator: genau ein verbündeter Ritter wie in den Siegerlisten, Liste regelkonform (${kn.length} Ritter${bad[0] ? ', ' + bad[0].msg : ''})`);
    A.state.armies[fid] = []; A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 5, useMeta: false });
    ok(!A.army().some(e => A.unitDef(e.unitId).allyRule), 'Generator ohne Meta: keine Verbündeten');
  }
  global.fetch = undefined;
  console.log(`Übernahme: ${facs} Fraktionen, Turnier-Ausrüstung bei ${nGok}/${nG} passenden Einträgen, Anführer nach Siegerlisten: ${nL}`);
  ok(!errs && !over, 'Listen mit Turnier-Ausrüstung bleiben regelkonform und im Punktelimit; kaputte Meta-Einträge werden verworfen');
  ok(nG > 10 && nGok / nG >= .8, 'Turnier-Ausrüstung wird bei mindestens 80 % der passenden Einträge übernommen');
  ok(nL > 0, 'Anführer werden wie in den Siegerlisten zugeordnet');
  console.log(fail ? `${fail} Fehler` : 'Sieger-Ausrüstung: alles grün');
})();

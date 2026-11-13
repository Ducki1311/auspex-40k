// v18.35: Vollständigkeits- und Formatprüfung der Spieldaten (alle Fraktionen inkl. eingehängter Verbündeter) sowie
// Regressionsprüfungen aus der Komplettprüfung vom 12.11.2026. Aufruf: node tests/datentest.js
const fs = require('fs');
require('./gq_head.js');
const m = new module.constructor();
m._compile(fs.readFileSync(__dirname + '/app.js', 'utf8') + ';module.exports={state,GAME_DATA,faction,unitDef,weaponOf,normalizeEntry,makeEntry,modelCounts,selectedGear,entryPoints,validate,ROLE_META,TAG_META,isCharUnit,enOf,runAutoList,army,armyPoints,alState,fetchAndCacheMetaWeights,metaFaction};', 'daten-app.js');
const A = m.exports, G = A.GAME_DATA;
let fail = 0; const ok = (c, s) => { console.log((c ? '✓' : '✗') + ' ' + s); if (!c) { fail++; process.exitCode = 1; } };
const en = u => A.enOf(u, 'name') || u.name;
const out = {}; const add = (k, s) => (out[k] = out[k] || []).push(s);
const dice = s => /^\d+$|^\d*D\d+(\+\d+)?$/i.test(String(s).trim());
let units = 0, weapons = 0, entries = 0;
for (const f of G.factions) {
  A.state.factionId = f.id; A.state.limit = 2000;
  const ids = new Set();
  for (const u of f.units) {
    units++;
    const tag = `${f.id}: ${en(u)}`;
    if (ids.has(u.id)) add('ID doppelt', tag); ids.add(u.id);
    if (!A.ROLE_META[u.role]) add('Rolle unbekannt', tag);
    if (!u.sizes || !u.sizes.length) { add('ohne Truppgröße', tag); continue; }
    u.sizes.forEach((s, i) => { if (!(s.points > 0) || !(s.models > 0)) add('Punkte/Modelle ≤ 0', tag); if (i && s.points < u.sizes[i - 1].points) add('größere Truppe billiger', tag); });
    if (!u.stats || !u.stats.length) add('ohne Profil', tag);
    (u.stats || []).forEach(st => { for (const k of ['m', 't', 'sv', 'w', 'ld', 'oc']) if (st[k] == null || st[k] === '') add('Profilwert fehlt', tag + ' ' + k);
      for (const k of ['m', 't', 'sv', 'w', 'ld', 'oc', 'inv']) if (typeof st[k] === 'string' && st[k] !== st[k].trim()) add('Profilwert mit Leerraum', tag + ' ' + k);
      if (st.sv && !/^\d\+$/.test(st.sv)) add('Sv-Format', tag + ' ' + st.sv); if (st.ld && !/^\d+\+$/.test(st.ld)) add('Ld-Format', tag + ' ' + st.ld); });
    if (!Array.isArray(u.kw) || !u.kw.length) add('ohne Schlüsselwörter', tag);
    (u.tags || []).forEach(t => { if (!A.TAG_META[t]) add('Eigenschaft unbekannt', tag + ' ' + t); });
    const seen = new Set(); let anyW = false;
    const chk = w => { anyW = true; if (seen.has(w)) return; seen.add(w); weapons++; const p = A.weaponOf(u, w, f); if (!p) { add('Waffe ohne Profil', `${tag} → ${w}`); return; }
      for (const k of ['a', 's', 'ap', 'd', 'sk', 'r', 't']) if (p[k] == null || p[k] === '') add('Waffenwert fehlt', `${tag} → ${w} .${k}`);
      if (p.t !== 'R' && p.t !== 'M') add('Waffentyp unbekannt', `${tag} → ${w}`);
      if ((p.r === 'Melee') !== (p.t === 'M')) add('Reichweite passt nicht zum Typ', `${tag} → ${w} ${p.t}/${p.r}`);
      if (!/^\d\+$|^N\/A$/.test(String(p.sk))) add('BF/KG-Format', `${tag} → ${w} „${p.sk}“`);
      if (!/^-?\d$/.test(String(p.ap)) || +p.ap > 0) add('DS-Format', `${tag} → ${w} „${p.ap}“`);
      if (!dice(p.a)) add('Attacken-Format', `${tag} → ${w} „${p.a}“`); if (!dice(p.d)) add('Schaden-Format', `${tag} → ${w} „${p.d}“`); };
    for (const md of u.models || []) { const lo = md.lo || {}; if (md.min > md.max) add('Modell min > max', tag);
      (lo.fixed || []).forEach(x => (x.w || []).forEach(chk));
      (lo.slots || []).forEach(sl => { if (!sl.opts || !sl.opts.length) add('Slot ohne Optionen', `${tag} ${sl.n}`); if (sl.def != null && !sl.opts.some(o => o.n === sl.def)) add('Slot-Standard nicht in Optionen', `${tag} ${sl.n}`);
        if (sl.max < sl.min) add('Slot max < min', `${tag} ${sl.n}`); sl.opts.forEach(o => (o.w || []).forEach(chk)); });
      (lo.toggles || []).forEach(t => (t.w || []).forEach(chk)); }
    if (!u.allyRule) (u.leads || []).forEach(l => { if (!G.factions.some(F => F.unitIndex[l])) add('Anführer-Ziel existiert nirgends', `${tag} → ${l}`); });
    (u.escalation || []).forEach(z => { if (!(z.add > 0) || !(z.after >= 1)) add('Staffelpreis fehlerhaft', tag); });
    if (u.role === 'transport' && !(u.transport && u.transport.cap > 0)) add('Transporter ohne Kapazität', tag);
    for (let k = 0; k < u.sizes.length; k++) { entries++; try { const e = A.normalizeEntry({ ...A.makeEntry(u.id), sizeIdx: k }); const tot = Object.values(A.modelCounts(e)).reduce((a, b) => a + b, 0);
        if ((u.models || []).length && tot !== u.sizes[k].models && !(u.models.length === 1 && u.models[0].max < u.sizes[k].models)) add('Modellzahl ≠ Truppgröße', `${tag} [${u.sizes[k].models}] → ${tot}`);
        if (anyW && !u.legends && !A.selectedGear(e).length) add('Standard-Eintrag ohne Ausrüstung', tag);
        if (!(A.entryPoints(e) > 0)) add('Eintrag kostet 0', tag);
      } catch (err) { add('Fehler beim Anlegen', `${tag} ${err.message}`); } }
  }
  const dn = new Set((f.detachments || []).map(d => d.name));
  if (!(f.detachments || []).length) add('Fraktion ohne Detachments', f.id);
  for (const d of f.detachments || []) { if (!(d.dp >= 1 && d.dp <= 3)) add('Detachment-Punkte', `${f.id}/${d.name}`); if (!(d.dispositions || []).length) add('Detachment ohne Ausrichtung', `${f.id}/${d.name}`); }
  for (const e of f.enhancements || []) { if (!(e.points >= 0)) add('Enhancement ohne Punkte', `${f.id}: ${e.name}`); if (!dn.has(e.detachment)) add('Enhancement ohne Detachment', `${f.id}: ${e.name}`); }
}
const cats = Object.entries(out);
cats.forEach(([k, v]) => { console.log(`  ${k}: ${v.length}`); v.slice(0, 6).forEach(x => console.log('     ' + x)); });
ok(!cats.length, `Daten vollständig und einheitlich: ${units} Einheiten (inkl. Verbündete), ${weapons} Waffenzuordnungen, ${entries} Standard-Einträge ohne Befund`);

// Regressionsfälle aus der Komplettprüfung
{
  const U = (fid, n) => G.factions.find(f => f.id === fid).units.find(u => en(u) === n);
  A.state.factionId = 'space_marines';
  const anc = A.selectedGear(A.normalizeEntry(A.makeEntry(U('space_marines', 'Ancient in Terminator Armour').id))).flatMap(g => g.weapons || []);
  ok(anc.includes('Storm bolter') && anc.includes('Master-crafted power weapon'), 'Ancient in Terminator Armour trägt Sturmbolter und Energiewaffe als feste Ausrüstung (war: unbewaffnet)');
  const ws = U('agents_of_the_imperium', 'Deathwatch Kill Team').models.find(x => x.n === 'Watch Sergeant').lo.slots;
  ok(ws.length === 2 && ws.every(s => s.min === 1 && s.max === 1 && s.def && s.opts.length === 2), 'Watch Sergeant: je eine Fern- und Nahkampfwaffe (war: 0–4 beliebige Waffen)');
  const vd = U('grey_knights', 'Venerable Dreadnought').models[0].lo.slots;
  ok(vd.length === 2 && vd.every(s => s.min === 1 && s.max === 1), 'Venerable Dreadnought (Grey Knights): zwei Waffenplätze (war: bis zu 5 Waffen)');
}
(async () => {
  // Verbündete mit Enhancement dürfen das 25-%-Limit nicht reißen (Chaos Daemons 1000 P., Saat 320/374 mit Turnierdaten)
  const raw = JSON.parse(fs.readFileSync(__dirname + '/../meta-weights.json', 'utf8'));
  global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(raw)) }); await A.fetchAndCacheMetaWeights({ force: true });
  let bad = 0, n = 0;
  for (const [fid, limit, seeds] of [['chaos_daemons', 1000, [320, 374, 1, 2, 3, 4, 5, 6]], ['chaos_daemons', 2000, [1, 2, 3]], ['genestealer_cults', 1000, [1, 2, 3, 4]], ['genestealer_cults', 2000, [1, 2]]])
    for (const seed of seeds) { A.state.factionId = fid; A.state.limit = limit; A.state.armies[fid] = []; A.state.detachments[fid] = []; A.alState().excluded = {};
      const r = A.runAutoList({ limit, archetype: 'balanced', source: 'catalog', locked: [], seed, useMeta: true }); n++;
      if (!r.ok || A.validate().some(x => x.lvl === 'err')) { bad++; console.log('   ', fid, limit, seed, (A.validate().find(x => x.lvl === 'err') || {}).msg); } }
  ok(!bad, `Verbündeten-Limit hält auch mit Enhancements (${n} Listen)`);
  // Punktlandung mit Turnierdaten: höchstens wenige Listen mit mehr als 25 freien Punkten
  let gaps = 0, lists = 0, errs = 0; const worst = [];
  for (const f of G.factions) for (const limit of [1000, 1500, 2000]) { const fid = f.id; A.state.factionId = fid; A.state.limit = limit; A.state.armies[fid] = []; A.state.detachments[fid] = []; A.alState().excluded = {};
    const r = A.runAutoList({ limit, archetype: 'balanced', source: 'catalog', locked: [], seed: 11, useMeta: true }); if (!r.ok) continue; lists++;
    if (A.validate().some(x => x.lvl === 'err')) errs++; const left = limit - A.armyPoints(); if (left > 25) { gaps++; worst.push(`${fid} ${limit}: ${left}`); } }
  console.log(`   Punktlandung mit Turnierdaten: ${lists} Listen, ${gaps} mit mehr als 25 freien Punkten${worst.length ? ' (' + worst.slice(0, 5).join(', ') + ')' : ''}`);
  ok(!errs && gaps <= Math.ceil(lists * .05), 'Listen mit Turnierdaten: regelkonform und in mindestens 95 % der Fälle höchstens 25 Punkte frei');
  // Orden: Turnierdaten ohne ordensfremde Einheiten
  let foreign = 0; for (const fid of ['space_marines', 'iron_hands', 'salamanders', 'white_scars', 'raven_guard', 'imperial_fists', 'deathwatch', 'ultramarines']) { A.state.factionId = fid; const f = A.faction(); f.units.length; const mf = A.metaFaction(fid);
    (mf && mf.tops || []).forEach(t => { foreign += t.consensus.filter(c => !f.unitIndex[c.u]).length + Object.keys(t.gear || {}).filter(id => !f.unitIndex[id]).length + Object.entries(t.leads || {}).filter(([a, b]) => !f.unitIndex[a] || !f.unitIndex[b]).length; }); }
  ok(foreign === 0, 'Orden sehen in den Sieger-Builds nur Einheiten, die es bei ihnen gibt');
  global.fetch = undefined;
  console.log(fail ? `${fail} Fehler` : 'Datenprüfung: alles grün');
})();

/* v18.20: Listen-Import – Rundreise Export → Import für alle Fraktionen und mehrere Formate
 * (Auspex-Turnierexport EN, Auspex-Chatexport DE, GW-App-Stil, New-Recruit-Kurzform, BattleScribe .ros) */
const A = require('./harness.js');
const { DOMParser } = (() => { try { return require('@xmldom/xmldom'); } catch (_) { return {}; } })();
let lists = 0, ok = 0; const bad = {};
const key = arr => arr.map(e => e.unitId + '#' + e.sizeIdx).sort().join(',');
const gwText = (f, list) => {
  const enOf = (o, k) => (o._i && o._i[k] && o._i[k].en) || o[k];
  const det = A.selectedDetachments().map(id => f.detachments.find(d => d.id === id)).filter(Boolean)[0];
  const out = [`Test List (${A.armyPoints()} Points)`, '', enOf(f, 'name'), det ? enOf(det, 'name') : '', 'Strike Force (2000 Points)', '', 'CHARACTERS', ''];
  list.forEach(e => {
    const u = A.unitDef(e.unitId);
    out.push(`${enOf(u, 'name')} (${u.sizes[e.sizeIdx].points + (e.enhancementId ? f.enhancements.find(x => x.id === e.enhancementId).points : 0)} Points)`);
    if (e.warlord) out.push('  • Warlord');
    const c = A.modelCounts(e);
    Object.entries(c).filter(([, n]) => n).forEach(([m, n]) => { out.push(`  • ${n}x ${m.replace(/\s+w\/.*$/i, '')}`); out.push(`    ◦ ${n}x Bolt pistol`); });
    if (e.enhancementId) { const en = f.enhancements.find(x => x.id === e.enhancementId); out.push(`  • Enhancements: ${enOf(en, 'name')}`); }
    out.push('');
  });
  return out.join('\n');
};
const nrText = (f, list) => {
  const enOf = (o, k) => (o._i && o._i[k] && o._i[k].en) || o[k];
  const det = A.selectedDetachments().map(id => f.detachments.find(d => d.id === id)).filter(Boolean)[0];
  const out = [`++ Army Roster (${enOf(f, 'name')}) [${A.armyPoints()}pts] ++`, `Detachment: ${det ? enOf(det, 'name') : ''}`];
  list.forEach(e => { const u = A.unitDef(e.unitId); const c = A.modelCounts(e);
    const parts = Object.entries(c).filter(([, n]) => n).map(([m, n]) => `${n}x ${m.replace(/\s+w\/.*$/i, '')}`);
    if (e.warlord) parts.unshift('Warlord');
    if (e.enhancementId) parts.push('Enhancement: ' + enOf(f.enhancements.find(x => x.id === e.enhancementId), 'name'));
    out.push(`${enOf(u, 'name')} [${u.sizes[e.sizeIdx].points}pts]: ${parts.join(', ')}`); });
  return out.join('\n');
};
for (const f of A.GAME_DATA.factions) {
  A.state.factionId = f.id; A.state.limit = 2000; A.state.armies[f.id] = []; A.state.detachments[f.id] = [];
  const r = A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 0 }); if (!r.ok) continue;
  const list = A.army().slice(), want = key(list), wantEnh = list.filter(e => e.enhancementId).map(e => e.enhancementId).sort().join(',');
  const wantDet = A.selectedDetachments()[0];
  const formats = { tournamentEN: A.buildTournamentText('en'), gwApp: gwText(f, list), newRecruit: nrText(f, list) };
  for (const [fmt, text] of Object.entries(formats)) {
    lists++;
    const res = A.resolveImport(A.parseImport(text));
    const why = !res.ok ? 'nicht erkannt' : res.f.id !== f.id && !(res.f.id === f.parent || f.parent === res.f.id) ? `Fraktion ${res.f.id}` :
      key(res.entries) !== want ? 'Einheiten/Größen' : res.entries.filter(e => e.enhancementId).map(e => e.enhancementId).sort().join(',') !== wantEnh ? 'Enhancements' :
      wantDet && !res.dets.some(d => d.id === wantDet) ? 'Detachment' : res.entries.filter(e => e.warlord).length !== list.filter(e => e.warlord).length ? 'Kriegsherr' : '';
    if (!why) ok++; else (bad[fmt] = bad[fmt] || []).push(`${f.id}: ${why}${res.misses && res.misses.length ? ' (' + res.misses.slice(0, 2).join('; ') + ')' : ''}`);
  }
}
console.log(`Import-Rundreisen ${lists} | korrekt ${ok}`);
Object.entries(bad).forEach(([k, v]) => { console.log(`  ✗ ${k}: ${v.length}`); v.slice(0, 8).forEach(x => console.log('     ', x)); });
process.exit(ok === lists ? 0 : 1);

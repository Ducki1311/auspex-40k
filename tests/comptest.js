/* v18.18: Zusammensetzung je Truppgröße – Summe = Truppgröße, kein Modelltyp über seinem Maximum, auch nach
 * übergroßer gespeicherter Auswahl (z. B. Wechsel von 10 auf 5 Modelle). */
const A = require('./harness.js');
let checked = 0, sumBad = 0, overMax = 0; const ex = [];
const OK_OVER = new Set(['Tidewall Shieldline']);   // 2er-Staffel ohne zweiten Modelltyp in den Daten
for (const f of A.GAME_DATA.factions) {
  A.state.factionId = f.id;
  for (const u of f.units) {
    if (u.ally) continue;
    for (let i = 0; i < u.sizes.length; i++) {
      const S = u.sizes[i].models;
      const trials = [{}, Object.fromEntries((u.models || []).map(m => ['m|' + m.n, m.max]))].concat((u.models || []).map(m => ({ ['m|' + m.n]: m.max })));
      for (const opt of trials) {
        const e = A.makeEntry(u.id); e.sizeIdx = i; Object.assign(e.options, opt); A.state.armies[f.id] = [e];
        const c = A.modelCounts(e); checked++;
        if (Object.values(c).reduce((a, b) => a + b, 0) !== S) { sumBad++; ex.push(`${f.id}/${u.name} ${S}: Summe`); break; }
        if (!OK_OVER.has(u.name) && (u.models || []).some(m => (c[m.n] || 0) > m.max || (c[m.n] || 0) < 0)) { overMax++; ex.push(`${f.id}/${u.name} ${S}: über Maximum`); break; }
      }
    }
  }
}
console.log(`Zusammensetzung geprüft ${checked} | Summe falsch ${sumBad} | über Maximum ${overMax}`);
ex.slice(0, 10).forEach(x => console.log('  ✗', x));
process.exit(sumBad || overMax ? 1 : 0);

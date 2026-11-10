// Erkundung: Wie gut versteht der Listen-Import der App die Siegerlisten der Meta-Quelle? (nur Protokoll)
const fs = require('fs');
require('./gq_head.js');
const m = new module.constructor();
m._compile(fs.readFileSync(__dirname + '/app.js', 'utf8') + ';module.exports={state,parseImport,resolveImport,unitDef,GAME_DATA,setLanguage};', 'probe.js');
const A = m.exports;
const UA = process.env.UA || 'Auspex40k-MetaSync';
(async () => {
  for (const slug of ['orks', 'necrons', 'space-marines-astartes', 'tyranids', 'world-eaters']) {
    const r = await fetch('https://lexmechanic.com/meta/' + slug + '.json', { headers: { 'user-agent': UA } });
    const d = await r.json(); const rows = d.rows.filter(x => !x.isRtt);
    let ok = 0, cov = 0, wrongF = 0; const miss = {}, fmts = {}, fails = [];
    for (const row of rows) {
      const t = row.listText || '';
      const fmt = /Points de D[ée]tachement|Unités/.test(t) ? 'GW-fr' : /Detachment Points?\)/.test(t) ? 'GW-en' : /^\+\+|\+ FACTION KEYWORD|\+ DETACHMENT/m.test(t) ? 'WTC' : /Char\d|^CHARACTERS?$/mi.test(t) ? 'kompakt' : /Puntos|Destacamento/.test(t) ? 'es' : /Punkte|Kontingent/.test(t) ? 'de' : 'sonst';
      fmts[fmt] = (fmts[fmt] || 0) + 1;
      let res = null; try { res = A.resolveImport(A.parseImport(t)); } catch (e) { res = { ok: false, error: 'EXC ' + e.message }; }
      if (!res || !res.ok) { fails.push(fmt + ': ' + (res && res.error || '?').slice(0, 60)); continue; }
      ok++;
      const pts = res.entries.reduce((s, e) => { const u = A.unitDef(e.unitId); return s + (u ? u.sizes[Math.min(e.sizeIdx || 0, u.sizes.length - 1)].points : 0); }, 0);
      cov += Math.min(1, pts / 2000);
      if (!/ork|necron|marine|tyranid|eater/i.test(res.f.id.replace(/_/g, ' ')) ) wrongF++;
      (res.misses || []).forEach(x => { const k = String(x.name || x).slice(0, 40); miss[k] = (miss[k] || 0) + 1; });
    }
    console.log(`\n== ${slug}: ${d.rows.length} Listen, ${rows.length} GT · erkannt ${ok} (${(100 * ok / rows.length).toFixed(0)} %) · Punkte-Abdeckung ${(100 * cov / Math.max(1, ok)).toFixed(0)} % · andere Fraktion ${wrongF}`);
    console.log('Formate', JSON.stringify(fmts));
    console.log('Fehlschläge', JSON.stringify(Object.entries(fails.reduce((o, x) => (o[x] = (o[x] || 0) + 1, o), {})).slice(0, 6)));
    console.log('häufigste Nichttreffer', Object.entries(miss).sort((a, b) => b[1] - a[1]).slice(0, 25).map(x => x[0] + '×' + x[1]).join(' | '));
    console.log('Felder', [...new Set(rows.map(x => x.detachment))].slice(0, 4), [...new Set(rows.map(x => x.disposition))], rows.map(x => x.startDate).sort()[0], rows.map(x => x.startDate).sort().pop(), 'Runden', [...new Set(rows.map(x => x.numberOfRounds))]);
    if (slug === 'orks') for (const f of ['GW-fr', 'WTC', 'kompakt', 'sonst', 'GW-en']) { const row = rows.find(x => { const t = x.listText || ''; return (f === 'GW-fr' ? /Unités/.test(t) : f === 'WTC' ? /\+ FACTION KEYWORD|^\+\+/m.test(t) : f === 'kompakt' ? /Char\d/.test(t) : f === 'GW-en' ? /Detachment Points?\)/.test(t) : !/Unités|Detachment Points|FACTION KEYWORD|Char\d/.test(t)); }); if (row) console.log(`--- BEISPIEL ${f}\n` + row.listText.split('\n').slice(1).join('\n').slice(0, f === 'GW-en' ? 900 : 1300)); }
  }
})();

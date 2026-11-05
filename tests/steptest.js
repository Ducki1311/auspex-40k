// Prüft: zählen Smart- und Evolutions-Generator die Staffelkosten (2./3./4. Exemplar) korrekt?
const fs = require('fs'); require('./gq_head.js');
const m = new module.constructor();
m._compile(fs.readFileSync(__dirname + '/app.js', 'utf8') + ';module.exports={state,runAutoList,runEvolutionAutoList,army,armyPoints,entryPoints,unitDef,escalationFor,GAME_DATA,faction,validate,complianceIssues,battleSize};', 's.js');
const M = m.exports;
const facs = process.argv[2] ? process.argv[2].split(',') : M.GAME_DATA.factions.filter(f => !f.parent && f.units.some(u => u.escalation)).map(f => f.id);
(async () => {
  let n = 0, bad = 0, escHits = 0, over = 0; const issues = [];
  for (const fid of facs) for (const seed of (process.env.SEEDS||'0,1,2').split(',').map(Number)) for (const arch of (process.env.ARCH||'balanced,horde,elite').split(',')) {
    for (const eng of ['smart', 'ga']) {
      M.state.factionId = fid; M.state.armies[fid] = []; M.state.detachments[fid] = []; M.state.autoList = Object.assign(M.state.autoList || {}, { inventoryLock: false, source: 'catalog' });
      let r;
      try {
        r = eng === 'smart' ? M.runAutoList({ limit: 2000, archetype: arch, source: 'catalog', locked: [], seed })
                            : await M.runEvolutionAutoList({ limit: 2000, seed, archetype: arch, ga: { timeBudgetMs: 400 } });
      } catch (e) { issues.push([fid, eng, 'CRASH', e.message]); continue; }
      if (!r || r.ok === false) { issues.push([fid, eng, arch, seed, 'kein Ergebnis', r && r.reason || r && r.error || '']); continue; }
      n++;
      const real = M.armyPoints();
      const list = M.army();
      const cnt = {}; let esc = 0;
      for (const e of list) { cnt[e.unitId] = (cnt[e.unitId] || 0) + 1; esc += M.escalationFor(M.unitDef(e.unitId), cnt[e.unitId]); }
      if (esc) escHits++;
      const reported = r.points ?? r.total ?? real;
      if (reported !== real) { bad++; issues.push([fid, eng, arch, seed, 'gemeldet', reported, 'echt', real, 'Aufpreise', esc]); }
      const lim = M.battleSize(2000).unitLimit || 3;
      for (const [id, c] of Object.entries(cnt)) { const u = M.unitDef(id); const cap = u.epicHero ? 1 : (u.role === 'battleline' || u.role === 'transport') ? lim * 2 : lim; if (c > cap && !(u.detBattleline)) issues.push([fid, eng, arch, seed, 'ZU VIELE', u.name, c + '/' + cap]); }
      const errs = [...M.validate(), ...M.complianceIssues()].filter(x => x.lvl === 'err'); if (errs.length) issues.push([fid, eng, arch, seed, 'REGELFEHLER', errs.map(x => x.msg).slice(0, 2).join(' / ')]);
      if (real > 2000) { over++; issues.push([fid, eng, arch, seed, 'ÜBER LIMIT', real]); }
    }
  }
  console.log(`Listen ${n} · mit Aufpreisen ${escHits} · falsche Summe ${bad} · über Limit ${over}`);
  issues.slice(0, 25).forEach(x => console.log(' ', x.join(' | ')));
})();

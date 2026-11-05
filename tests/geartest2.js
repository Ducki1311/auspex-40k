// Bezahlte Ausrüstung: Preise in der Punkteberechnung + Generator nutzt sie für Restpunkte
const fs = require('fs'); require('./gq_head.js');
const m = new module.constructor();
m._compile(fs.readFileSync(__dirname + '/app.js', 'utf8') + ';module.exports={state,makeEntry,army,armyPoints,breakdown,faction,runAutoList,runEvolutionAutoList,selectedGear};', 'g2.js');
const M = m.exports; const ok = (c, s) => { console.log((c ? '✓' : '✗') + ' ' + s); if (!c) process.exitCode = 1; };
(async () => {
  M.state.factionId = 'orks'; M.state.detachments.orks = [];
  const mega = M.faction().units.find(u => u.name === 'Meganobz');
  const e = M.makeEntry(mega.id); e.sizeIdx = 0;
  const twin = mega.models.find(x => /Twin Killsaw/.test(x.n));
  M.state.armies.orks = [e];
  const base = M.armyPoints();
  e.options = { ...(e.options || {}), ['m|' + twin.n]: 2 };
  const withSaws = M.armyPoints();
  ok(withSaws - base === 10 || withSaws - base === 2 * 5, `Meganobz: 2× Twin Killsaw → +${withSaws - base} Pkt (MFM: +5 je Modell)`);
  M.state.factionId = 'astra_militarum'; M.state.detachments.astra_militarum = [];
  const lr = M.faction().units.find(u => u.name === 'Leman Russ Battle Tank');
  const opts = lr.models.flatMap(mm => ((mm.lo || {}).slots || []).flatMap(sl => sl.opts.filter(o => o.p > 0).map(o => `${sl.n}: ${o.n} = ${o.p}`)));
  ok(opts.length > 0, 'Leman Russ hat bezahlte Optionen: ' + opts.slice(0, 4).join(' | '));
  // Generator: kauft er bei Restpunkten bezahlte Ausrüstung?
  let paid = 0, lists = 0, over = 0;
  for (const fid of ['astra_militarum', 'space_marines', 'orks', 'chaos_space_marines', 'tau_empire']) for (const seed of [0, 1, 2]) for (const eng of ['smart', 'ga']) {
    M.state.factionId = fid; M.state.armies[fid] = []; M.state.detachments[fid] = [];
    M.state.autoList = Object.assign(M.state.autoList || {}, { inventoryLock: false, source: 'catalog' });
    const r = eng === 'smart' ? M.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed })
                              : await M.runEvolutionAutoList({ limit: 2000, seed, ga: { timeBudgetMs: 400 } });
    if (!r || r.ok === false) continue;
    lists++;
    if (M.armyPoints() > 2000) over++;
    if (M.army().some(x => M.selectedGear(x).some(g => g.points > 0))) paid++;
  }
  ok(over === 0, `Limit gehalten (${lists} Listen)`);
  console.log(`  Listen mit bezahlter Ausrüstung: ${paid}/${lists}`);
})();

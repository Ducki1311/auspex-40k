/* v18.39: 25 %-Verbündete und 50 %-Pakt dürfen auch durch Knapsack (Truppgröße, Tausch, Enhancement) und Turnier-Ausrüstung
 * nicht überschritten werden. Regression: Drukhari 2000, Nahkampf, Seed 667955 hatte 505 von 500 Verbündeten-Punkten. */
const fs = require('fs'); const path = require('path');
require('./gq_head.js');
const m = new module.constructor();
m._compile(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8') + ';module.exports={state,GAME_DATA,runAutoList,validate,armyPoints,alState,fetchAndCacheMetaWeights,alliesPoints,alliesMax,pactPoints,pactMax};', 'verb.js');
const A = m.exports;
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'meta-weights.json'), 'utf8'));
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('✗ ' + msg); } else console.log('✓ ' + msg); };
(async () => {
  global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(raw)) });
  await A.fetchAndCacheMetaWeights({ force: true });
  const run = (fid, limit, archetype, seed, useMeta) => {
    A.state.factionId = fid; A.state.limit = limit; A.state.armies[fid] = []; A.state.detachments[fid] = []; A.alState().excluded = {};
    A.runAutoList({ limit, archetype, source: 'catalog', locked: [], seed, useMeta });
    return { err: A.validate().filter(x => x.lvl === 'err'), ally: A.alliesPoints(), allyMax: A.alliesMax(limit), pact: A.pactPoints(), pactMax: A.pactMax(limit), pts: A.armyPoints() };
  };
  const r = run('drukhari', 2000, 'melee', 667955, true);
  ok(r.ally <= r.allyMax && !r.err.some(e => e.code === 'allies'), `Drukhari-Regression: Verbündete ${r.ally}/${r.allyMax}`);
  let n = 0, bad = [];
  for (const f of A.GAME_DATA.factions) {
    if (!f.units.some(u => u.ally)) continue;
    for (const [limit, arch, seed] of [[2000, 'melee', 11], [2000, 'shooting', 23], [1000, 'balanced', 37]]) {
      const x = run(f.id, limit, arch, seed, true); n++;
      if (x.ally > x.allyMax || x.pact > x.pactMax || x.pts > limit) bad.push(`${f.id} ${limit} ${arch}: Verbündete ${x.ally}/${x.allyMax}, Pakt ${x.pact}/${x.pactMax}, ${x.pts} Pkt`);
    }
  }
  ok(!bad.length, `Verbündeten- und Pakt-Grenzen in ${n} Listen eingehalten` + (bad.length ? ': ' + bad.slice(0, 3).join(' · ') : ''));
  console.log(fails ? `${fails} Fehler` : 'Verbündete in Ordnung');
  process.exit(fails ? 1 : 0);
})();

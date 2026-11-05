const fs = require('fs'); require('./gq_head.js');
const m = new module.constructor();
m._compile(fs.readFileSync(__dirname + '/app.js', 'utf8') + ';module.exports={state,runAutoList,makeEntry,army,armyPoints,entryPoints,unitDef,breakdown,faction,optimizePointsKnapsack,escalationFor};', 's2.js');
const M = m.exports; const ok = (c, s) => console.log((c ? '✓' : '✗') + ' ' + s);
const fid = 'chaos_space_marines'; M.state.factionId = fid; M.state.detachments[fid] = [];
const U = n => M.faction().units.find(u => u.name === n);
const rh = U('Chaos Rhino'), df = U('Defiler');
const mk = (u, i) => M.makeEntry(u.id);
M.state.armies[fid] = [0, 1, 2, 3].map(i => mk(rh, i));
ok(M.armyPoints() === 65 * 3 + 75, `4 Chaos Rhinos = ${M.armyPoints()} (soll ${65 * 3 + 75})`);
console.log('   Aufschlüsselung 4. Rhino:', JSON.stringify(M.breakdown(M.army()[3]).map(r => r.label + ' ' + r.points)));
M.state.armies[fid] = [0, 1].map(i => mk(df, i));
ok(M.armyPoints() === 650, `2 Defiler = ${M.armyPoints()} (soll 650)`);
// Generator: 3 Rhinos fixiert, Rest auffüllen – kostet ein weiterer Rhino 75?
M.state.armies[fid] = [0, 1, 2].map(i => mk(rh, i));
M.state.autoList = Object.assign(M.state.autoList || {}, { inventoryLock: false });
const r = M.runAutoList({ limit: 1000, archetype: 'balanced', source: 'catalog', locked: M.army().map(e => e.uid), seed: 0 });
const n = M.army().filter(e => e.unitId === rh.id).length;
ok(r.points === M.armyPoints() && r.points <= 1000, `Smart mit 3 fixierten Rhinos: gemeldet ${r.points}, echt ${M.armyPoints()}, Rhinos ${n}`);
// Knapsack direkt: Liste mit 3 Rhinos, Pool nur Rhinos, 80 Punkte frei → darf KEINEN 4. Rhino (75) nehmen wenn nur 70 frei
const list3 = [0, 1, 2].map(i => mk(rh, i));
const k = M.optimizePointsKnapsack(list3, [rh], 195 + 70, null, {});
const k4 = (k.list || k.entries || []).filter(e => e.unitId === rh.id).length;
ok(k4 === 3, `Knapsack mit 70 Restpunkten nimmt keinen 4. Rhino (75): ${k4} Rhinos, Punkte ${JSON.stringify(k.points ?? k.total)}`);
const k2 = M.optimizePointsKnapsack(list3, [rh], 195 + 75, null, {});
console.log('   Knapsack bei 75 frei:', (k2.list || k2.entries || []).filter(e => e.unitId === rh.id).length, 'Rhinos,', k2.points ?? k2.total);

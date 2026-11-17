/* v18.38: Tisch-Leiste im Spiel-Modus – Werte, Schnelleingabe, Grenzen, Rückgängig, Uhr in beiden Anzeigen */
const fs = require('fs'); const path = require('path');
require('./gq_head.js');
const m = new module.constructor();
m._compile(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8') + ';module.exports={state,playState,tableBarHTML,tbScoreHTML,tbVP,handleAction,runAutoList,army,setLanguage,clockState};', 'tisch.js');
const A = m.exports;
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('✗ ' + msg); } else console.log('✓ ' + msg); };
const act = (a, data) => A.handleAction(a, { dataset: data, value: '' });

A.state.factionId = 'necrons'; A.state.limit = 2000;
A.runAutoList({ limit: 2000, archetype: 'balanced', source: 'catalog', locked: [], seed: 5, useMeta: false });
A.state.play.necrons = {}; A.state.mode = 'play'; A.state.tab = 'spiel';
ok(A.army().length > 0, 'Liste für das Spiel vorhanden');

let html = A.tableBarHTML([{ id: 'tb-units', label: 'Einheiten' }]);
ok(/data-action="round"/.test(html) && /data-action="cp"/.test(html) && /data-action="tb-score"/.test(html) && /data-action="clock-tap"/.test(html), 'Leiste enthält Runde, CP, Punkte und Uhr');
ok(/href="#tb-units"/.test(html), 'Sprungmarke zum Abschnitt');
ok(/<b>1<i>\/5<\/i><\/b>/.test(html), 'Runde 1 von 5 angezeigt');

act('round', { delta: '1' });
let p = A.playState();
ok(p.round === 2 && p.cp === 1, `Nächste Runde gibt 1 CP (Runde ${p.round}, CP ${p.cp})`);
act('cp', { delta: '1' }); act('cp', { delta: '-1' }); act('cp', { delta: '-1' }); act('cp', { delta: '-1' });
ok(A.playState().cp === 0, 'CP fällt nicht unter 0');

act('tb-vp', { key: 'p', delta: '5', round: '1' }); act('tb-vp', { key: 'p', delta: '1', round: '1' }); act('tb-vp', { key: 'o', delta: '5', round: '1' });
p = A.playState();
ok(p.vp[1].p === 6 && p.vp[1].o === 5, `Schnelleingabe Runde 2: ${p.vp[1].p}:${p.vp[1].o}`);
ok(A.tbVP(p).me === 6 && A.tbVP(p).op === 5, 'Gesamtstand 6:5');
html = A.tableBarHTML([]);
ok(/is-lead/.test(html) && /<b>6<i>:<\/i>5<\/b>/.test(html), 'Leiste zeigt Führung 6:5');
act('tb-vp', { key: 'o', delta: '-1', round: '0' });
ok(A.playState().vp[0].o === 0, 'Punkte fallen nicht unter 0');
for (let i = 0; i < 30; i++) act('tb-vp', { key: 'p', delta: '5', round: '4' });
ok(A.playState().vp[4].p === 99, 'Punkte haben eine Obergrenze');
act('tb-vp', { key: 's', delta: '5', round: '1' }); act('tb-vp', { key: 'p', delta: '5', round: '9' });
ok(A.playState().vp[1].s === 0, 'Sekundärpunkte und ungültige Runden werden nicht verändert');

act('play-undo', {});
ok(A.playState().vp[4].p === 95, `Rückgängig nimmt die letzte Eingabe zurück (${A.playState().vp[4].p})`);

const sc = A.tbScoreHTML(1);
ok(/data-key="p"/.test(sc) && /data-key="o"/.test(sc) && !/data-key="s"/.test(sc), 'Punkte-Dialog: Primär und Gegner eintragbar, Sekundär nur aus dem Missions-Planer');

A.setLanguage('en');
html = A.tableBarHTML([]);
ok(/Round/.test(html) && /Score/.test(html) && !/Runde/.test(html), 'Leiste auf Englisch');
A.setLanguage('de');

const c = A.clockState(); c.active = 'me'; c.since = Date.now() - 65000;
html = A.tableBarHTML([]);
ok(/tb-clk is-active/.test(html) && /1:28:5\d/.test(html), 'Laufende Uhr in der Leiste');

console.log(fails ? `${fails} Fehler` : 'Tisch-Leiste in Ordnung');
process.exit(fails ? 1 : 0);

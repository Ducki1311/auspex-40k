const fs=require('fs'); const src=fs.readFileSync(process.argv[2],'utf8');
const i=src.indexOf('const GAME_DATA = {'); const j=src.indexOf('\n};',i)+2;
const GD=eval('('+src.slice(i+'const GAME_DATA = '.length,j)+')');
// v18.20: Einheiten/Waffen je Fraktion liegen als JSON-Blöcke <script type="application/json" id="gd-…">
for (const m of src.matchAll(/<script type="application\/json" id="gd-([a-z0-9_]+)">([\s\S]*?)<\/script>/g)) {
  const f = GD.factions.find(x => x.id === m[1]); if (!f) continue;
  const raw = JSON.parse(m[2]); f.units = raw.units; f.weapons = raw.weapons; delete f.lazy;
}
const u=GD.factions[0].units[0];
console.log(GD.factions.length, JSON.stringify(u.name), JSON.stringify(GD.factions[0].detachments[0].name).slice(0,120));
const head=`/* Auspex 40k – Datenstamm 11. Edition (Stand 05.11.2026)
 * Quelle: BSData/wh40k-11e (Community-Daten), Commit f015101 vom 11.11.2026, plus Handkorrekturen aus dem
 * Wahapedia-Abgleich (MFM v1.6, Export 30.10.2026) – siehe assets/data/manual-fixes.json.
 * Zweisprachig: Namen von Fraktionen, Detachments, Enhancements, Regeln und Fähigkeiten als { de, en }.
 * Einheiten- und Waffennamen bleiben in beiden Sprachen englisch (Originalnamen, turnierüblich).
 * hasErrata/errataNote: Änderungen aus den MFM-/Faction-Pack-Updates Juli–Oktober 2026.
 * Enthält keine Regeltexte von Games Workshop. */
`;
fs.writeFileSync(process.argv[3], head+'const GAME_DATA = '+JSON.stringify(GD)+';\nif (typeof module !== "undefined") module.exports = GAME_DATA;\n');

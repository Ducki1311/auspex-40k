#!/usr/bin/env node
/* Auspex 40k – Korrektur-Vorschlag des Wahapedia-Abgleichs übernehmen (v18.38)
 *
 *   node .github/scripts/apply-proposal.mjs wahapedia-proposal.json [--dry]
 *
 * Übernimmt nur Namen und Zahlen (Punkte, Staffelpreise, Enhancement-Punkte, Profilwerte,
 * Waffenwerte, Anführer-Ziele) direkt in die Datenblöcke von index.html, ergänzt
 * assets/data/manual-fixes.json, erhöht die Cache-Version (sw.js) und trägt jede Änderung
 * in version.json ein. Danach müssen game-data-11e.js und datasheets.json neu erzeugt werden
 * (tools/data/gd.js, tools/data/dsgen.js) – das erledigt der Workflow.
 * Exit 0 = Änderungen übernommen, 3 = nichts zu übernehmen.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const PROP = process.argv[2];
const DRY = process.argv.includes('--dry');
if (!PROP) { console.error('Aufruf: apply-proposal.mjs <proposal.json> [--dry]'); process.exit(2); }
const P = JSON.parse(fs.readFileSync(PROP, 'utf8'));
const FX = P.fixes || {};
const stand = P.wahapediaStand || P.erstellt || '?';

let html = fs.readFileSync('index.html', 'utf8');
const en = x => (x && typeof x === 'object' ? x.en : x) || '';
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '').replace(/\[legends\]/g, '').replace(/[^a-z0-9]+/g, '');

/* Fraktionsnamen aus dem GAME_DATA-Kopf */
const gi = html.indexOf('const GAME_DATA = {'), gj = html.indexOf('\n};', gi) + 2;
// eslint-disable-next-line no-eval
const GD = (0, eval)('(' + html.slice(gi + 'const GAME_DATA = '.length, gj) + ')');
const facIdByName = Object.fromEntries(GD.factions.map(f => [norm(en(f.name)), f.id]));
const facName = Object.fromEntries(GD.factions.map(f => [f.id, en(f.name)]));

/* Datenblöcke je Fraktion */
const blocks = {};
for (const m of html.matchAll(/<script type="application\/json" id="gd-([a-z0-9_]+)">([\s\S]*?)<\/script>/g)) blocks[m[1]] = { raw: m[0], data: JSON.parse(m[2]), dirty: false };

const changes = [], skipped = [];
const split = key => { const i = key.indexOf('/'); return [key.slice(0, i), key.slice(i + 1)]; };
const findUnit = key => {
  const [fn, un] = split(key);
  const fid = facIdByName[norm(fn)], b = blocks[fid];
  if (!b) return {};
  const u = b.data.units.find(x => norm(en(x.name)) === norm(un));
  return { fid, b, u };
};
const log = (fid, u, field, oldV, newV) => changes.push({ faction: facName[fid] || fid, unit: en(u.name), field, old: oldV, new: newV, source: `Wahapedia-Abgleich (Stand ${stand})` });

for (const [key, list] of Object.entries(FX.sizes || {})) {
  const { fid, b, u } = findUnit(key); if (!u) { skipped.push(['Punkte', key]); continue; }
  const before = u.sizes.map(z => `${z.models}: ${z.points}`).join(', ');
  let hit = 0;
  for (const z of u.sizes) { const w = list.find(x => x.models === z.models); if (w && w.points !== z.points) { z.points = w.points; hit++; } }
  if (hit) { b.dirty = true; log(fid, u, 'Punkte', before, u.sizes.map(z => `${z.models}: ${z.points}`).join(', ')); }
}
for (const [key, esc] of Object.entries(FX.escalation || {})) {
  const { fid, b, u } = findUnit(key); if (!u) { skipped.push(['Staffelpreis', key]); continue; }
  const s = l => (l || []).map(x => `ab ${x.after + 1}. +${x.add}`).join(', ') || '—';
  if (s(u.escalation) === s(esc)) continue;
  const before = s(u.escalation); u.escalation = esc.length ? esc.map(x => ({ after: x.after, add: x.add })) : undefined; if (!esc.length) delete u.escalation;
  b.dirty = true; log(fid, u, 'Staffelpreis', before, s(esc));
}
for (const [key, prof] of Object.entries(FX.stats_patch || {})) {
  const { fid, b, u } = findUnit(key); if (!u) { skipped.push(['Profil', key]); continue; }
  for (const [pn, patch] of Object.entries(prof)) {
    const targets = (u.stats || []).filter(p => pn === '*' || norm(p.n) === norm(pn) || (u.stats.length === 1));
    if (!targets.length) { skipped.push(['Profil', key + ' · ' + pn]); continue; }
    for (const p of targets) {
      const d = Object.entries(patch).filter(([k, v]) => String(p[k] ?? '') !== String(v));
      if (!d.length) continue;
      log(fid, u, 'Profil ' + p.n, d.map(([k]) => `${k.toUpperCase()} ${p[k] ?? '–'}`).join(', '), d.map(([k, v]) => `${k.toUpperCase()} ${v || '–'}`).join(', '));
      for (const [k, v] of d) { if (v === '' && k === 'inv') delete p.inv; else p[k] = v; }
      b.dirty = true;
    }
  }
}
for (const [key, wp] of Object.entries(FX.wpn_patch || {})) {
  const { fid, b, u } = findUnit(key); if (!u) { skipped.push(['Waffe', key]); continue; }
  for (const [wn, patch] of Object.entries(wp)) {
    const base = (u.wpn && u.wpn[wn]) || (b.data.weapons || {})[wn];
    if (!base) { skipped.push(['Waffe', key + ' · ' + wn]); continue; }
    const d = ['a', 'sk', 's', 'ap', 'd', 'r'].filter(k => patch[k] !== undefined && String(base[k] ?? '') !== String(patch[k]));
    if (!d.length) continue;
    log(fid, u, 'Waffe ' + wn, d.map(k => `${k.toUpperCase()} ${base[k] ?? '–'}`).join(', '), d.map(k => `${k.toUpperCase()} ${patch[k]}`).join(', '));
    (u.wpn ||= {})[wn] = { ...base, ...Object.fromEntries(d.map(k => [k, patch[k]])) };
    b.dirty = true;
  }
}
for (const [key, ls] of Object.entries(FX.leads_set || {})) {
  const { fid, b, u } = findUnit(key); if (!u) { skipped.push(['Anführer', key]); continue; }
  const byN = Object.fromEntries(b.data.units.map(x => [norm(en(x.name)), x.id]));
  const nameOf = Object.fromEntries(b.data.units.map(x => [x.id, en(x.name)]));
  const add = (ls.add || []).map(n => byN[norm(n)]).filter(Boolean), rem = new Set((ls.remove || []).map(n => byN[norm(n)]).filter(Boolean));
  if ((ls.add || []).length !== add.length) skipped.push(['Anführer-Ziel unbekannt', key + ' · ' + ls.add.filter(n => !byN[norm(n)]).join(', ')]);
  const before = [...(u.leads || [])];
  const next = [...new Set([...before.filter(id => !rem.has(id)), ...add])];
  if (JSON.stringify(next.slice().sort()) === JSON.stringify(before.slice().sort())) continue;
  u.leads = next; b.dirty = true;
  log(fid, u, 'Anführer für', before.map(id => nameOf[id] || id).join(', ') || '—', next.map(id => nameOf[id] || id).join(', ') || '—');
}

/* Enhancement-Punkte: Zeilen im GAME_DATA-Kopf */
let head = html.slice(gi, gj);
for (const [name, pts] of Object.entries(FX.enhancements || {})) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`("en": "${esc}"\\}, "points": )(\\d+)`, 'g');
  let old = null, n = 0;
  head = head.replace(re, (m, a, p) => { if (+p === pts) return m; old = p; n++; return a + pts; });
  if (n) changes.push({ faction: 'Alle', unit: name, field: 'Enhancement-Punkte', old: String(old), new: String(pts), source: `Wahapedia-Abgleich (Stand ${stand})` });
  else if (!re.test(html.slice(gi, gj))) skipped.push(['Enhancement', name]);
}
html = html.slice(0, gi) + head + html.slice(gj);

for (const [fid, b] of Object.entries(blocks)) {
  if (!b.dirty) continue;
  const json = JSON.stringify(b.data).replace(/<\/script/gi, '<\\/script');
  const tag = `<script type="application/json" id="gd-${fid}">${json}</script>`;
  html = html.replace(b.raw, () => tag);
}

console.log(`Übernommen: ${changes.length} Änderungen · übersprungen: ${skipped.length}`);
for (const c of changes) console.log(`  ${c.faction} · ${c.unit} · ${c.field}: ${c.old} → ${c.new}`);
for (const s of skipped) console.log(`  übersprungen (${s[0]}): ${s[1]}`);
fs.writeFileSync(process.env.SUMMARY_OUT || 'proposal-summary.json', JSON.stringify({ stand, changes, skipped, manual: P.manual || [] }, null, 1));
{
  const cell = x => String(x ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
  const L = [`## Wahapedia-Korrekturen (Stand ${stand})`, '',
    `**${changes.length} Änderungen** werden mit diesem Pull Request übernommen. Mit „Merge“ gehen sie live (App-Cache wird erneuert).`, '',
    'Übernommen werden nur Namen und Zahlen – keine Regeltexte.', '',
    '| Fraktion | Einheit | Feld | bisher | neu |', '|---|---|---|---|---|',
    ...changes.slice(0, 400).map(c => `| ${cell(c.faction)} | ${cell(c.unit)} | ${cell(c.field)} | ${cell(c.old)} | ${cell(c.new)} |`)];
  if (changes.length > 400) L.push('', `… und ${changes.length - 400} weitere (siehe version.json).`);
  const man = P.manual || [];
  if (man.length || skipped.length) {
    L.push('', `### Nicht automatisch übernommen (${man.length + skipped.length})`, '', 'Diese Punkte brauchen eine Handprüfung (z. B. neue Einheiten, andere Truppgrößen):', '');
    for (const m of man.slice(0, 150)) L.push(`- ${cell(m.faction)} · ${cell(m.unit)}${m.weapon ? ' · ' + cell(m.weapon) : ''} (${cell(m.cat)}): ${cell(m.grund)}`);
    for (const x of skipped.slice(0, 50)) L.push(`- übersprungen (${cell(x[0])}): ${cell(x[1])}`);
    if (man.length > 150) L.push(`- … und ${man.length - 150} weitere`);
  }
  L.push('', 'Vor dem Pull Request geprüft: Datenprüfung, Validierung (inkl. CSP), Testreihen.');
  fs.writeFileSync(process.env.PR_MD || 'proposal-pr.md', L.join('\n') + '\n');
}
if (!changes.length) process.exit(3);
if (DRY) process.exit(0);

/* CSP-Hash des App-Skripts neu berechnen (die Enhancement-Punkte stehen im Skript) */
{
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  if (m && csp) {
    const nh = createHash('sha256').update(m[1], 'utf8').digest('base64');
    const ncsp = csp[1].replace(/'sha256-[^']+'/, `'sha256-${nh}'`);
    html = html.replace(csp[0], () => csp[0].replace(csp[1], ncsp));
  }
}
fs.writeFileSync('index.html', html);

/* Handkorrekturen fortschreiben (Quelle für den nächsten vollständigen Neubau) */
const MF = 'assets/data/manual-fixes.json';
const mf = JSON.parse(fs.readFileSync(MF, 'utf8'));
for (const k of ['sizes', 'escalation', 'enhancements', 'leads_set']) for (const [key, v] of Object.entries(FX[k] || {})) (mf[k] ||= {})[key] = v;
for (const k of ['stats_patch', 'wpn_patch']) for (const [key, v] of Object.entries(FX[k] || {})) { const cur = ((mf[k] ||= {})[key] ||= {}); for (const [n, p] of Object.entries(v)) cur[n] = { ...(cur[n] || {}), ...p }; }
fs.writeFileSync(MF, JSON.stringify(mf, null, 1));

/* Cache-Version und Änderungsprotokoll */
let sw = fs.readFileSync('sw.js', 'utf8');
const vm = sw.match(/const VERSION = 'v(\d+)';/);
if (vm) { const nv = +vm[1] + 1; sw = sw.replace(vm[0], `const VERSION = 'v${nv}';`); fs.writeFileSync('sw.js', sw);
  let rd = fs.readFileSync('README.md', 'utf8'); rd = rd.replace(`(aktuell v${vm[1]})`, `(aktuell v${nv})`).replace(`CACHE v${vm[1]}`, `CACHE v${nv}`); fs.writeFileSync('README.md', rd); }
const V = JSON.parse(fs.readFileSync('version.json', 'utf8'));
V.updated = new Date().toISOString().replace(/\.\d+Z$/, '+00:00');
V.dataUpdate = `Wahapedia-Abgleich ${stand}`;
V.changes = [...changes, ...V.changes];
fs.writeFileSync('version.json', JSON.stringify(V, null, 2) + '\n');

#!/usr/bin/env node
/* Probelauf für ein Dataslate (v18.38): verändert gezielt Zahlen in index.html, damit der
 * Wahapedia-Abgleich sie als Abweichung findet und der Korrektur-Vorschlag sie zurücksetzen muss.
 *   node .github/scripts/rehearse-perturb.mjs [anzahl=60]
 * Schreibt rehearse-expected.json (was verändert wurde). Wird nur im Probelauf benutzt, nie committet.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const N = +(process.argv[2] || 60);
let html = fs.readFileSync('index.html', 'utf8');
const en = x => (x && typeof x === 'object' ? x.en : x) || '';
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pickN = (arr, n) => { const a = [...arr], out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };

const gi = html.indexOf('const GAME_DATA = {'), gj = html.indexOf('\n};', gi) + 2;
// eslint-disable-next-line no-eval
const GD = (0, eval)('(' + html.slice(gi + 'const GAME_DATA = '.length, gj) + ')');
const base = new Set(GD.factions.filter(f => !f.parent).map(f => f.id));
const blocks = [];
for (const m of html.matchAll(/<script type="application\/json" id="gd-([a-z0-9_]+)">([\s\S]*?)<\/script>/g)) if (base.has(m[1])) blocks.push({ fid: m[1], raw: m[0], data: JSON.parse(m[2]) });
const ok = u => !u.legends && !u.allyRule && !u.noMfm;
const all = blocks.flatMap(b => b.data.units.filter(ok).map(u => ({ b, u })));
const exp = [];
const q = Math.max(1, Math.round(N / 6));

for (const { b, u } of pickN(all.filter(x => x.u.sizes?.length), q * 3)) { u.sizes[0].points += 5; exp.push(['punkte', b.fid, en(u.name)]); }
for (const { b, u } of pickN(all.filter(x => x.u.escalation?.length), q)) { delete u.escalation; exp.push(['staffelpreise', b.fid, en(u.name)]); }
for (const { b, u } of pickN(all.filter(x => x.u.stats?.length === 1 && /^\d+$/.test(x.u.stats[0].t)), q)) { u.stats[0].t = String(+u.stats[0].t + 1); exp.push(['profile', b.fid, en(u.name)]); }
for (const { b, u } of pickN(all.filter(x => x.u.wpn && Object.values(x.u.wpn).some(w => /^\d\+$/.test(w.sk || ''))), q)) {
  const [wn, w] = Object.entries(u.wpn).find(([, w]) => /^\d\+$/.test(w.sk || ''));
  w.sk = (Math.min(6, +w.sk[0] + 1)) + '+'; exp.push(['waffen', b.fid, en(u.name), wn]);
}
for (const { b, u } of pickN(all.filter(x => (x.u.leads || []).length > 1), q)) { u.leads = u.leads.slice(1); exp.push(['anfuehrer', b.fid, en(u.name)]); }

let head = html.slice(gi, gj);
const enhs = pickN([...new Set(GD.factions.filter(f => base.has(f.id)).flatMap(f => (f.enhancements || []).map(e => en(e.name))))], 3);
for (const name of enhs) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  head = head.replace(new RegExp(`("en": "${esc}"\\}, "points": )(\\d+)`, 'g'), (m, a, p) => a + (+p + 5));
  exp.push(['enhancementPunkte', '*', name]);
}
html = html.slice(0, gi) + head + html.slice(gj);
for (const b of blocks) { const tag = `<script type="application/json" id="gd-${b.fid}">${JSON.stringify(b.data)}</script>`; html = html.replace(b.raw, () => tag); }
const m = html.match(/<script>([\s\S]*?)<\/script>/), csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
if (m && csp) html = html.replace(csp[0], () => csp[0].replace(/'sha256-[^']+'/, `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`));
fs.writeFileSync('index.html', html);
fs.writeFileSync('rehearse-expected.json', JSON.stringify(exp, null, 1));
console.log(`Probelauf: ${exp.length} Zahlen verändert`, Object.entries(exp.reduce((a, e) => (a[e[0]] = (a[e[0]] || 0) + 1, a), {})).map(([k, v]) => `${k} ${v}`).join(', '));

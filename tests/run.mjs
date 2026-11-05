#!/usr/bin/env node
/* Auspex 40k – Testlauf für CI: zieht das App-Skript aus index.html (tests/app.js) und führt alle Testreihen aus.
 * Rot, wenn eine Reihe abbricht oder einen Fehler meldet (✗, „N Fehler“, Regelfehler/über Limit/falsche Summe … > 0). */
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const dir = path.dirname(new URL(import.meta.url).pathname);
const html = fs.readFileSync(path.join(dir, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const app = scripts.sort((a, b) => b.length - a.length)[0];
fs.writeFileSync(path.join(dir, 'app.js'), app);
const only = process.argv.slice(2);
const suites = fs.readdirSync(dir).filter(f => /test\d?\.js$|^fuzz\.js$/.test(f) && (!only.length || only.some(o => f.startsWith(o))));
const BAD = [/✗/, /\b([1-9]\d*) Fehler\b/, /(Regelfehler|über Limit|falsche Summe|ungültige Staffeln|Transport-Fehler in validate|Detachment-Verstöße|Befunde|Punkte-Desync|Anschluss ins Leere|unbekannte Einheit)\s*:?\s*([1-9]\d*)/];
let failed = 0;
for (const s of suites) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, s)], { encoding: 'utf8', timeout: 900000, maxBuffer: 64 << 20 });
  const out = (r.stdout || '') + (r.stderr || '');
  const hits = out.split('\n').filter(l => BAD.some(re => re.test(l)) && !/0 Fehler|Fehler 0/.test(l));
  const ok = r.status === 0 && !hits.length;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${s.padEnd(18)} ${((Date.now() - t0) / 1000).toFixed(1)} s${ok ? '' : '\n    ' + (hits.slice(0, 5).join('\n    ') || out.split('\n').slice(-6).join('\n    '))}`);
}
console.log(failed ? `${failed} Testreihe(n) fehlgeschlagen` : `Alle ${suites.length} Testreihen grün`);
process.exit(failed ? 1 : 0);

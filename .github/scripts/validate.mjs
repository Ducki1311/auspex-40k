// Prüft die Auspex-40K-PWA vor dem Deployment (läuft in GitHub Actions, Node 20+, ohne Abhängigkeiten).
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const errors = [];
const ok = msg => console.log('✓ ' + msg);
const fail = msg => { errors.push(msg); console.log('✗ ' + msg); };
const read = f => readFileSync(f, 'utf8');

// 1) JSON-Dateien
for (const f of ['manifest.webmanifest', 'version.json', 'datasheets.json']) {
  try { JSON.parse(read(f)); ok(`${f} ist gültiges JSON`); } catch (e) { fail(`${f}: ${e.message}`); }
}

// 2) index.html: vollständig, Service-Worker-Kennung, ein Inline-Skript mit passendem CSP-Hash
const html = read('index.html');
html.trimEnd().endsWith('</html>') ? ok('index.html ist vollständig') : fail('index.html endet nicht mit </html>');
html.includes('Auspex 40k') ? ok('Kennung „Auspex 40k“ vorhanden (wird vom Service Worker geprüft)') : fail('Text „Auspex 40k“ fehlt – der Service Worker würde die Seite ablehnen');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const appScript = scripts.find(s => s.includes('AUSPEX 40K'));
if (!appScript) fail('App-Skript nicht gefunden');
else {
  try { new vm.Script(appScript, { filename: 'index.html#app' }); ok(`App-Skript kompiliert (${(appScript.length / 1e6).toFixed(2)} MB)`); }
  catch (e) { fail('Syntaxfehler im App-Skript: ' + e.message); }
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  const hashes = [...csp.matchAll(/'sha256-([^']+)'/g)].map(m => m[1]);
  const missing = scripts.filter(s => !hashes.includes(createHash('sha256').update(s, 'utf8').digest('base64')));
  missing.length ? fail(`${missing.length} Inline-Skript(e) ohne passenden CSP-Hash – die App würde blockiert`) : ok(`CSP-Hashes passen zu allen ${scripts.length} Inline-Skripten`);
}

// 3) Manifest-Icons und Service-Worker-Dateien vorhanden
const manifest = JSON.parse(read('manifest.webmanifest'));
for (const i of manifest.icons || []) existsSync(i.src) ? ok(`Icon ${i.src}`) : fail(`Icon fehlt: ${i.src}`);
const sw = read('sw.js');
const version = (sw.match(/const VERSION = '([^']+)'/) || [])[1];
version ? ok(`Service Worker ${version}`) : fail('VERSION in sw.js nicht gefunden');
const assets = (sw.match(/const ASSETS = \[([\s\S]*?)\];/) || [])[1] || '';
for (const a of [...assets.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean))
  existsSync(a) ? ok(`Offline-Datei ${a}`) : fail(`Offline-Datei fehlt: ${a} (Service-Worker-Installation würde scheitern)`);
try { new vm.Script(sw, { filename: 'sw.js' }); ok('sw.js kompiliert'); } catch (e) { fail('Syntaxfehler in sw.js: ' + e.message); }

// 4) Datenstand
const v = JSON.parse(read('version.json'));
ok(`Daten ${v.dataVersion} · ${v.counts?.units ?? '?'} Einheiten · App ${v.appVersion}`);

if (errors.length) { console.log(`\n${errors.length} Fehler – Deployment abgebrochen.`); process.exit(1); }
console.log('\nAlles in Ordnung – bereit für GitHub Pages.');

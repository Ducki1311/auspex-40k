// Prüft die zusammengestellte Seite (_site): alles, was Service Worker und App zur Laufzeit laden, muss enthalten sein.
import fs from 'node:fs';
const dir = process.argv[2] || '_site';
const sw = fs.readFileSync('sw.js', 'utf8');
const list = n => { const m = sw.match(new RegExp('const ' + n + ' = \\[([\\s\\S]*?)\\];')); return m ? [...m[1].matchAll(/'(\.\/[^']+)'/g)].map(x => x[1]) : []; };
const need = [...new Set([...list('ASSETS'), ...list('DATA_PRELOAD'), './index.html', './sw.js', './meta-weights.json', './assets/data/all_detachments.json'])];
const miss = need.filter(f => !fs.existsSync(dir + '/' + f.slice(2)));
console.log(`geprüft: ${need.length} Dateien in ${dir}`);
if (miss.length) { console.error('FEHLT: ' + miss.join(', ')); process.exit(1); }
const meta = JSON.parse(fs.readFileSync(dir + '/meta-weights.json', 'utf8'));
if (!meta.units || Object.keys(meta.units).length < 50) { console.error('meta-weights.json unvollständig'); process.exit(1); }
JSON.parse(fs.readFileSync(dir + '/assets/data/all_detachments.json', 'utf8'));
console.log(`Meta ${meta.updatedAt}: ${Object.keys(meta.units).length} Einheiten – vollständig.`);

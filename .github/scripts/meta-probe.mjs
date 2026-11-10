// Erkundung der Meta-Datendatei (nur Protokoll, schreibt nichts)
const UA = process.env.UA || 'Auspex40k-MetaSync';
const get = async u => { try { const r = await fetch(u, { headers: { 'user-agent': UA } }); return { status: r.status, type: r.headers.get('content-type') || '', text: await r.text() }; } catch (e) { return { status: 0, type: '', text: String(e) }; } };
const L = 'https://lexmechanic.com';
const shape = (x, d = 0) => { if (Array.isArray(x)) return `[${x.length}× ${x.length ? shape(x[0], d + 1) : ''}]`; if (x && typeof x === 'object') { const ks = Object.keys(x); return d > 3 ? `{${ks.length} keys}` : '{' + ks.slice(0, 25).map(k => k + ':' + shape(x[k], d + 1)).join(', ') + (ks.length > 25 ? ', …' + ks.length : '') + '}'; } return typeof x === 'string' ? `"${x.slice(0, 30)}"` : String(x); };
const r = await get(L + '/meta/index.json'); console.log('index.json', r.status, r.type, r.text.length);
let idx = null; try { idx = JSON.parse(r.text); } catch (e) { console.log(r.text.slice(0, 500)); }
if (idx) { console.log('FORM', shape(idx)); console.log('ROH', JSON.stringify(idx).slice(0, 2500)); }
const js = await get(L + '/_next/static/chunks/3p4zv5t891-fv.js');
for (const m of js.text.matchAll(/\/meta\/[^"'`\s)]{0,80}/g)) console.log('JS-PFAD', m[0], '|', js.text.slice(Math.max(0, m.index - 160), m.index + 200).replace(/\s+/g, ' '));
for (const u of ['/meta/orks.json', '/meta/factions/orks.json', '/meta/lists.json', '/meta/orks/index.json', '/meta/builds.json', '/robots.txt']) { const x = await get(L + u); console.log('TEST', u, x.status, x.type, x.text.length, x.status === 200 ? x.text.slice(0, u.endsWith('.txt') ? 800 : 1200).replace(/\s+/g, ' ') : ''); if (x.status === 200 && /json/.test(x.type)) { try { console.log('FORM', shape(JSON.parse(x.text))); } catch (e) {} } }

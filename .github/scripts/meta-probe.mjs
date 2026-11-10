// Erkundung: Welche Daten gibt die Meta-Quelle für weitere Builds heraus? (nur Protokoll, schreibt nichts)
const UA = process.env.UA || 'Auspex40k-MetaSync';
const get = async u => { try { const r = await fetch(u, { headers: { 'user-agent': UA } }); return { status: r.status, type: r.headers.get('content-type') || '', text: await r.text() }; } catch (e) { return { status: 0, type: '', text: String(e) }; } };
const L = 'https://lexmechanic.com';
const md = await get(L + '/metamerge/orks.md');
const src = md.text.split('## The sources')[1] || '';
console.log('SOURCES', src.split('\n').filter(l => l.startsWith('- ')).length, 'Zeilen'); console.log(src.slice(0, 1500)); console.log('…', src.slice(-900));
for (const u of ['/metamerge?faction=orks', '/metamerge.md?faction=orks', '/metamerge/orks.md?build=2', '/metamerge/orks/2.md', '/listcheck/orks.md', '/listcheck/orks', '/llms.txt', '/sitemap.xml']) {
  const r = await get(L + u); console.log(`\n######## ${u} ${r.status} ${r.type} len=${r.text.length}`);
  if (r.status !== 200) continue;
  if (/markdown|plain|xml/.test(r.type)) { console.log(r.text.slice(0, 3500)); continue; }
  const t = r.text;
  console.log('scripts', [...t.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]).slice(0, 12));
  console.log('json-scripts', [...t.matchAll(/<script[^>]*type="application\/json"[^>]*>/g)].map(m => m[0]).slice(0, 5));
  console.log('links .md/.json/api', [...new Set([...t.matchAll(/["'(]((?:\/[a-z0-9_\-\/]+)?\/[a-z0-9_\-]+\.(?:md|json|rosz)|\/api\/[a-z0-9_\-\/?=&]+)/gi)].map(m => m[1]))].slice(0, 40));
  for (const h of ['Bully Boyz', 'build', 'consensus']) { const i = t.indexOf(h); console.log(`--- ${h} @${i}`, i >= 0 ? t.slice(Math.max(0, i - 300), i + 500).replace(/\s+/g, ' ') : ''); }
  const js = [...t.matchAll(/<script[^>]*src="([^"]+\.js[^"]*)"/g)].map(m => m[1]).slice(0, 8);
  for (const s of js) { const j = await get(s.startsWith('http') ? s : L + s); const hits = [...new Set([...j.text.matchAll(/["'`]((?:\/[a-z0-9_\-]+)+\.(?:json|md)|\/api\/[^"'`\s]{2,60}|\/metamerge\/[^"'`\s]{2,60})["'`]/gi)].map(m => m[1]))]; if (hits.length) console.log('JS', s, hits.slice(0, 30)); }
}

// Meta-Abgleich – Entwicklungsstufe 2: Markdown + NUXT-Daten ausgeben
const UA = process.env.UA || 'Auspex40k-MetaSync';
const get = async u => { const r = await fetch(u, { headers: { 'user-agent': UA } }); return { status: r.status, type: r.headers.get('content-type'), text: await r.text() }; };
for (const u of ['https://lexmechanic.com/metamerge.md', 'https://lexmechanic.com/metamerge/orks.md']) {
  const r = await get(u); console.log(`\n######## ${u} ${r.status} ${r.type} len=${r.text.length}`); console.log(r.text.slice(0, 14000));
}
const r = await get('https://listhammer.info/stats');
const m = r.text.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
console.log('\n######## NUXT len', m && m[1].length);
if (m) { const d = JSON.parse(m[1]); console.log('Einträge', d.length); console.log(JSON.stringify(d.slice(0, 120)).slice(0, 6000));
  const i = d.findIndex(x => x === 'Orks' || (typeof x === 'string' && /^Orks$/i.test(x))); console.log('Orks @', i, JSON.stringify(d.slice(Math.max(0, i - 40), i + 40)));
  const j = d.findIndex(x => x === 'Take and Hold'); console.log('TaH @', j, JSON.stringify(d.slice(Math.max(0, j - 30), j + 30)));
  const keys = d.filter(x => x && typeof x === 'object' && !Array.isArray(x)).slice(0, 60).map(o => Object.keys(o).join(',')); console.log('Objekt-Schlüssel', [...new Set(keys)].join(' | '));
}

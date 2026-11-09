// Meta-Abgleich – Entwicklungsstufe: Struktur ausgeben
const UA = process.env.UA || 'Auspex40k-MetaSync';
const get = async u => { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'text/html,application/json' } }); return { status: r.status, type: r.headers.get('content-type'), text: await r.text() }; };
const strip = h => h.replace(/<script[\s\S]*?<\/script>/g, s => s.length > 400 ? `<script len=${s.length}>${s.slice(8, 300).replace(/\s+/g, ' ')}…</script>` : s).replace(/<style[\s\S]*?<\/style>/g, '<style/>').replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>');
for (const u of ['https://lexmechanic.com/robots.txt', 'https://listhammer.info/robots.txt', 'https://lexmechanic.com/metamerge', 'https://lexmechanic.com/metamerge/orks', 'https://listhammer.info/stats']) {
  const r = await get(u); const t = strip(r.text);
  console.log(`\n######## ${u} ${r.status} ${r.type} len=${r.text.length}`);
  if (u.endsWith('robots.txt')) { console.log(r.text.slice(0, 1500)); continue; }
  const jsons = [...r.text.matchAll(/<script[^>]*(?:application\/(?:ld\+)?json|__NEXT_DATA__|id="__NUXT)[^>]*>/g)].map(m => m[0]);
  console.log('JSON-Skripte:', jsons.slice(0, 10));
  const hits = ['Spine', 'Tankbusta', 'Blitz Brigade', 'Take and Hold', 'Win Rate', 'Orks', 'data-', 'fetch(', '/api/'];
  for (const h of hits) { const i = t.indexOf(h); console.log(`--- ${h} @${i}`); if (i >= 0) console.log(t.slice(Math.max(0, i - 700), i + 900).replace(/\n\s*/g, '\n')); }
}

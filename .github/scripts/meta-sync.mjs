const UA = process.env.UA || 'Auspex40k-MetaSync';
const get = async u => { const r = await fetch(u, { headers: { 'user-agent': UA } }); return { status: r.status, text: await r.text() }; };
const r = await get('https://listhammer.info/stats');
console.log('hrefs', [...new Set([...r.text.matchAll(/href="([^"]*stats[^"]*)"/g)].map(m => m[1]))].slice(0, 30));
console.log('query-like', [...new Set([...r.text.matchAll(/[?&](start|end|from|to|window|period|range|since|weeks|days|rtt|dataslate)[A-Za-z]*=[^"&<\s]*/gi)].map(m => m[0]))].slice(0, 30));
const js = [...r.text.matchAll(/src="(\/_nuxt\/[^"]+\.js)"/g)].map(m => m[1]);
console.log('js', js.length);
for (const s of js) { const t = (await get('https://listhammer.info' + s)).text; const hits = [...t.matchAll(/["'`](\/api\/[^"'`]{2,80})["'`]/g)].map(m => m[1]); const q = [...t.matchAll(/(dataslate|sinceDataslate|startDate|endDate|includeRtt|window)[^,;]{0,80}/gi)].map(m => m[0]); if (hits.length || q.length) console.log(s, [...new Set(hits)].slice(0, 20), [...new Set(q)].slice(0, 12)); }
for (const u of ['https://listhammer.info/api/stats', 'https://listhammer.info/stats?window=dataslate', 'https://listhammer.info/stats?range=4w']) { const x = await get(u); console.log(u, x.status, x.text.slice(0, 300).replace(/\s+/g, ' ')); }

// Auspex 40k – Auswertung der einzelnen Turnier-Siegerlisten (läuft nach meta-sync.mjs im Meta-Abgleich)
//
// Quelle: Lexmechanic Meta Merge, /meta/<fraktion>.json (robots.txt: alles erlaubt) – je Siegerliste Text, Bilanz,
// Detachments, Disposition, Datum. Der Listen-Import der App liest die Texte; gespeichert werden NUR ausgezählte Zahlen
// (Datenblatt-IDs, Anteile, Größenstufen) – keine Spielernamen, keine Listentexte, keine Turniernamen.
//
// Ergebnis:
//   meta-weights.json        factions[f].tops   bis zu 3 Sieger-Builds mit eigener Konsens-Liste und Einheiten-Anteilen
//                            factions[f].builds Detachment-Kombinationen (aus den Listen gezählt), units neu aus Build 1
//   tests/meta-backtest.json Rückblick-Test: „train“ = dieselbe Auswertung nur mit Listen VOR dem Stichtag,
//                            „holdout“ = die Siegerlisten der letzten 14 Tage (anonym, nur Einheiten)
//
// Aufruf: node tests/metalists.js [--fixtures DIR] [--out meta-weights.json] [--backtest tests/meta-backtest.json]
const fs = require('fs'); const path = require('path');
require('./gq_head.js');
const mod = new module.constructor();
mod._compile(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8') + ';module.exports={state,parseImport,resolveImport,GAME_DATA,enOf,normalizeEntry,fetchAndCacheMetaWeights,metaField,listFieldScore};', 'metalists-app.js');
const A = mod.exports;
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const OUT = arg('--out') || path.join(__dirname, '..', 'meta-weights.json');
const BT = arg('--backtest') || path.join(__dirname, 'meta-backtest.json');
const FIX = arg('--fixtures');
const UA = process.env.UA || 'Auspex40k-MetaSync (+https://github.com/Ducki1311/auspex-40k)';
const LEX = 'https://lexmechanic.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOLDOUT_DAYS = 14, MIN_READABLE = 4;

async function getJSON(url, fixName) {
  if (FIX) { const p = path.join(FIX, fixName); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; }
  for (let a = 1; a <= 4; a++) {
    try { const r = await fetch(url, { headers: { 'user-agent': UA } }); if (r.ok) return await r.json(); if (r.status === 404) return null; console.log(`  ${url}: HTTP ${r.status}`); }
    catch (e) { console.log(`  ${url}: ${e.message}`); }
    await sleep(4000 * a);
  }
  return null;
}

const G = A.GAME_DATA;
const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const enName = x => (typeof A.enOf === 'function' ? A.enOf(x, 'name') : null) || (x.name && x.name.en) || x.name;
const FAC_ALIAS = { 'space marines astartes': 'space_marines', 'genestealer cult': 'genestealer_cults', 'imperial agents': 'agents_of_the_imperium', 't au empire': 'tau_empire' };
const facFor = name => { const n = norm(name); return G.factions.find(f => f.id === FAC_ALIAS[n]) || G.factions.find(f => norm(enName(f)) === n) || null; };
const family = f => [f, ...G.factions.filter(x => x.parent === f.id)];
function detId(f, name) {
  const n = norm(name);
  for (const F of [...family(f), ...G.factions]) { const d = (F.detachments || []).find(d => norm(enName(d)) === n); if (d) return d.id; }
  return null;
}
const ptsOf = (F, e) => { const u = F.unitIndex[e.unitId]; return u ? u.sizes[Math.min(e.sizeIdx | 0, u.sizes.length - 1)].points : 0; };
const mode = arr => { const c = new Map(); arr.forEach(x => c.set(x, (c.get(x) || 0) + 1)); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0]; };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Eine Zeile der Quelle → { date, w, l, d, dets, disp, e:[{u,k,enh,wl,p}] } oder null (nicht lesbar) */
function parseRow(f, row) {
  const dets = String(row.detachment || '').split('|').map(s => detId(f, s.trim())).filter(Boolean).sort();
  const base = { date: String(row.startDate || '').slice(0, 10), w: +row.wins || 0, l: +row.losses || 0, d: +row.draws || 0, dets, disp: row.disposition || null, e: null };
  let res = null;
  try { A.state.factionId = f.id; A.state.limit = 2000; res = A.resolveImport(A.parseImport(row.listText || ''), { factions: family(f).map(x => x.id) }); } catch (err) { res = null; }
  if (!res || !res.ok) { base.why = 'keine Einheit erkannt'; return base; }
  A.state.factionId = res.f.id;
  base.miss = (res.misses || []).map(m => typeof m === 'string' ? m : (m && (m.name || m.n)) || '').filter(Boolean).slice(0, 12);
  // v18.31: Ausrüstung (nach Regelprüfung durch normalizeEntry) und Anführer-Zuordnung je Eintrag
  const byUid = new Map(res.entries.map(x => [x.uid, x]));
  const gearOf = x => { if (!x.options || !Object.keys(x.options).length) return null;
    try { const c = A.normalizeEntry({ ...x, options: { ...x.options }, attachedTo: null }); const o = {}; Object.keys(c.options || {}).sort().forEach(k => { const v = c.options[k]; if (v != null && v !== 0 && v !== '') o[k] = v; }); return Object.keys(o).length ? JSON.stringify(o) : null; } catch (_) { return null; } };
  const e = res.entries.map(x => ({ u: x.unitId, k: x.sizeIdx | 0, enh: x.enhancementId || null, wl: !!x.warlord, p: ptsOf(res.f, x), o: gearOf(x), to: x.attachedTo && byUid.get(x.attachedTo) ? byUid.get(x.attachedTo).unitId : null })).filter(x => x.p > 0);
  let pts = e.reduce((s, x) => s + x.p, 0);
  if (pts > 2150) {                                                  // v18.32: Liste doppelt im Text (Übersicht + Details)? → jede identische Zeile nur halb so oft
    const seen = new Map(), half = [];
    e.forEach(x => { const k = x.u + '#' + x.k + '#' + (x.enh || ''); const n = (seen.get(k) || 0) + 1; seen.set(k, n); if (n % 2 === 1) half.push(x); });
    const merged = half.map(x => { const twin = e.filter(y => y.u === x.u && y.k === x.k); return { ...x, o: x.o || (twin.find(y => y.o) || {}).o || null, to: x.to || (twin.find(y => y.to) || {}).to || null, wl: twin.some(y => y.wl) && x.wl }; });
    const hp = merged.reduce((s, x) => s + x.p, 0);
    if ([...seen.values()].every(n => n % 2 === 0) && hp >= 1600 && hp <= 2050) { e.length = 0; merged.forEach(x => e.push(x)); pts = hp; base.halved = true; }
  }
  if (pts > 2150) base.shape = `${e.length} Einträge, ${pts} P., doppelte Zeilen ${e.length - new Set(e.map(x => x.u + '#' + x.k)).size}, größter Eintrag ${Math.max(...e.map(x => x.p))} P.`;
  if (pts < 1600 || pts > 2150 || e.length < 4) { base.why = pts < 1600 ? 'zu wenig erkannt (' + pts + ' P.)' : pts > 2150 ? 'zu viele Punkte' : 'zu wenige Einträge'; return base; }       // unvollständig gelesen (andere Sprache/Format) → nur für die Build-Zählung
  base.e = e; base.fid = res.f.id;
  return base;
}

/** Auswertung einer Menge geparster Listen → { builds, tops, units } */
function summarize(f, rows, ff = 1) {
  const groups = new Map();
  for (const r of rows) { if (!r.dets.length) continue; const k = r.dets.join('+'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const total = rows.length || 1;
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length);
  const builds = sorted.slice(0, 12).map(g => ({ dets: g[0].dets, lists: g.length, share: +(g.length / total).toFixed(3),
    record: { w: g.reduce((s, r) => s + r.w, 0), l: g.reduce((s, r) => s + r.l, 0), d: g.reduce((s, r) => s + r.d, 0) }, disp: mode(g.map(r => r.disp).filter(Boolean)) || null }));
  const tops = [];
  for (const g of sorted) {
    if (tops.length >= 3) break;
    const rd = g.filter(r => r.e);
    if (rd.length < (tops.length ? MIN_READABLE : 3)) continue;
    const stat = new Map();
    rd.forEach(r => { const per = new Map(); r.e.forEach(x => { if (!per.has(x.u)) per.set(x.u, []); per.get(x.u).push(x); });
      per.forEach((xs, u) => { if (!stat.has(u)) stat.set(u, { n: 0, copies: [], ks: [], enh: [], wl: 0, gear: [], to: [], ent: 0 }); const s = stat.get(u); s.n++; s.copies.push(xs.length); xs.forEach(x => { s.ks.push(x.k); s.ent++; if (x.enh) s.enh.push(x.enh); if (x.wl) s.wl++; if (x.o) s.gear.push(x.k + '§' + x.o); if (x.to) s.to.push(x.to); }); }); });
    const rates = {}; stat.forEach((s, u) => { rates[u] = +(s.n / rd.length).toFixed(3); });
    const order = [...stat.entries()].sort((a, b) => b[1].n - a[1].n || b[1].wl - a[1].wl);
    // Konsens-Liste: nach Anteil absteigend, typische Anzahl und Größenstufe, bis 2000 Punkte
    const consensus = []; let pts = 0; const usedEnh = new Set();
    const F = G.factions.find(x => x.id === (mode(rd.map(r => r.fid)) || f.id)) || f; A.state.factionId = F.id;
    const wlUnit = order.slice().sort((a, b) => b[1].wl - a[1].wl)[0]; let wlSet = false;
    for (const [u, s] of order) {
      if (s.n / rd.length < .3 && pts >= 1700) break;
      const ud = F.unitIndex[u] || f.unitIndex[u]; if (!ud) continue;
      const k = Math.min(mode(s.ks) | 0, ud.sizes.length - 1), p = ud.sizes[k].points, copies = mode(s.copies) || 1;
      const enh = s.enh.length >= s.n * .5 ? mode(s.enh) : null;
      for (let i = 0; i < copies; i++) {
        if (pts + p > 2000) break;
        const c = { u, k };
        if (i === 0 && enh && !usedEnh.has(enh)) { c.enh = enh; usedEnh.add(enh); }
        if (i === 0 && !wlSet && wlUnit && wlUnit[0] === u && wlUnit[1].wl > 0) { c.warlord = true; wlSet = true; }
        consensus.push(c); pts += p;
      }
    }
    // v18.31: häufigste Ausrüstung je Einheit (nur bei klarer Mehrheit unter den Listen mit lesbarer Ausrüstung) und Anführer → Leibwache
    const gear = {}, gearK = {}, leads = {}; const inCons = new Map(consensus.map(c => [c.u, c.k]));
    stat.forEach((s, u) => {
      if (!inCons.has(u)) return;
      const gs = s.gear.filter(x => +x.split('§')[0] === inCons.get(u)).map(x => x.slice(x.indexOf('§') + 1));
      if (gs.length >= 3) { const m = mode(gs), n = gs.filter(x => x === m).length; if (n / gs.length >= .4 && m.length < 900) { try { gear[u] = JSON.parse(m); } catch (_) { } } }
      // weitere Truppgrößen derselben Einheit (v18.32)
      const byK = new Map(); s.gear.forEach(x => { const k = +x.split('§')[0]; if (k === inCons.get(u)) return; if (!byK.has(k)) byK.set(k, []); byK.get(k).push(x.slice(x.indexOf('§') + 1)); });
      byK.forEach((arr, k) => { if (arr.length < 3) return; const m = mode(arr), n = arr.filter(x => x === m).length; if (n / arr.length >= .4 && m.length < 900) { try { (gearK[u] = gearK[u] || {})[k] = JSON.parse(m); } catch (_) { } } });
      if (s.to.length >= 2 && s.to.length / s.ent >= .4) { const m = mode(s.to), n = s.to.filter(x => x === m).length; if (inCons.has(m) && n / s.to.length >= .5) leads[u] = m; }
    });
    tops.push({ gear, ...(Object.keys(gearK).length ? { gearK } : {}), leads, dets: g[0].dets, disp: mode(g.map(r => r.disp).filter(Boolean)) || null, lists: g.length, readable: rd.length, pts,
      record: { w: g.reduce((s, r) => s + r.w, 0), l: g.reduce((s, r) => s + r.l, 0), d: g.reduce((s, r) => s + r.d, 0) },
      consensus, rates, spine: order.filter(([, s]) => s.n / rd.length >= .8).map(([u]) => u), flex: order.filter(([, s]) => s.n / rd.length >= .35 && s.n / rd.length < .8).map(([u]) => u),
      _copies: Object.fromEntries(order.map(([u, s]) => [u, [Math.min(...s.copies), Math.max(...s.copies)]])) });
  }
  // Einheiten-Gewichte aus Build 1 (gleiche Formel wie meta-sync.mjs)
  const units = {};
  const t = tops[0];
  if (t && t.readable >= MIN_READABLE) {
    const trust = clamp(t.readable / 8, 0, 1);
    for (const [u, share] of Object.entries(t.rates)) {
      const ud = f.unitIndex[u] || G.factions.flatMap(x => x.units).find(x => x.id === u); if (!ud) continue;
      let w = (0.85 + 0.5 * share) * ff; w = 1 + (w - 1) * trust; if (ud.role === 'transport') w = Math.min(w, 1.2);
      units[u] = { weight: +clamp(w, .7, 1.5).toFixed(3), pickRate: share, name: enName(ud), f: f.id, tier: share >= .8 ? 'spine' : share >= .35 ? 'flex' : 'tech', copies: t._copies[u] };
    }
  }
  tops.forEach(x => { delete x._copies; });
  return { builds, tops, units };
}

(async () => {
  const meta = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const index = await getJSON(`${LEX}/meta/index.json`, 'index.json');
  if (!index || !Array.isArray(index.factions)) { console.error('Listen-Quelle nicht erreichbar – meta-weights.json bleibt unverändert.'); process.exit(0); }
  const parsed = {}; let nAll = 0, nRead = 0, maxDate = '';
  const diag = { why: {}, miss: {}, ent: 0, gear: 0, att: 0, shapes: [], halved: 0 };
  for (const it of index.factions) {
    const f = facFor(it.name); if (!f) { console.log('  unbekannte Fraktion', it.name); continue; }
    const d = await getJSON(`${LEX}/meta/${it.slug}.json`, `${it.slug}.json`);
    if (!FIX) await sleep(1200);
    if (!d || !Array.isArray(d.rows)) continue;
    const rows = d.rows.filter(r => !r.isRtt).map(r => parseRow(f, r));
    parsed[f.id] = rows; nAll += rows.length; nRead += rows.filter(r => r.e).length;
    rows.forEach(r => { if (r.date > maxDate) maxDate = r.date; });
    console.log(`  ${f.id.padEnd(24)} ${String(rows.length).padStart(4)} GT-Listen · lesbar ${rows.filter(r => r.e).length}`);
    rows.filter(r => !r.e && r.shape).slice(0, 3).forEach(r => diag.shapes.push(f.id + ': ' + r.shape)); diag.halved += rows.filter(r => r.halved).length;
    rows.filter(r => !r.e).forEach(r => { diag.why[r.why || '?'] = (diag.why[r.why || '?'] || 0) + 1; (r.miss || []).forEach(m => { const k = f.id + ': ' + String(m).slice(0, 40); diag.miss[k] = (diag.miss[k] || 0) + 1; }); });
    rows.filter(r => r.e).forEach(r => { diag.ent += r.e.length; diag.gear += r.e.filter(x => x.o).length; diag.att += r.e.filter(x => x.to).length; });
  }
  if (!FIX && (nAll < 100 || nRead / nAll < .6)) { console.error(`Zu wenige lesbare Listen (${nRead}/${nAll}) – Abbruch, Datei bleibt.`); process.exit(1); }
  const cutoff = new Date(new Date(maxDate + 'T00:00:00Z').getTime() - (HOLDOUT_DAYS - 1) * 864e5).toISOString().slice(0, 10);
  console.log(`Listen ${nAll}, lesbar ${nRead} (${Math.round(100 * nRead / nAll)} %), jüngstes Turnier ${maxDate}, Stichtag Rückblick ${cutoff}`);

  console.log(`Ausrüstung gelesen bei ${diag.gear}/${diag.ent} Einträgen, Anführer zugeordnet: ${diag.att}`);
  console.log('Nicht lesbar – Gründe:', Object.entries(diag.why).map(([k, n]) => k.replace(/\(\d+ P\.\)/, '').trim() + ' ×' + n).reduce((m, x) => { const [k, n] = x.split(' ×'); m[k] = (m[k] || 0) + +n; return m; }, {}));
  console.log(`Doppelt aufgeführte Listen halbiert: ${diag.halved}`); diag.shapes.slice(0, 12).forEach(x => console.log('   zu viele Punkte – ' + x));
  console.log('Wiederkehrende unbekannte Einheiten-Namen in nicht lesbaren Listen (ab 3×):'); Object.entries(diag.miss).filter(x => x[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, n]) => console.log(`   ${String(n).padStart(3)}× ${k}`));
  const ffOf = fid => { const x = meta.factions[fid]; return x && x.winRate != null && x.games >= 60 ? clamp(1 + (x.winRate - 50) * 0.016, .95, 1.08) : 1; };
  const train = { units: {}, factions: {} }, holdout = {};
  let nTops = 0;
  for (const [fid, rows] of Object.entries(parsed)) {
    const f = G.factions.find(x => x.id === fid);
    const live = summarize(f, rows, ffOf(fid));
    const cur = meta.factions[fid] || (meta.factions[fid] = { name: enName(f) });
    if (live.builds.length) cur.builds = live.builds;
    if (live.tops.length) {
      cur.tops = live.tops; nTops += live.tops.length;
      cur.top = { ...(cur.top || {}), ...live.tops[0] };
      if (Object.keys(live.units).length) { for (const [u, x] of Object.entries(meta.units)) if (x.f === fid) delete meta.units[u]; Object.assign(meta.units, live.units); }
    }
    // Rückblick: nur Listen vor dem Stichtag
    const old = rows.filter(r => r.date && r.date < cutoff), fresh = rows.filter(r => r.date >= cutoff && r.e);
    const tr = summarize(f, old, 1);
    if (tr.tops.length) { train.factions[fid] = { rank: cur.rank, share: +(old.length / Math.max(1, Object.values(parsed).reduce((s, x) => s + x.filter(r => r.date < cutoff).length, 0))).toFixed(4), lists: old.length, builds: tr.builds, top: tr.tops[0], tops: tr.tops }; Object.assign(train.units, tr.units); }
    if (fresh.length >= 3) holdout[fid] = fresh.map(r => ({ dets: r.dets, w: r.w, l: r.l, e: r.e.map(x => (x.o || x.to ? [x.u, x.k, x.o || 0, x.to || 0] : [x.u, x.k])) }));
  }
  // Kapitel erben weiterhin von den Space Marines
  for (const [fid, v] of Object.entries(meta.factions)) if (v && v.inherited) meta.factions[fid] = { inherited: v.inherited };
  meta.schema = 3;
  meta.lists = { total: nAll, readable: nRead, latest: maxDate };
  meta.source = String(meta.source || '').replace(/; Einzel-Listen.*$/, '') + `; Einzel-Listen: ${nRead} von ${nAll} GT-Siegerlisten ausgewertet (bis ${maxDate})`;
  fs.writeFileSync(OUT, JSON.stringify(meta));
  fs.writeFileSync(BT, JSON.stringify({ cutoff, latest: maxDate, holdoutDays: HOLDOUT_DAYS, staple: meta.staple, train, holdout }));
  const hN = Object.values(holdout).reduce((s, x) => s + x.length, 0);
  console.log(`${path.basename(OUT)}: ${Object.keys(meta.units).length} Einheiten, ${nTops} Sieger-Builds mit Konsens-Liste · ${path.basename(BT)}: Training ${Object.keys(train.factions).length} Fraktionen, Rückblick ${hN} Listen aus ${Object.keys(holdout).length} Fraktionen`);

  // Prognose-Check: Passt der Schlagabtausch-Index zur echten Bilanz der einzelnen Siegerlisten? (Rangkorrelation je Fraktion, gemittelt)
  try {
    global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(meta)) });
    await A.fetchAndCacheMetaWeights({ force: true });
    const rank = a => { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = []; s.forEach((x, i) => { r[x[1]] = i; }); return r; };
    const corr = (a, b) => { const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n; let sab = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } return sa && sb ? sab / Math.sqrt(sa * sb) : 0; };
    let sum = 0, wsum = 0, n = 0;
    for (const [fid, rows] of Object.entries(parsed)) {
      const f = G.factions.find(x => x.id === fid); const rd = rows.filter(r => r.e && r.w + r.l >= 5); if (rd.length < 8) continue;
      A.state.factionId = fid;
      const xs = [], ys = [];
      for (const r of rd) { const F = G.factions.find(x => x.id === (r.fid || fid)); A.state.factionId = F.id; const ent = r.e.map((x, i) => A.normalizeEntry({ uid: 'p' + i, unitId: x.u, sizeIdx: x.k, options: {}, enhancementId: null, attachedTo: null, warlord: false, open: false }, F)); const s = A.listFieldScore(ent, F); if (s) { xs.push(s.mean); ys.push(r.w / (r.w + r.l)); } }
      if (xs.length < 8) continue;
      const c = corr(rank(xs), rank(ys)); sum += c * xs.length; wsum += xs.length; n++;
    }
    console.log(`PROGNOSE-CHECK: Rangkorrelation Index ↔ Bilanz der Siegerlisten = ${wsum ? (sum / wsum).toFixed(3) : 'n/a'} (${n} Fraktionen, ${wsum} Listen; nur Sieger → enger Wertebereich)`);
  } catch (e) { console.log('PROGNOSE-CHECK übersprungen:', e.message); }
})();

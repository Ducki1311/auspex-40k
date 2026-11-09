// Auspex 40k – Meta-Abgleich
// Liest öffentliche Turnier-Auswertungen und erzeugt meta-weights.json (Schema 2).
//   • Lexmechanic Meta Merge (Markdown-Ausgabe, robots.txt erlaubt alles): Siegerlisten-Anteile je Fraktion,
//     Detachment-Kombinationen, Einheiten-Anteile im größten Build, Konsens-Liste, typische Modellzahlen.
//   • Listhammer Stats (eingebettete Seitendaten): Siegquoten je Fraktion und je Force Disposition
//     (nur das aktuelle Wochenende → wird hier über bis zu 6 Wochenenden gesammelt).
// Übernommen werden nur Zahlen und Zuordnungen zu Datenblatt-IDs – keine Texte, Spielernamen oder Listen.
//
// Aufruf: node .github/scripts/meta-sync.mjs --out meta-weights.json [--fixtures DIR]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const OUT = arg('--out') || 'meta-weights.json';
const FIX = arg('--fixtures');                  // Offline-Entwicklung: <dir>/index.md, <dir>/<slug>.md, <dir>/stats.html
const UA = process.env.UA || 'Auspex40k-MetaSync (+https://github.com/Ducki1311/auspex-40k)';
const LEX = 'https://lexmechanic.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, fixName) {
  if (FIX) { const p = path.join(FIX, fixName); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
  for (let a = 1; a <= 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA } });
      if (r.ok) return await r.text();
      console.log(`  ${url}: HTTP ${r.status}`);
      if (r.status === 404) return null;
    } catch (e) { console.log(`  ${url}: ${e.message}`); }
    await sleep(5000 * a);
  }
  return null;
}

/* ---------- Spieldaten der App ---------- */
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('game-data-11e.js', 'utf8') + '\n;globalThis.__GD = GAME_DATA;', ctx);
const GD = ctx.__GD;
const en = x => (x && typeof x === 'object') ? (x.en || x.de || '') : String(x || '');
const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const FAC = new Map(GD.factions.map(f => [norm(en(f.name)), f]));
const FAC_ALIAS = { 'space marines astartes': 'space_marines', 'genestealer cult': 'genestealer_cults', 'imperial agents': 'agents_of_the_imperium', 'agents of the imperium': 'agents_of_the_imperium', 't au empire': 'tau_empire' };
const facById = id => GD.factions.find(f => f.id === id);
function factionFor(name) { const n = norm(name); return FAC_ALIAS[n] ? facById(FAC_ALIAS[n]) : FAC.get(n) || null; }
// Kapitel (Ultramarines, Imperial Fists …) teilen sich die Space-Marines-Auswertung
const CHAPTERS = GD.factions.filter(f => f.parent === 'space_marines' || /^(ultramarines|imperial_fists|iron_hands|raven_guard|salamanders|white_scars)$/.test(f.id)).map(f => f.id);

const unmatched = [];
function unitIn(f, name, quiet) {
  const n = norm(name);
  const pools = [f, ...(f.parent ? [facById(f.parent)] : []), ...GD.factions];
  for (const F of pools) { if (!F) continue; const u = (F.units || []).find(u => norm(en(u.name)) === n && !u.legends) || (F.units || []).find(u => norm(en(u.name)) === n); if (u) return u; }
  if (!quiet) unmatched.push(`${f.id}: Einheit „${name}“`); return null;
}
// Konsens-Einträge aus frei benannten Listen: „2x Forgefiend with …“, „Angron - Warlord“, „Khârn + 10 Berzerkers“
function consensusUnit(f, raw) {
  let s = raw.replace(/^\d+\s*x\s+/i, '');
  const warlord = /[-–]\s*warlord\b/i.test(s);
  s = s.replace(/\s*[-–]\s*warlord\b.*$/i, '');
  const cands = [s, s.split(/\s+with\s+|\s+w\/\s+|\s+\+\s+|\s*\(|,/i)[0], s.replace(/\s*\[.*?\]/g, '')];
  for (const c of cands) { const u = unitIn(f, c.trim(), true); if (u) return { u, warlord }; }
  if (!/^(GT|RTT|META|Strike Force|Incursion|Onslaught)\b|points?\)?$/i.test(s)) unmatched.push(`${f.id}: Konsens „${raw}“`);
  return null;
}
function detIn(f, name) {
  const n = norm(name);
  for (const F of [f, f.parent && facById(f.parent), ...GD.factions]) { const d = F && (F.detachments || []).find(d => norm(en(d.name)) === n); if (d) return d; }
  unmatched.push(`${f.id}: Detachment „${name}“`); return null;
}
function enhIn(f, name) {
  const n = norm(name.replace(/\((upgrade)\)/i, ''));
  for (const F of [f, f.parent && facById(f.parent), ...GD.factions]) { const e = F && (F.enhancements || []).find(e => norm(en(e.name)) === n); if (e) return e; }
  unmatched.push(`${f.id}: Enhancement „${name}“`); return null;
}
const sizeIdxFor = (u, pts) => { let best = 0, d = 1e9; (u.sizes || []).forEach((s, i) => { const x = Math.abs(s.points - pts); if (x < d) { d = x; best = i; } }); return best; };

/* ---------- Lexmechanic ---------- */
function parseIndex(md) {
  return [...md.matchAll(/^\d+\.\s+\[(.+?)\s+(\d+)\s+lists?\]\(\/metamerge\/([a-z0-9-]+)\)/gm)].map(m => ({ name: m[1], lists: +m[2], slug: m[3] }));
}
function parseFaction(md) {
  const o = {};
  let m;
  if ((m = md.match(/ranks (\d+)\w* of (\d+) factions/))) { o.rank = +m[1]; o.of = +m[2]; }
  if ((m = md.match(/holding ([\d.]+)% of the winning tournament lists the feed carries: (\d+) lists across (\d+) detachment builds/))) { o.share = +m[1] / 100; o.lists = +m[2]; o.buildCount = +m[3]; }
  if ((m = md.match(/Last 2 weeks v prior 2\s+(\w+)\s+(\d+)\s+v\s+(\d+)/))) o.momentum = { trend: m[1].toLowerCase(), recent: +m[2], prior: +m[3] };
  if ((m = md.match(/Feed as of\s+(\d{4}-\d{2}-\d{2})/))) o.feed = m[1];
  o.builds = [];
  for (const r of md.matchAll(/^\|\s*([IVXLC]+)\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(\d+)%\s*\|\s*([\d-]+)\s*\|\s*(.+?)\s*\|/gm)) {
    const rec = r[5].split('-').map(Number);
    o.builds.push({ names: r[2].split(' + ').map(s => s.trim()), lists: +r[3], share: +r[4] / 100, record: { w: rec[0] || 0, l: rec[1] || 0, d: rec[2] || 0 }, disp: r[6] });
  }
  if ((m = md.match(/^(.+?) · (\d+) of (\d+) lists merged/m))) o.top = { name: m[1].trim(), readable: +m[2], lists: +m[3] };
  // Einheiten (Spine / Flex / Tech)
  o.units = [];
  const list = md.split('## The list')[1]?.split('### Consensus list')[0] || '';
  let tier = null;
  for (const line of list.split('\n')) {
    const h = line.match(/^###\s+(Spine|Flex|Tech)/); if (h) { tier = h[1].toLowerCase(); continue; }
    const u = line.match(/^-\s+(\d+)(?:[–-](\d+))?\s+×\s+(.+?)  (.*?)\b(\d+) pts (\d+)\/(\d+) lists/);
    if (u && tier) o.units.push({ tier, copiesMin: +u[1], copiesMax: +(u[2] || u[1]), name: u[3].trim(), tags: u[4].trim(), pts: +u[5], n: +u[6], of: +u[7] });
  }
  // Konsens-Liste
  o.consensus = [];
  const cons = md.split(/META CONSENSUS \(\d+ points\)/)[1]?.split('## The models')[0] || '';
  if ((m = cons.match(/Force Dispositions?:\s*(.+)/))) o.consensusDisp = m[1].trim();
  let cur = null;
  for (const line of cons.split('\n')) {
    const e = line.match(/^([^•◦\s].*?) \((\d+) Points?\)\s*$/);
    if (e) { cur = { name: e[1].trim(), pts: +e[2], enh: null, warlord: false }; o.consensus.push(cur); continue; }
    if (!cur) continue;
    const en_ = line.match(/^•\s*Enhancement:\s*(.+)$/); if (en_) cur.enh = en_[1].trim();
    if (/^•\s*Warlord\s*$/.test(line)) cur.warlord = true;
  }
  // Modelle
  o.models = [];
  for (const r of (md.split('## The models')[1] || '').matchAll(/^\|\s*(.+?)\s*\|\s*(\d+)\/(\d+)\s*\|\s*(\d+)\s*\|/gm)) o.models.push({ name: r[1].replace(/\s+Staple$/, '').trim(), n: +r[2], of: +r[3], models: +r[4] });
  return o;
}

/* ---------- Listhammer (Nuxt-Payload, „devalue“-Format) ---------- */
function decodeNuxt(html) {
  const m = html && html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  const d = JSON.parse(m[1]); const memo = new Map();
  const res = i => {
    if (typeof i !== 'number') return i;
    if (memo.has(i)) return memo.get(i);
    const v = d[i];
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && /^(ShallowReactive|Reactive|Ref|ShallowRef|NuxtError|EmptyRef|EmptyShallowRef)$/.test(v[0])) { const x = res(v[1]); memo.set(i, x); return x; }
      if (v[0] === 'Set' || v[0] === 'Map' || v[0] === 'Date') { memo.set(i, null); return null; }
      const a = []; memo.set(i, a); v.forEach(x => a.push(res(x))); return a;
    }
    if (v && typeof v === 'object') { const o = {}; memo.set(i, o); for (const [k, x] of Object.entries(v)) o[k] = res(x); return o; }
    memo.set(i, v); return v;
  };
  return res(0);
}
function findArrays(root, pred, out = [], seen = new Set()) {
  if (!root || typeof root !== 'object' || seen.has(root)) return out; seen.add(root);
  if (Array.isArray(root)) { if (root.length && root.every(x => x && typeof x === 'object' && pred(x))) out.push(root); root.forEach(x => findArrays(x, pred, out, seen)); }
  else Object.values(root).forEach(x => findArrays(x, pred, out, seen));
  return out;
}

/* ---------- Ablauf ---------- */
const prev = fs.existsSync(OUT) ? (() => { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return {}; } })() : {};
const indexMd = await get(`${LEX}/metamerge.md`, 'index.md');
if (!indexMd) { console.error('Meta Merge nicht erreichbar – Abbruch, alte Datei bleibt.'); process.exit(FIX ? 1 : 0); }
const updated = (indexMd.match(/Updated (\d{4}-\d{2}-\d{2})/) || [])[1] || new Date().toISOString().slice(0, 10);
const totals = indexMd.match(/(\d+) GT winners · (\d+) factions · (\d+) weeks/);
const index = parseIndex(indexMd);
console.log(`Meta Merge ${updated}: ${index.length} Fraktionsseiten, ${totals ? totals[0] : '?'}`);

const lex = {};
for (const it of index) {
  if (!it.lists) continue;
  const f = factionFor(it.name);
  if (!f) { unmatched.push(`Fraktion „${it.name}“`); continue; }
  const md = await get(`${LEX}/metamerge/${it.slug}.md`, `${it.slug}.md`);
  if (!FIX) await sleep(1500);
  if (!md) continue;
  lex[f.id] = { name: it.name, ...parseFaction(md) };
  console.log(`  ${f.id.padEnd(24)} ${String(lex[f.id].lists).padStart(4)} Listen · ${lex[f.id].builds.length} Builds · ${lex[f.id].units.length} Einheiten · Konsens ${lex[f.id].consensus.length}`);
}

// Listhammer: aktuelles Wochenende + Verlauf
const statsHtml = await get('https://listhammer.info/stats', 'stats.html');
const nuxt = decodeNuxt(statsHtml);
let weekend = null;
if (nuxt) {
  const fr = findArrays(nuxt, x => 'faction' in x && 'winRate' in x && 'total' in x)[0] || [];
  const dr = findArrays(nuxt, x => 'disposition' in x && 'winRate' in x && !('opponentDisposition' in x))[0] || [];
  const now = new Date(); const sat = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 1) % 7)));
  weekend = { key: sat.toISOString().slice(0, 10), factions: {}, disp: {} };
  for (const r of fr) { const f = factionFor(r.faction); if (f) weekend.factions[f.id] = { w: +r.wins || 0, l: +r.losses || 0, players: +r.players || 0, eventWins: +r.eventWins || 0, overrep: +r.overrep || 0 }; else unmatched.push(`Listhammer-Fraktion „${r.faction}“`); }
  for (const r of dr) weekend.disp[r.disposition] = { w: +r.wins || 0, l: +r.losses || 0 };
  console.log(`Listhammer ${weekend.key}: ${Object.keys(weekend.factions).length} Fraktionen, ${Object.keys(weekend.disp).length} Dispositions`);
}
const history = [...(prev.history || []).filter(h => !weekend || h.key !== weekend.key), ...(weekend && Object.keys(weekend.factions).length ? [weekend] : [])]
  .sort((a, b) => a.key < b.key ? -1 : 1).slice(-6);
const pool = (pick) => { const o = {}; for (const h of history) for (const [k, v] of Object.entries(pick(h) || {})) { const x = o[k] || (o[k] = { w: 0, l: 0, eventWins: 0 }); x.w += v.w; x.l += v.l; x.eventWins += v.eventWins || 0; } return o; };
const facWR = pool(h => h.factions), dispWR = pool(h => h.disp);
const wr = x => x && x.w + x.l ? +(100 * x.w / (x.w + x.l)).toFixed(1) : null;

/* ---------- Gewichte & Strukturen ---------- */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const units = {}, factions = {};
for (const [fid, L] of Object.entries(lex)) {
  const f = facById(fid);
  const pooled = facWR[fid]; const games = pooled ? pooled.w + pooled.l : 0; const rate = wr(pooled);
  const ff = rate != null && games >= 60 ? clamp(1 + (rate - 50) * 0.016, 0.95, 1.08) : 1;
  const readable = (L.top && L.top.readable) || 0; const trust = clamp(readable / 8, 0, 1);
  for (const x of L.units) {
    const u = unitIn(f, x.name); if (!u) continue;
    const share = x.of ? x.n / x.of : 0;
    let w = (0.85 + 0.5 * share) * ff; w = 1 + (w - 1) * trust;
    if (u.role === 'transport') w = Math.min(w, 1.2);
    w = +clamp(w, 0.7, 1.5).toFixed(3);
    const prevU = units[u.id];
    if (!prevU || share > (prevU.pickRate || 0)) units[u.id] = { weight: w, pickRate: +share.toFixed(3), name: en(u.name), f: fid, tier: x.tier, copies: [x.copiesMin, x.copiesMax] };
  }
  const builds = L.builds.map(b => ({ dets: b.names.map(n => detIn(f, n)?.id).filter(Boolean), names: b.names, lists: b.lists, share: b.share, record: b.record, disp: b.disp }));
  const consensus = L.consensus.map(c => { const cu = consensusUnit(f, c.name); if (!cu) return null; const u = cu.u; if (cu.warlord) c.warlord = true; const e = c.enh ? enhIn(f, c.enh) : null; return { u: u.id, k: sizeIdxFor(u, c.pts), pts: c.pts, ...(e ? { enh: e.id } : {}), ...(c.warlord ? { warlord: true } : {}) }; }).filter(Boolean);
  const models = {}; for (const x of L.models) { const u = unitIn(f, x.name); if (u) models[u.id] = x.models; }
  factions[fid] = {
    name: L.name, rank: L.rank, share: L.share, lists: L.lists, momentum: L.momentum,
    winRate: rate, games, eventWins: pooled ? pooled.eventWins : 0,
    builds: builds.slice(0, 12),
    top: L.top ? { dets: builds[0]?.dets || [], names: builds[0]?.names || [], readable, disp: L.consensusDisp || builds[0]?.disp, consensus, models,
      spine: L.units.filter(x => x.tier === 'spine').map(x => unitIn(f, x.name)?.id).filter(Boolean),
      flex: L.units.filter(x => x.tier === 'flex').map(x => unitIn(f, x.name)?.id).filter(Boolean) } : null,
  };
}
// Kapitel erben die Space-Marines-Auswertung (eigene Builds nur, wenn vorhanden)
for (const c of CHAPTERS) if (!factions[c] && factions.space_marines) factions[c] = { ...factions.space_marines, inherited: 'space_marines' };

const dispositions = {}; for (const [k, v] of Object.entries(dispWR)) dispositions[k] = { winRate: wr(v), games: v.w + v.l };
const out = {
  schema: 2,
  updatedAt: updated,
  metaVersion: `11th Edition – Meta ${updated}`,
  source: `Lexmechanic Meta Merge (listhammer.info: Best Coast Pairings, Tabletop Herald) ${updated}, ${totals ? `${totals[1]} Siegerlisten, ${totals[2]} Fraktionen, ${totals[3]} Wochen` : ''}; Siegquoten Listhammer, ${history.length} Wochenende(n)`,
  method: 'Gewicht = (0.85 + 0.5 × Anteil der lesbaren Siegerlisten des größten Builds) × Fraktions-Faktor 0.95–1.08 (aus Siegquote, ab 60 Spielen); bei < 8 lesbaren Listen Richtung 1.0 gedämpft; Transporter max. 1.20; Bereich 0.70–1.50',
  staple: { minPickRate: 0.75, minWeight: 1.3 },
  units, factions, dispositions, history,
  unmatched: [...new Set(unmatched)].slice(0, 200),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`\n${OUT}: ${Object.keys(units).length} Einheiten, ${Object.keys(factions).length} Fraktionen, ${Object.keys(dispositions).length} Dispositions, ${history.length} Wochenende(n)`);
console.log(`Nicht zugeordnet (${out.unmatched.length}):`); out.unmatched.forEach(x => console.log('  UNM ' + x));
if (Object.keys(units).length < 50) { console.error('Zu wenige Einheiten erkannt – Parser prüfen.'); process.exit(1); }

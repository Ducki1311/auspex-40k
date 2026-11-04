#!/usr/bin/env node
/* ============================================================================
 *  Auspex 40k – Datenimport aus BSData (scripts/fetch-data.js)
 *
 *  Lädt die BattleScribe-Kataloge der Community (github.com/BSData/wh40k-11e),
 *  wandelt sie in kompakte JSON-Dateien um und speichert sie unter assets/data/.
 *
 *  Aufruf:   npm run fetch-data                    → neuester Stand von BSData/wh40k-11e (main)
 *            npm run fetch-data -- --ref c729d46   → bestimmter Commit/Branch/Tag
 *            npm run fetch-data -- --only "Space Marines"
 *            npm run fetch-data -- --local ../wh40k-11e   → vorhandenen Klon statt Download
 *            npm run fetch-data -- --with-text     → Regel-/Fähigkeitstexte mit exportieren (siehe unten)
 *            npm run fetch-data -- --compare       → Punkte mit datasheets.json der App vergleichen
 *            npm run fetch-data -- --git           → direkt per git clone statt GitHub-API (kein Ratenlimit)
 *
 *  Ausgabe (assets/data/):
 *    index.json            Quelle, Commit, Datum, Fraktionsliste, Zähler
 *    <fraktion>.json       Einheiten: Punkte-Staffeln, Staffelkosten, Profile (M T SV W LD OC InSv),
 *                          Keywords, Fraktions-Keywords, Waffen, Fähigkeiten, Modelle & Ausrüstungsoptionen, Leader-Ziele
 *    detachments.json      alle Detachments: Fraktion, DP, Regeln, Force Dispositions
 *    enhancements.json     alle Enhancements: Fraktion, Detachment, Punkte, Upgrade-Flag
 *    stratagems.json       Stratagems – BSData enthält derzeit KEINE Stratagem-Daten, die Datei bleibt leer (mit Hinweis)
 *
 *  Regeltexte: Fähigkeits-, Detachment- und Enhancement-Texte sind Regeltexte von Games Workshop.
 *  Standardmäßig exportiert das Skript nur Namen und Werte (wie die App bisher). Mit --with-text
 *  werden die Texte aus BSData übernommen – nur verwenden, wenn du sie veröffentlichen darfst.
 *
 *  Voraussetzung: Node.js ≥ 18 (globales fetch). Optional GITHUB_TOKEN gegen das API-Ratenlimit.
 *  Hinweis: wh40k-10e speichert die Kataloge als XML (.cat) – dieses Skript liest das JSON-Format
 *  von wh40k-11e. Für die 10. Edition bricht es mit einer klaren Meldung ab.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

/* ---------------------------------------------------------------- Optionen */
const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const CFG = {
  repo: opt('--repo', 'BSData/wh40k-11e'),
  ref: opt('--ref', 'main'),
  local: opt('--local', null),
  only: opt('--only', null),
  out: path.resolve(opt('--out', path.join(__dirname, '..', 'assets', 'data'))),
  cache: path.resolve(opt('--cache', path.join(__dirname, '..', '.cache', 'bsdata'))),
  withText: flag('--with-text'),
  compare: flag('--compare'),
  quiet: flag('--quiet')
};
const log = (...a) => { if (!CFG.quiet) console.log(...a); };

/* ---------------------------------------------------------------- Download */
const GH_HEADERS = { 'User-Agent': 'auspex-40k-fetch-data', Accept: 'application/vnd.github+json',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };

async function get(url, as = 'json', tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: GH_HEADERS });
      if (r.status === 403 && /rate limit/i.test(await r.clone().text())) throw new Error('GitHub-API-Ratenlimit erreicht – GITHUB_TOKEN setzen oder später erneut versuchen.');
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} – ${url}`);
      return as === 'json' ? r.json() : r.text();
    } catch (e) {
      if (i >= tries || /Ratenlimit/.test(e.message)) throw e;
      await new Promise(res => setTimeout(res, 800 * i));
    }
  }
}

/** Kataloge laden: lokal (--local) oder von GitHub (mit Cache je Commit) → { meta, files: {name: json} } */
async function loadCatalogues() {
  if (CFG.local) {
    const dir = path.resolve(CFG.local);
    const names = fs.readdirSync(dir).filter(n => n.endsWith('.json'));
    if (!names.length) die(`Keine .json-Kataloge in ${dir} gefunden.`);
    return { meta: { repo: CFG.repo, ref: 'local', commit: 'local', date: null }, files: Object.fromEntries(names.map(n => [n, JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))])) };
  }
  log(`⇣ ${CFG.repo}@${CFG.ref} …`);
  if (flag('--git')) return loadViaGit();
  try { return await loadViaApi(); } catch (e) {
    log(`  GitHub-API nicht erreichbar (${e.message.split(' – ')[0]}) – weiter per git clone …`);
    return loadViaGit();
  }
}

/** Fallback ohne API: flacher git-Klon in den Cache (braucht git im PATH) */
function loadViaGit() {
  const { execFileSync } = require('child_process');
  const dir = path.join(CFG.cache, 'git-' + CFG.repo.replace(/\W+/g, '_'));
  const url = `https://github.com/${CFG.repo}.git`;
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  try {
    if (!fs.existsSync(path.join(dir, '.git'))) {
      fs.mkdirSync(dir, { recursive: true });
      execFileSync('git', ['clone', '--quiet', '--depth', '1', '--branch', CFG.ref, url, dir], { stdio: ['ignore', 'pipe', 'pipe'] });
    } else {
      git('fetch', '--quiet', '--depth', '1', 'origin', CFG.ref);
      git('checkout', '--quiet', '--force', 'FETCH_HEAD');
    }
  } catch (e) {
    // --ref ist ein Commit (kein Branch/Tag): vollständig holen und auschecken
    try { if (!fs.existsSync(path.join(dir, '.git'))) execFileSync('git', ['clone', '--quiet', url, dir]); git('fetch', '--quiet', 'origin'); git('checkout', '--quiet', '--force', CFG.ref); }
    catch (e2) { die(`Download fehlgeschlagen (API und git): ${String(e2.stderr || e2.message).trim()}`); }
  }
  const sha = git('rev-parse', 'HEAD'), date = git('log', '-1', '--format=%cI');
  const names = fs.readdirSync(dir).filter(n => n.endsWith('.json'));
  if (!names.length) {
    if (fs.readdirSync(dir).some(n => /\.(cat|gst)$/.test(n))) die(`${CFG.repo} nutzt das XML-Format (.cat/.gst). Dieses Skript liest das JSON-Format von BSData/wh40k-11e.`);
    die(`Keine Kataloge in ${CFG.repo}@${CFG.ref} gefunden.`);
  }
  return { meta: { repo: CFG.repo, ref: CFG.ref, commit: sha.slice(0, 7), date }, files: Object.fromEntries(names.map(n => [n, JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))])) };
}

/** Standardweg: GitHub-API (Commit + Dateibaum) und raw-Downloads, Cache je Commit */
async function loadViaApi() {
  const commit = await get(`https://api.github.com/repos/${CFG.repo}/commits/${encodeURIComponent(CFG.ref)}`);
  const sha = commit.sha, date = commit.commit?.committer?.date || null;
  const tree = await get(`https://api.github.com/repos/${CFG.repo}/git/trees/${sha}`);
  const entries = (tree.tree || []).filter(t => t.type === 'blob');
  const json = entries.filter(t => t.path.endsWith('.json'));
  if (!json.length) {
    if (entries.some(t => /\.(cat|gst)$/.test(t.path))) die(`${CFG.repo} nutzt das XML-Format (.cat/.gst). Dieses Skript liest das JSON-Format von BSData/wh40k-11e.`);
    die(`Keine Kataloge in ${CFG.repo}@${CFG.ref} gefunden.`);
  }
  const dir = path.join(CFG.cache, sha.slice(0, 12));
  fs.mkdirSync(dir, { recursive: true });
  const files = {};
  let done = 0;
  // parallel, aber höflich (6 gleichzeitig)
  const queue = [...json];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const t = queue.shift();
      const file = path.join(dir, t.path);
      let text;
      if (fs.existsSync(file)) text = fs.readFileSync(file, 'utf8');
      else {
        text = await get(`https://raw.githubusercontent.com/${CFG.repo}/${sha}/${t.path.split('/').map(encodeURIComponent).join('/')}`, 'text');
        fs.writeFileSync(file, text);
      }
      files[path.basename(t.path)] = JSON.parse(text);
      if (!CFG.quiet) process.stdout.write(`\r  ${++done}/${json.length} Dateien`);
    }
  }));
  log('');
  return { meta: { repo: CFG.repo, ref: CFG.ref, commit: sha.slice(0, 7), date }, files };
}

function die(msg) { console.error('✗ ' + msg); process.exit(1); }

/* ---------------------------------------------------------------- Index über alle Kataloge */
const PT_NAME = 'pts';
let PT = '51b2-306e-1021-d207';            // Kostentyp „pts“ (wird aus dem Spielsystem gelesen)
const idx = new Map(), catName = new Map(), catById = new Map();
let cats = {};

function buildIndex(files) {
  cats = {};
  for (const [name, raw] of Object.entries(files)) {
    const c = raw.catalogue || raw.gameSystem || Object.values(raw)[0];
    cats[name] = c; catById.set(c.id, c);
    (c.costTypes || []).forEach(ct => { if (ct.name === PT_NAME) PT = ct.id; });
  }
  const walk = o => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (o.id && !idx.has(o.id)) idx.set(o.id, o);
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
  };
  Object.values(cats).forEach(walk);
  Object.values(cats).forEach(c => (c.categoryEntries || []).forEach(ce => catName.set(ce.id, ce.name)));
}

/* ---------------------------------------------------------------- Grundbausteine */
// Kreuzzugs-/Verwaltungseinträge herausfiltern – echte Datenblätter (Crusader Squad, Land Raider Crusader,
// Purgation Squad, Relic Razorback …) ausdrücklich NICHT
const CRUSADE = /crusade(?!rs?\b| ancient)|battle tall|battle honour|battle scar|weapon modif|relic(?! razorback| terminator| contemptor)|rank\b|order of battle|agenda|experience|blackstone|battle trait|requisition|show\/hide|planet power|commendation|logistics|purgation(?! squad)|diplomatic|military power|honour point|combat elixir|^warlord$|enhancements?$|detachment/i;
const SKIP_CAT = /library|titanicus|unaligned|warhammer 40,000/i;
const ptsOf = o => (o.costs || []).find(c => c.typeId === PT)?.value || 0;
const costNamed = (o, n) => (o.costs || []).find(c => c.name === n)?.value || 0;
const hidden = o => !!o.hidden;
function cons(o, field = 'selections') {
  let mn = null, mx = null;
  (o.constraints || []).forEach(c => {
    if (c.field !== field || !['parent', 'self'].includes(c.scope)) return;
    if (c.type === 'min') mn = c.value;
    if (c.type === 'max') mx = c.value;
  });
  return [mn, mx];
}
function resolve(link) {
  const t = idx.get(link.targetId);
  if (!t) return null;
  const m = { ...t };
  if (link.constraints) m.constraints = [...(t.constraints || []), ...link.constraints];
  if (link.costs && ptsOf(link)) m.costs = link.costs;
  if (link.modifiers) m.modifiers = [...(t.modifiers || []), ...link.modifiers];
  if (link.hidden) m.hidden = true;
  m._linkName = link.name;
  m._linkCats = link.categoryLinks || [];
  return m;
}
function children(o) {
  const out = [];
  (o.selectionEntries || []).forEach(se => out.push(['entry', se]));
  (o.selectionEntryGroups || []).forEach(g => out.push(['group', g]));
  (o.entryLinks || []).forEach(el => { const t = resolve(el); if (t) out.push([el.type === 'selectionEntryGroup' ? 'group' : 'entry', t]); });
  return out;
}
const chars = p => Object.fromEntries((p.characteristics || []).map(c => [c.name, c.$text ?? '']));
function collectProfiles(o, seen = new Set(), depth = 0) {
  const res = [];
  if (depth > 8) return res;
  (o.profiles || []).forEach(p => res.push(p));
  (o.infoLinks || []).forEach(il => {
    const t = idx.get(il.targetId);
    if (t && il.type === 'profile') res.push(t);
    else if (t && il.type === 'infoGroup') res.push(...collectProfiles(t, seen, depth + 1));
  });
  for (const [, ch] of children(o)) {
    if (CRUSADE.test(ch.name || '') || hidden(ch) || seen.has(ch.id)) continue;
    seen.add(ch.id);
    res.push(...collectProfiles(ch, seen, depth + 1));
  }
  return res;
}
const label = o => String(o._linkName || o.name || '').trim();
const isModel = o => o.type === 'model';
function hasModelDesc(o, depth = 0) {
  if (depth > 3) return false;
  return children(o).some(([k, ch]) => isModel(ch) || ((k === 'group' || ch.type === 'upgrade') && hasModelDesc(ch, depth + 1)));
}

/* ---------------------------------------------------------------- Modellbaum & Punkte-Staffeln
 * Wie der App-Konverter: Baum aus Modellen/Gruppen, für jede Modellzahl regelkonform auffüllen,
 * Preis inkl. „set/increment“-Modifikatoren berechnen, daraus die MFM-Staffeln ableiten. */
function mnode(o, kind) {
  let [mn, mx] = cons(o);
  const nomax = kind === 'model' && mx == null;
  if (kind === 'model') { mn = mn || 0; mx = mx ?? Math.max(mn, 1); } else mn = mn || 0;
  const n = { id: o.id, tid: o.targetId, name: label(o), kind, min: mn, max: mx, pts: kind === 'model' ? ptsOf(o) : 0, obj: o, ch: [] };
  if (nomax) n.nomax = true;
  if (kind === 'group') {
    for (const [k, c] of children(o)) {
      if (hidden(c) || CRUSADE.test(label(c))) continue;
      if (isModel(c)) n.ch.push(mnode(c, 'model'));
      else if ((k === 'group' || c.type === 'upgrade') && hasModelDesc(c)) n.ch.push(mnode(c, 'group'));
    }
    if (n.max == null) n.max = n.ch.reduce((s, x) => s + (x.max || 0), 0) || null;
    else if (n.max > 1) for (const x of n.ch) if (x.nomax) x.max = n.max;   // Modelle ohne eigenes max füllen die Gruppe
  }
  return n;
}
function unitTree(u) {
  const root = { id: u.id + '#root', name: u.name, kind: 'group', min: 0, max: null, pts: 0, obj: u, ch: [] };
  if (isModel(u)) { const m = mnode(u, 'model'); m.min = 1; m.max = 1; m.pts = 0; root.ch.push(m); return root; }
  for (const [k, c] of children(u)) {
    if (hidden(c) || CRUSADE.test(label(c))) continue;
    if (isModel(c)) root.ch.push(mnode(c, 'model'));
    else if ((k === 'group' || c.type === 'upgrade') && hasModelDesc(c)) root.ch.push(mnode(c, 'group'));
  }
  return root;
}
const isChoice = g => g.kind === 'group' && g.max === 1 && g.ch.length && g.ch.every(c => c.kind === 'group');
function scenarios(node) {
  if (node.kind === 'model') return [node];
  if (isChoice(node)) return node.ch.flatMap(c => scenarios(c).map(v => ({ ...node, min: 0, max: null, ch: [v] })));
  let combos = [[]];
  for (const c of node.ch) { const vs = scenarios(c); combos = combos.flatMap(cb => vs.map(v => [...cb, v])).slice(0, 64); }
  return combos.map(cb => ({ ...node, ch: cb }));
}
const modelsOf = n => (n.kind === 'model' ? [n] : n.ch.flatMap(modelsOf));
function fill(root, n) {
  const counts = {}, parents = new Map();
  const index = (nd, par) => { parents.set(nd.id, par); (nd.ch || []).forEach(c => index(c, nd)); };
  index(root, null);
  const ms = modelsOf(root);
  ms.forEach(m => { counts[m.id] = m.min; });
  const gsum = g => modelsOf(g).reduce((s, m) => s + (counts[m.id] || 0), 0);
  const withName = x => / w\/ | with /.test(x.name);
  const ensureMin = g => {
    (g.ch || []).forEach(c => { if (c.kind === 'group') ensureMin(c); });
    if (g.kind === 'group' && g.min && gsum(g) < g.min) {
      let need = g.min - gsum(g);
      for (const m of [...modelsOf(g)].sort((a, b) => (/ w\//.test(a.name) - / w\//.test(b.name)) || (b.max || 0) - (a.max || 0))) {
        const add = Math.min(m.max - counts[m.id], need); counts[m.id] += add; need -= add;
        if (!need) break;
      }
    }
  };
  ensureMin(root);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total > n) return null;
  let extra = n - total;
  const room = m => {
    let r = m.max - counts[m.id], p = parents.get(m.id), guard = 0;
    while (p && guard++ < 20) { if (p.kind === 'group' && p.max != null) r = Math.min(r, p.max - gsum(p)); p = parents.get(p.id); }
    return Math.max(r, 0);
  };
  for (const m of [...ms].sort((a, b) => (withName(a) - withName(b)) || ((a.pts > 0) - (b.pts > 0)) || (b.max || 0) - (a.max || 0))) {
    if (!extra) break;
    const add = Math.min(room(m), extra); counts[m.id] += add; extra -= add;
  }
  if (extra) return null;
  const gcount = g => {
    if (g.kind === 'model') return counts[g.id];
    const s = g.ch.reduce((a, c) => a + gcount(c), 0); counts[g.id] = s;
    if (g.tid) counts[g.tid] = s;
    return s;
  };
  gcount(root);
  ms.forEach(m => { if (m.tid) counts[m.tid] = counts[m.id]; });
  return counts;
}
function condEval(c, counts, n, uid) {
  if (c.field !== 'selections' || ['roster', 'force', 'primary-catalogue'].includes(c.scope)) return null;
  const x = c.childId === 'model' ? n : c.childId === uid ? 1 : c.childId in counts ? counts[c.childId] : null;
  if (x == null) return null;
  const v = c.value;
  return { greaterThan: x > v, atLeast: x >= v, lessThan: x < v, atMost: x <= v, equalTo: x === v, notEqualTo: x !== v, instanceOf: true }[c.type] ?? null;
}
function groupEval(g, counts, n, uid) {
  const vals = [...(g.conditions || []).map(c => condEval(c, counts, n, uid)), ...(g.conditionGroups || []).map(sg => groupEval(sg, counts, n, uid))];
  if (!vals.length || vals.some(v => v == null)) return null;
  return (g.type || 'and') === 'and' ? vals.every(Boolean) : vals.some(Boolean);
}
function price(u, models, counts, n) {
  let p = ptsOf(u);   // 'set'-Modifikatoren betreffen nur die Einheitskosten
  const extra = models.reduce((s, m) => s + m.pts * (counts[m.id] || 0), 0);
  for (const m of u.modifiers || []) {
    if (m.field !== PT) continue;
    const cg = m.conditionGroups || [];
    if (cg.some(g => g.localConditionGroups)) continue;                 // Staffelkosten separat
    const ok = m.conditions ? groupEval({ type: 'and', conditions: m.conditions }, counts, n, u.id)
      : cg.length ? groupEval({ type: 'and', conditionGroups: cg }, counts, n, u.id) : null;
    if (!ok) continue;
    if (m.type === 'set') p = m.value; else if (m.type === 'increment') p += m.value; else if (m.type === 'decrement') p -= m.value;
  }
  return p + extra;
}
function unitSizes(u) {
  const root = unitTree(u);
  const pairs = {};
  const stripOpt = nd => nd.kind === 'model' ? (nd.min === 0 && nd.pts > 0 ? { ...nd, max: 0 } : nd) : { ...nd, ch: nd.ch.map(stripOpt) };
  const base = scenarios(root);
  for (const sc of [...base, ...base.map(stripOpt)]) {   // auch ohne optionale Extra-Modelle
    const ms = modelsOf(sc);
    let started = false;
    for (let n = 1; n <= 60; n++) {
      const c = fill(sc, n);
      if (!c) { if (started) break; continue; }
      started = true;
      const p = price(u, ms, c, n);
      if (!(n in pairs) || p < pairs[n]) pairs[n] = p;
    }
  }
  const ns = Object.keys(pairs).map(Number).sort((a, b) => a - b);
  if (!ns.length) return { sizes: [{ models: 1, points: ptsOf(u) }], root };
  const sizes = [];
  ns.forEach((n, i) => { const nx = ns[i + 1]; if (nx == null || pairs[nx] !== pairs[n] || nx !== n + 1) sizes.push({ models: n, points: pairs[n] }); });
  if (sizes[0].models !== ns[0] && pairs[ns[0]] !== sizes[0].points) sizes.unshift({ models: ns[0], points: pairs[ns[0]] });
  return { sizes, root };
}
function escalation(u) {
  const out = [];
  for (const m of u.modifiers || []) {
    if (m.field !== PT || m.type !== 'increment') continue;
    for (const g of m.conditionGroups || []) for (const lg of g.localConditionGroups || [])
      if ((lg.conditions || []).some(c => c.type === 'instanceOf')) out.push({ after: lg.value ?? 1, add: m.value });
  }
  return out;
}

/* ---------------------------------------------------------------- Einheit */
const num = x => { const m = /-?\d+/.exec(String(x ?? '')); return m ? +m[0] : 0; };
function parseUnit(link) {
  const u = resolve(link);
  if (!u || hidden(u) || !['unit', 'model'].includes(u.type)) return null;
  const legends = /\[Legends\]/.test(u.name);
  const name = u.name.replace(/\s*\[Legends\]/, '').trim();
  if (/\[Crucible\]/.test(u.name) || CRUSADE.test(name) || /crusade/i.test(u.comment || link.comment || '')) return null;
  const cats = [...(u.categoryLinks || []), ...(link.categoryLinks || [])].map(cl => cl.name || catName.get(cl.targetId) || '').filter(Boolean);
  if (!cats.length) return null;
  const { sizes, root } = unitSizes(u);
  if (!sizes.length || sizes[0].points <= 0) return null;

  const stats = [], weapons = {}, abilities = [];
  for (const p of collectProfiles(u)) {
    const c = chars(p), tn = p.typeName;
    if (tn === 'Unit') {
      const row = { name: p.name, M: c.M || '', T: c.T || '', SV: c.SV || c.Sv || '', W: c.W || '', LD: c.LD || c.Ld || '', OC: c.OC || '' };
      const inv = c.InSv || c.Inv || '';
      if (/^\d\+/.test(inv)) row.InSv = inv;
      if (!stats.some(s => JSON.stringify(s) === JSON.stringify(row))) stats.push(row);
    } else if (tn === 'Ranged Weapons' || tn === 'Melee Weapons') {
      weapons[p.name] = { type: tn.startsWith('Ranged') ? 'ranged' : 'melee', range: c.Range || 'Melee', A: c.A || '', skill: c.BS || c.WS || '',
        S: c.S || '', AP: c.AP || '', D: c.D || '', keywords: !c.Keywords || c.Keywords === '-' ? [] : c.Keywords.split(/,\s*/) };
    } else if (tn) {
      if (!abilities.some(a => a.name === p.name)) abilities.push(CFG.withText ? { name: p.name, type: tn, text: c.Description || '' } : { name: p.name, type: tn });
    }
  }
  (u.rules || []).forEach(r => { if (!abilities.some(a => a.name === r.name)) abilities.push(CFG.withText ? { name: r.name, type: 'Core', text: r.description || '' } : { name: r.name, type: 'Core' }); });
  (u.infoLinks || []).filter(il => il.type === 'rule').forEach(il => { if (!abilities.some(a => a.name === il.name)) abilities.push(CFG.withText ? { name: il.name, type: 'Core', text: idx.get(il.targetId)?.description || '' } : { name: il.name, type: 'Core' }); });

  // Modelle & Ausrüstungsoptionen (Wahlmöglichkeiten je Modell)
  const models = [];
  const optionsOf = o => children(o).filter(([, c]) => !hidden(c) && !isModel(c) && !CRUSADE.test(label(c))).flatMap(([k, c]) => {
    if (k === 'group') {
      const [mn, mx] = cons(c);
      const choices = children(c).filter(([, x]) => !hidden(x)).map(([, x]) => ({ name: label(x), points: ptsOf(x) || undefined }));
      return choices.length ? [{ group: label(c), min: mn ?? 0, max: mx ?? choices.length, choices }] : [];
    }
    const [mn, mx] = cons(c);
    const ws = collectProfiles(c).filter(p => /Weapons$/.test(p.typeName || '')).map(p => p.name);
    return ws.length || ptsOf(c) ? [{ name: label(c), min: mn ?? 0, max: mx ?? 1, points: ptsOf(c) || undefined }] : [];
  });
  const seenM = new Set();
  const visit = nd => nd.ch.forEach(c => {
    if (c.kind === 'model') {
      if (seenM.has(c.name)) return; seenM.add(c.name);
      models.push({ name: c.name, min: c.min, max: c.max, wargear: optionsOf(c.obj) });
    } else visit(c);
  });
  visit(root);

  const leads = [];
  (u.associations || []).forEach(a => {
    if (!/^(lead|support)/i.test(a.name || '')) return;
    // verschachtelte Bedingungs-Gruppen (or → and → or, z. B. CSM) rekursiv durchsuchen
    const walk = g => { (g.conditions || []).forEach(c => { if (c.type === 'instanceOf' && c.childId) leads.push(c.childId); }); (g.conditionGroups || []).forEach(walk); };
    walk({ conditions: a.conditions || [], conditionGroups: a.conditionGroups || [] });
  });
  const role = cats.includes('Character') ? 'character' : cats.includes('Battleline') ? 'battleline' : cats.includes('Dedicated Transport') ? 'transport'
    : cats.includes('Monster') ? 'monster' : cats.includes('Vehicle') || cats.includes('Fortification') ? 'vehicle' : 'infantry';
  const factionKeywords = cats.filter(c => c.startsWith('Faction: ')).map(c => c.slice(9));
  const keywords = cats.filter(c => !c.startsWith('Faction: '));
  const out = { id: u.id, name, role, points: sizes, keywords, factionKeywords, stats, weapons, abilities, models };
  const esc = escalation(u); if (esc.length) out.escalation = esc;
  if (legends) out.legends = true;
  if (keywords.includes('Epic Hero')) out.epicHero = true;
  if (leads.length) out._leads = leads;
  return out;
}

/* ---------------------------------------------------------------- Fraktionen, Detachments, Enhancements */
const OWN_LIBS = {
  'Aeldari - Aeldari Library': ['Aeldari - Craftworlds', 'Xenos - Aeldari'],
  'Chaos - Daemons Library': ['Chaos - Chaos Daemons'], 'Chaos - Chaos Daemons Library': ['Chaos - Chaos Daemons'],
  'Chaos - Chaos Knights Library': ['Chaos - Chaos Knights'],
  'Imperium - Imperial Knights - Library': ['Imperium - Imperial Knights'],
  'Library - Tyranids': ['Tyranids', 'Xenos - Tyranids'],
  'Imperium - Astra Militarum - Library': ['Imperium - Astra Militarum']
};
const SM_NAME = 'Imperium - Space Marines';
const ownLinks = c => (c.entryLinks || []).filter(el => el.type === 'selectionEntry');
function factionLinks(c) {
  const links = [...ownLinks(c)];
  let parent = null;
  for (const cl of c.catalogueLinks || []) {
    const tc = catById.get(cl.targetId);
    if (!tc) continue;
    if (/Space Marines$/.test(tc.name) && !/Space Marines$/.test(c.name) && /^Imperium/.test(c.name)) { parent = tc.name; continue; }
    if (cl.importRootEntries && (OWN_LIBS[tc.name] || []).includes(c.name)) links.push(...ownLinks(tc));
  }
  return { links, parent };
}
const linkedLibraries = c => (c.catalogueLinks || []).map(cl => catById.get(cl.targetId)).filter(tc => tc && tc.library && !/unaligned|titans|heresy/i.test(tc.name));
const ruleRef = r => (CFG.withText ? { name: r.name, text: r.description || '' } : r.name);

function detachmentsOf(c, factionName) {
  const res = [], det = new Map();
  const roots = ownLinks(c).filter(el => el.name === 'Detachment');
  linkedLibraries(c).forEach(lib => { if ((OWN_LIBS[lib.name] || []).includes(c.name)) roots.push(...ownLinks(lib).filter(el => el.name === 'Detachment')); });
  (c.sharedSelectionEntries || []).forEach(se => { if (se.name === 'Detachment') roots.push({ targetId: se.id }); });
  const DISP = ['Take and Hold', 'Purge the Foe', 'Disruption', 'Reconnaissance', 'Priority Assets'];
  const find = (o, depth = 0) => {
    for (const [, ch] of children(o)) {
      const dp = (ch.costs || []).find(x => x.name === 'Detachment Points');
      if (dp && ch.type === 'upgrade') {
        if (det.has(ch.id)) continue;
        det.set(ch.id, ch.name);
        const rules = [...(ch.rules || []).map(ruleRef), ...(ch.infoLinks || []).filter(il => il.type === 'rule').map(il => ruleRef({ name: il.name, description: idx.get(il.targetId)?.description }))];
        res.push({ id: ch.id, faction: factionName, name: ch.name, dp: dp.value, rules,
          forceDispositions: (ch.categoryLinks || []).map(cl => cl.name || catName.get(cl.targetId)).filter(x => DISP.includes(x)) });
      } else if (depth < 3) find(ch, depth + 1);
    }
  };
  roots.forEach(r => { const t = idx.get(r.targetId); if (t) find(t); });
  // Enhancements
  const detOf = o => {
    const blob = JSON.stringify(o.modifiers || []);
    for (const [id, n] of det) if (blob.includes(id)) return n;
    for (const n of det.values()) { const nm = o.name || ''; if (nm === n || nm.startsWith(n + ' ') || o.comment === n) return n; }
    return null;
  };
  const enh = [];
  const scan = (o, inherited, upgrade) => {
    for (const [kind, ch] of children(o)) {
      if (ch.type === 'upgrade' && (ch.costs || []).some(x => x.name === 'Enhancements' && x.value) && !hidden(ch)) {
        const d = detOf(ch) || inherited;
        if (!d || enh.some(x => x.id === ch.id)) continue;
        const e = { id: ch.id, faction: factionName, detachment: d, name: ch.name, points: ptsOf(ch) };
        if (upgrade) e.upgrade = true;
        if (CFG.withText) e.text = collectProfiles(ch).map(p => chars(p).Description).filter(Boolean).join('\n') || (ch.rules || []).map(r => r.description).join('\n');
        enh.push(e);
      } else if (kind === 'group') scan(ch, detOf(ch) || inherited, upgrade);
    }
  };
  [c, ...linkedLibraries(c)].forEach(src => (src.sharedSelectionEntryGroups || []).forEach(g => { if (/nhancement/.test(g.name || '')) scan(g, null, /pgrade/.test(g.name)); }));
  return { detachments: res, enhancements: enh };
}

const slug = s => s.toLowerCase().replace(/^(imperium|chaos|xenos|aeldari) - /, '').replace(/^adeptus astartes - /, '').replace(/ - library$/, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/* ---------------------------------------------------------------- Hauptprogramm */
/** Kataloge laden und in Fraktionen, Detachments und Enhancements umwandeln (auch für fetch-detachments.js) */
async function collect() {
  if (typeof fetch !== 'function' && !CFG.local) die('Node.js ≥ 18 wird benötigt (globales fetch).');
  const { meta, files } = await loadCatalogues();
  buildIndex(files);

  const factions = [], allDet = [], allEnh = [];
  for (const [file, c] of Object.entries(cats).sort()) {
    if (SKIP_CAT.test(c.name) || c.library) continue;
    if (CFG.only && !CFG.only.toLowerCase().split(',').map(x => x.trim()).some(o => c.name.toLowerCase() === o || c.name.toLowerCase().endsWith(' - ' + o) || slug(c.name) === o)) continue;
    const { links, parent } = factionLinks(c);
    const units = [], seen = new Set();
    for (const el of links) {
      if (el.hidden) continue;
      let u = null;
      try { u = parseUnit(el); } catch (e) { if (!(e instanceof RangeError)) throw e; }
      if (!u || seen.has(u.id)) continue;
      seen.add(u.id); units.push(u);
    }
    // Hauptfraktion = häufigstes Fraktions-Keyword; Einheiten anderer Fraktionen = Verbündete
    const fc = {};
    units.forEach(u => u.factionKeywords.filter(k => !['Imperium', 'Chaos'].includes(k)).forEach(k => { fc[k] = (fc[k] || 0) + 1; }));
    const own = c.name.replace(/^(Imperium|Chaos|Xenos|Aeldari) - /, '').replace(/^Adeptus Astartes - /, '');
    let primary = fc[own] ? own : Object.entries(fc).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (/Adeptus Astartes|Space Marines$/.test(c.name) && fc['Adeptus Astartes']) primary = 'Adeptus Astartes';   // Orden: Fraktions-Keyword Adeptus Astartes
    units.forEach(u => { if (primary && u.factionKeywords.length && !u.factionKeywords.includes(primary)) u.ally = u.factionKeywords.filter(k => !['Imperium', 'Chaos'].includes(k)).join(', '); });
    const { detachments, enhancements } = detachmentsOf(c, own);
    const id = slug(c.name);
    factions.push({ id, name: own, catalogue: c.name, revision: c.revision, parent: parent ? slug(parent) : null, units, file });
    allDet.push(...detachments.map(d => ({ factionId: id, ...d })));
    allEnh.push(...enhancements.map(e => ({ factionId: id, ...e })));
  }
  // Leader-Ziele: Kategorie-/Einheiten-IDs → Einheiten-IDs (inkl. Elternkatalog bei Orden)
  for (const f of factions) {
    const pool = [...f.units, ...(f.parent ? factions.find(x => x.id === f.parent)?.units || [] : [])];
    for (const u of f.units) {
      const ids = new Set();
      (u._leads || []).forEach(cid => {
        if (pool.some(x => x.id === cid)) ids.add(cid);
        else if (catName.has(cid)) pool.filter(x => x.keywords.includes(catName.get(cid)) || x.name === catName.get(cid)).forEach(x => ids.add(x.id));
      });
      delete u._leads;
      if (ids.size) u.leads = [...ids];
    }
  }
  return { meta, factions, allDet, allEnh };
}

async function main() {
  const t0 = Date.now();
  const { meta, factions, allDet, allEnh } = await collect();
  fs.mkdirSync(CFG.out, { recursive: true });

  /* ---------- Schreiben ---------- */
  const write = (name, data) => fs.writeFileSync(path.join(CFG.out, name), JSON.stringify(data) + '\n');
  const stamp = { source: `https://github.com/${meta.repo}`, commit: meta.commit, commitDate: meta.date, generated: new Date().toISOString(), rulesText: CFG.withText };
  factions.forEach(f => write(`${f.id}.json`, { ...stamp, faction: { id: f.id, name: f.name, parent: f.parent, revision: f.revision }, units: f.units }));
  write('detachments.json', { ...stamp, detachments: allDet });
  write('enhancements.json', { ...stamp, enhancements: allEnh });
  write('stratagems.json', { ...stamp, stratagems: [], note: 'BSData/wh40k-11e enthält keine Stratagem-Daten (keine Stratagem-Profile in den Katalogen). Stratagems müssen aus den offiziellen GW-Dokumenten gepflegt werden.' });
  const counts = { factions: factions.length, units: factions.reduce((s, f) => s + f.units.length, 0), detachments: allDet.length, enhancements: allEnh.length, stratagems: 0 };
  write('index.json', { ...stamp, counts, factions: factions.map(f => ({ id: f.id, name: f.name, parent: f.parent, file: `${f.id}.json`, units: f.units.length })) });

  log(`✓ ${counts.factions} Fraktionen · ${counts.units} Einheiten · ${counts.detachments} Detachments · ${counts.enhancements} Enhancements → ${path.relative(process.cwd(), CFG.out) || CFG.out}`);
  log(`  Quelle ${meta.repo}@${meta.commit}${meta.date ? ' (' + meta.date.slice(0, 10) + ')' : ''} · ${((Date.now() - t0) / 1000).toFixed(1)} s${CFG.withText ? ' · mit Regeltexten' : ''}`);
  log('  Hinweis: BSData enthält keine Stratagems – stratagems.json bleibt leer.');

  /* ---------- Optional: Abgleich mit den Punkten der App ---------- */
  if (CFG.compare) {
    const appFile = path.join(__dirname, '..', 'datasheets.json');
    if (!fs.existsSync(appFile)) return log('  (kein datasheets.json zum Vergleichen gefunden)');
    const app = JSON.parse(fs.readFileSync(appFile, 'utf8'));
    const appUnits = new Map(app.factions.flatMap(f => f.units.map(u => [u.id, u])));
    let same = 0, diff = 0, missing = 0; const ex = [];
    factions.forEach(f => f.units.forEach(u => {
      const a = appUnits.get(u.id);
      if (!a) { missing++; return; }
      const ap = (a.sizes || a.pointsCost || []).map(s => `${s.models}:${s.points}`).join('/'), np = u.points.map(s => `${s.models}:${s.points}`).join('/');
      if (ap === np) same++; else { diff++; if (ex.length < 15) ex.push(`  ${f.name}: ${u.name}  App ${ap}  ↔  BSData ${np}`); }
    }));
    log(`\nAbgleich mit datasheets.json: ${same} gleich, ${diff} abweichend, ${missing} nicht in der App`);
    ex.forEach(x => log(x));
  }
}

module.exports = { collect, CFG, idx, catName, chars, collectProfiles, children, log, die };
if (require.main === module) main().catch(e => die(e.stack || e.message));

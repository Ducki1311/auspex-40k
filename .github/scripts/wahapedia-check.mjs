#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 *  Wahapedia-Abgleich für Auspex 40k
 *
 *  Vergleicht game-data-11e.js mit dem öffentlichen Wahapedia-Datenexport
 *  (wh40k11ed/*.csv): Punkte, Staffelpreise (2./3./4. Exemplar), Profile,
 *  Rettungswürfe, Waffenprofile, Ausrüstungspreise, Anführer-Zuordnungen,
 *  Enhancement-Punkte und Detachment-Punkte.
 *
 *  Aufruf: node .github/scripts/wahapedia-check.mjs --waha <csv-ordner> \
 *            [--data game-data-11e.js] [--out report.json] [--md report.md]
 *  Exit-Code 0 immer (Abweichungen stehen im Bericht); 2 bei Ladefehler.
 *  Es werden keine Wahapedia-Daten ins Repository geschrieben.
 * ═════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const WAHA = arg('--waha');
const DATA = arg('--data', 'game-data-11e.js');
const OUT = arg('--out', 'wahapedia-report.json');
const MD = arg('--md', null);
if (!WAHA) { console.error('--waha <ordner> fehlt'); process.exit(2); }

/* ---------- CSV (Trenner |, Anführungszeichen wie RFC 4180) ---------- */
function readCsv(name) {
  const p = path.join(WAHA, name);
  if (!fs.existsSync(p)) return [];
  const txt = fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) {
      if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"' && cur === '') q = true;
    else if (ch === '|') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter(r => r.length > 1 || (head.length === 1 && r[0])).map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/* ---------- Spieldaten laden ---------- */
let G;
try {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(DATA, 'utf8') + ';this.G=GAME_DATA', ctx);
  G = ctx.G;
} catch (e) { console.error('game-data konnte nicht geladen werden:', e.message); process.exit(2); }

const en = x => (x && typeof x === 'object' ? x.en : x) || '';
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '').replace(/\[legends\]/g, '').replace(/[^a-z0-9]+/g, '');
const num = s => { const m = String(s ?? '').match(/-?\d+/); return m ? +m[0] : null; };
const strip = s => String(s ?? '').replace(/<[^>]+>/g, '').trim();

/* ---------- Wahapedia-Tabellen ---------- */
const W = {
  factions: readCsv('Factions.csv'),
  sheets: readCsv('Datasheets.csv'),
  models: readCsv('Datasheets_models.csv'),
  cost: readCsv('Datasheets_models_cost.csv'),
  leader: readCsv('Datasheets_leader.csv'),
  wargear: readCsv('Datasheets_wargear.csv'),
  keywords: readCsv('Datasheets_keywords.csv'),
  enh: readCsv('Enhancements.csv'),
  dets: readCsv('Detachments.csv'),
  source: readCsv('Source.csv'),
  last: readCsv('Last_update.csv'),
};
if (!W.sheets.length || !W.cost.length) { console.error('Wahapedia-CSV fehlen oder leer'); process.exit(2); }
const by = (rows, k) => rows.reduce((m, r) => ((m[r[k]] ||= []).push(r), m), {});
const modelsBy = by(W.models, 'datasheet_id'), costBy = by(W.cost, 'datasheet_id'), gearBy = by(W.wargear, 'datasheet_id'), kwBy = by(W.keywords, 'datasheet_id');
const leadBy = by(W.leader, 'leader_id');
const sheetById = Object.fromEntries(W.sheets.map(s => [s.id, s]));
const srcById = Object.fromEntries(W.source.map(s => [s.id, s]));

/* ---------- Fraktionszuordnung (Wahapedia-Kürzel ↔ Auspex-ID) ---------- */
const ourFac = Object.fromEntries(G.factions.map(f => [f.id, f]));
const SM_FAMILY = G.factions.filter(f => f.id === 'space_marines' || f.parent === 'space_marines').map(f => f.id);
const wfByNorm = Object.fromEntries(W.factions.map(f => [norm(f.name), f.id]));
const ALIAS = { adeptasororitas: 'adepta_sororitas', adeptuscustodes: 'adeptus_custodes', adeptusmechanicus: 'adeptus_mechanicus', agentsoftheimperium: 'agents_of_the_imperium', imperialagents: 'agents_of_the_imperium', astramilitarum: 'astra_militarum', greyknights: 'grey_knights', imperialknights: 'imperial_knights', spacemarines: 'space_marines', chaosdaemons: 'chaos_daemons', chaosknights: 'chaos_knights', chaosspacemarines: 'chaos_space_marines', deathguard: 'death_guard', emperorschildren: 'emperors_children', thousandsons: 'thousand_sons', worldeaters: 'world_eaters', aeldari: 'aeldari', drukhari: 'drukhari', genestealercults: 'genestealer_cults', leaguesofvotann: 'leagues_of_votann', necrons: 'necrons', orks: 'orks', tauempire: 'tau_empire', tyranids: 'tyranids' };
const wahaFor = {};   // Auspex-Fraktion → Wahapedia faction_id
for (const [n, wid] of Object.entries(wfByNorm)) { const fid = ALIAS[n]; if (fid) wahaFor[fid] = wid; }
SM_FAMILY.forEach(fid => { wahaFor[fid] = wahaFor.space_marines; });

/* ---------- Wahapedia-Staffeln eines Datenblatts ---------- */
function wahaTiers(id) {
  const rows = (costBy[id] || []).slice().sort((a, b) => +a.line - +b.line);
  const tiers = []; const seen = {}; let cur = null; const gear = {};
  for (const r of rows) {
    const d = r.description.toUpperCase();
    let m;
    if (d === 'YOUR UNIT COSTS') { const k = '1-'; cur = seen[k] ||= (tiers.push({ from: 1, to: null, cost: {} }), tiers[tiers.length - 1]); continue; }
    if ((m = d.match(/^YOUR (\d+)(?:ST|ND|RD|TH)(?: TO (\d+)(?:ST|ND|RD|TH))?(\+)? UNITS? COSTS?$/))) {
      const from = +m[1], to = m[3] ? null : (m[2] ? +m[2] : from), k = from + '-' + to;
      cur = seen[k] ||= (tiers.push({ from, to, cost: {} }), tiers[tiers.length - 1]); continue;
    }
    if (d.startsWith('WARGEAR')) { cur = 'gear'; continue; }
    if (cur === 'gear') { const g = r.description.replace(/^per\s+/i, ''); if (r.cost) gear[norm(g)] = { name: g, cost: +r.cost }; continue; }
    if ((m = r.description.match(/^(\d+)\s+models?$/i)) && cur && r.cost !== '') cur.cost[+m[1]] ??= +r.cost;
  }
  tiers.sort((a, b) => a.from - b.from);
  return { tiers, gear };
}
/* Staffeln → Auspex-Format { size → [{after, add}] } */
function escFromTiers(tiers) {
  const out = {};
  if (tiers.length < 2) return out;
  const base = tiers[0].cost;
  for (const m of Object.keys(base)) {
    out[m] = tiers.slice(1).filter(t => t.cost[m] != null && t.cost[m] !== base[m]).map(t => ({ after: t.from - 1, add: t.cost[m] - base[m] }));
  }
  return out;
}
const ourEsc = u => (u.escalation || []).map(x => ({ after: x.after, add: x.add })).sort((a, b) => a.after - b.after);
const escStr = l => l.map(x => `ab ${x.after + 1}. +${x.add}`).join(', ') || '—';

/* ---------- Zuordnung Datenblatt ↔ Einheit ---------- */
const sheetsByFac = by(W.sheets, 'faction_id');
function candidates(fid, u) {
  const wid = wahaFor[fid]; if (!wid) return [];
  const n = norm(en(u.name));
  return (sheetsByFac[wid] || []).filter(s => norm(s.name) === n && s.virtual !== 'true');
}
function pickSheet(fid, u) {
  const c = candidates(fid, u);
  if (c.length <= 1) return c[0] || null;
  const f = ourFac[fid];
  // Ordens-Datenblätter: Quelle (Source.csv) nennt den Orden
  const chap = c.filter(s => norm(srcById[s.source_id]?.name || '').includes(norm(en(f.name))));
  if (chap.length === 1) return chap[0];
  // Legends-Status
  const leg = c.filter(s => (s.legend === 'true') === !!u.legends);
  const pool = leg.length ? leg : c;
  // Punkte als Entscheidung
  const ptsOk = pool.filter(s => { const t = wahaTiers(s.id).tiers[0]; return t && u.sizes.every(z => t.cost[z.models] === z.points); });
  if (ptsOk.length >= 1) return ptsOk[0];
  const generic = pool.filter(s => !/legends|forge world/i.test(srcById[s.source_id]?.name || '') && norm(srcById[s.source_id]?.name || '') === norm('Space Marines'));
  return (generic[0] || pool[0]);
}

/* ---------- Vergleich ---------- */
const report = { generatedAt: new Date().toISOString(), wahapediaUpdate: W.last[0]?.last_update || null, data: G.dataDate || null, summary: {}, factions: {} };
const add = (fid, cat, item) => { ((report.factions[fid] ||= {})[cat] ||= []).push(item); report.summary[cat] = (report.summary[cat] || 0) + 1; };
const statKeys = [['m', 'M'], ['t', 'T'], ['sv', 'Sv'], ['w', 'W'], ['ld', 'Ld'], ['oc', 'OC']];
const cleanStat = v => String(v ?? '').replace(/["”″*]/g, '').replace(/\s+/g, '').split('/')[0].replace(/^[-–]$/, '').replace(/^(\d+)\+$/, '$1');
// OC „-“ (Flieger) = 0; M „-“ bzw. „20+“ bei Fliegern sind gleichwertig
const sameStat = (k, a, b) => a === b || (k === 'OC' && (a || '0') === (b || '0')) || (k === 'M' && (!a || !b || /\+$/.test(a) || /\+$/.test(b)));

for (const f of G.factions) {
  if (!wahaFor[f.id]) { add(f.id, 'fraktionOhneZuordnung', { faction: en(f.name) }); continue; }
  const units = f.units;
  const matched = new Set();
  for (const u of units) {
    const s = pickSheet(f.id, u);
    const name = en(u.name);
    if (!s) { add(f.id, 'fehltBeiWahapedia', { unit: name, legends: !!u.legends }); continue; }
    matched.add(s.id);
    const { tiers, gear } = wahaTiers(s.id);
    /* Punkte (erste Staffel) */
    if (tiers.length) {
      const t0 = tiers[0].cost;
      const ours = Object.fromEntries(u.sizes.map(z => [z.models, z.points]));
      const sameSizes = Object.keys(t0).length === Object.keys(ours).length && Object.keys(t0).every(k => ours[k] != null);
      const samePts = sameSizes && Object.keys(t0).every(k => ours[k] === t0[k]);
      if (!samePts) add(f.id, 'punkte', { unit: name, auspex: ours, wahapedia: t0, wahaId: s.id });
      /* Staffelpreise */
      const want = escFromTiers(tiers), have = ourEsc(u);
      const sizesW = Object.values(want);
      const uniform = sizesW.length ? sizesW.every(l => JSON.stringify(l) === JSON.stringify(sizesW[0])) : true;
      const w0 = sizesW[0] || [];
      if (JSON.stringify(w0) !== JSON.stringify(have)) add(f.id, 'staffelpreise', { unit: name, auspex: escStr(have), wahapedia: escStr(w0), sizeDependent: !uniform, raw: want });
      else if (!uniform) add(f.id, 'staffelGroessenabhaengig', { unit: name, wahapedia: want });
    } else add(f.id, 'ohnePunkteBeiWahapedia', { unit: name });
    /* Profile */
    const wm = (modelsBy[s.id] || []);
    const om = u.stats || [];
    const statDiff = (p, w) => {
      const d = [];
      for (const [k, wk] of statKeys) { const a = cleanStat(p[k]), b = cleanStat(w[wk]); if (!sameStat(wk, a, b)) d.push(`${wk} ${p[k] ?? '–'} → ${w[wk]}`); }
      const inv = cleanStat(w.inv_sv), oinv = cleanStat(p.inv);
      if ((inv || '') !== (oinv || '')) d.push(`Inv ${p.inv || '–'} → ${w.inv_sv || '–'}`);
      return d;
    };
    for (const p of om) {
      const named = wm.find(x => norm(x.name) === norm(p.n)) || (wm.length === 1 ? wm[0] : null);
      const pool = named ? [named] : wm;
      if (!pool.length) continue;
      const results = pool.map(w => ({ w, d: statDiff(p, w) }));
      if (results.some(r => !r.d.length)) continue;              // mindestens ein Modell passt exakt
      const best = results.sort((a, b) => a.d.length - b.d.length)[0];
      add(f.id, 'profile', { unit: name, profile: p.n, wahaProfile: best.w.name, diffs: best.d });
    }
    /* Ausrüstungspreise */
    const oursGear = {};
    (u.models || []).forEach(m => { const lo = m.lo || {}; (lo.slots || []).forEach(sl => (sl.opts || []).forEach(o => { oursGear[norm(o.n)] = o.p || 0; })); (lo.toggles || []).forEach(o => { oursGear[norm(o.n)] = o.p || 0; }); });
    for (const [k, g] of Object.entries(gear)) {
      const have = Object.entries(oursGear).find(([n]) => n === k || n.includes(k) || k.includes(n));
      if (!have) add(f.id, 'ausruestungFehlt', { unit: name, item: g.name, cost: g.cost });
      else if (have[1] !== g.cost) add(f.id, 'ausruestungPreis', { unit: name, item: g.name, auspex: have[1], wahapedia: g.cost });
    }
    /* Anführer */
    if ((leadBy[s.id] || []).length || (u.leads || []).length) {
      const wantN = new Set((leadBy[s.id] || []).map(r => norm(sheetById[r.attached_id]?.name)).filter(Boolean));
      const allUnits = Object.fromEntries(G.factions.flatMap(x => x.units).map(x => [x.id, x]));
      const haveN = new Set((u.leads || []).map(id => norm(en(allUnits[id]?.name))).filter(Boolean));
      const miss = [...wantN].filter(x => !haveN.has(x)), extra = [...haveN].filter(x => !wantN.has(x));
      if (miss.length || extra.length) add(f.id, 'anfuehrer', { unit: name, fehlt: miss, zuviel: extra });
    }
  }
  /* Datenblätter, die Auspex nicht hat (nur nicht-virtuelle, eigene Fraktion) */
  if (!f.parent) {
    const fam = f.id === 'space_marines' ? SM_FAMILY : [f.id];
    const have = new Set(fam.flatMap(id => ourFac[id].units.map(u => norm(en(u.name)))));
    for (const s of sheetsByFac[wahaFor[f.id]] || []) {
      if (s.virtual === 'true' || have.has(norm(s.name))) continue;
      if (!(costBy[s.id] || []).length) continue;
      add(f.id, 'fehltInAuspex', { unit: s.name, legends: s.legend === 'true', source: srcById[s.source_id]?.name || '' });
    }
  }
  /* Waffenprofile je Einheit: wirksames Profil (u.wpn → Fraktion) gegen das Wahapedia-Datenblatt */
  const wpn = f.weapons || {};
  const sigOf = (a, sk, st, ap, d, r) => [a, String(sk || '').replace('+', '').replace(/^(n\/a|none|-)$/i, ''), st, String(ap).replace(/^-0$/, '0'), d, r].map(x => cleanStat(x).toLowerCase().replace(/\+$/, '')).join('/');
  for (const u of units) {
    const s = pickSheet(f.id, u); if (!s) continue;
    const wg = gearBy[s.id] || [];
    const names = new Set();
    const visit = o => { if (Array.isArray(o)) return o.forEach(visit); if (!o || typeof o !== 'object') return; if (Array.isArray(o.w)) o.w.forEach(x => names.add(x)); Object.values(o).forEach(v => v && typeof v === 'object' && visit(v)); };
    visit(u.models); visit(u.unitLoadout);
    for (const n of names) {
      const o = (u.wpn && u.wpn[n]) || wpn[n]; if (!o || !o.t) continue;
      const melee = String(o.t).toUpperCase().startsWith('M');
      const base = norm(String(n).replace(/^➤\s*/, ''));
      const cand = wg.filter(g => (g.type === 'Melee') === melee && (norm(g.name) === base || norm(g.name.replace(/^➤\s*/, '')) === base));
      if (!cand.length) continue;
      const mine = sigOf(o.a, o.sk, o.s, o.ap, o.d, melee ? '' : String(o.r || '').replace(/"/g, ''));
      const theirs = cand.map(g => sigOf(g.A, g.BS_WS, g.S, g.AP, g.D, melee ? '' : String(g.range).replace(/"/g, '')));
      if (theirs.includes(mine)) continue;
      add(f.id, 'waffen', { unit: en(u.name), weapon: n, auspex: mine, wahapedia: [...new Set(theirs)] });
    }
  }
  /* Enhancements & Detachments */
  const wid = wahaFor[f.id];
  if (!f.parent || f.id !== 'space_marines') {
    const wEnh = W.enh.filter(e => e.faction_id === wid);
    for (const e of f.enhancements || []) {
      const w = wEnh.filter(x => norm(x.name) === norm(en(e.name).replace(/\(upgrade\)/i, '')) && (!e.detachment || norm(x.detachment) === norm(en(e.detachment))));
      if (!w.length) { add(f.id, 'enhancementFehltBeiWahapedia', { name: en(e.name), detachment: en(e.detachment) }); continue; }
      if (!w.some(x => +x.cost === e.points)) add(f.id, 'enhancementPunkte', { name: en(e.name), detachment: en(e.detachment), auspex: e.points, wahapedia: w.map(x => +x.cost) });
    }
    const wDet = W.dets.filter(d => d.faction_id === wid);
    for (const d of f.detachments || []) {
      const w = wDet.find(x => norm(x.name) === norm(en(d.name)));
      if (!w) { add(f.id, 'detachmentFehltBeiWahapedia', { name: en(d.name) }); continue; }
      if (w.dp && d.dp != null && +w.dp !== d.dp) add(f.id, 'detachmentPunkte', { name: en(d.name), auspex: d.dp, wahapedia: +w.dp });
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
const total = Object.values(report.summary).reduce((a, b) => a + b, 0);
console.log(`Wahapedia-Stand ${report.wahapediaUpdate} · Abweichungen gesamt ${total}`);
Object.entries(report.summary).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(5), k));

if (MD) {
  // Kompakt, vollständig, in Teile ≤ 60 000 Zeichen (Issue-Text + Kommentare)
  const head = [`# Wahapedia-Abgleich`, '', `Erstellt: ${report.generatedAt} · Wahapedia-Stand: ${report.wahapediaUpdate || '?'} · Auspex-Daten: ${report.data || '?'}`, '',
    '| Kategorie | Anzahl |', '|---|---:|', ...Object.entries(report.summary).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`), ''];
  const lines = [];
  const ORDER = ['punkte', 'staffelpreise', 'staffelGroessenabhaengig', 'profile', 'waffen', 'ausruestungPreis', 'ausruestungFehlt', 'anfuehrer', 'enhancementPunkte', 'detachmentPunkte', 'fehltInAuspex', 'fehltBeiWahapedia', 'ohnePunkteBeiWahapedia', 'profilOhneGegenstueck', 'enhancementFehltBeiWahapedia', 'detachmentFehltBeiWahapedia', 'fraktionOhneZuordnung'];
  for (const cat of ORDER) {
    const items = Object.entries(report.factions).flatMap(([fid, c]) => (c[cat] || []).map(x => ({ fid, ...x })));
    if (!items.length) continue;
    lines.push(`## ${cat} (${items.length})`);
    items.forEach(x => lines.push(`- ${x.fid} · ${x.unit || x.name || x.weapon || x.faction}: ` + JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => !['fid', 'unit', 'name', 'faction', 'raw', 'wahaId'].includes(k))))));
    lines.push('');
  }
  const parts = []; let cur = head.join('\n') + '\n';
  for (const l of lines) { if (cur.length + l.length + 1 > 60000) { parts.push(cur); cur = `(Fortsetzung ${parts.length + 1})\n`; } cur += l + '\n'; }
  parts.push(cur);
  fs.writeFileSync(MD, parts[0]);
  parts.slice(1).forEach((t, i) => fs.writeFileSync(MD.replace(/\.md$/, `.part${i + 2}.md`), t));
}

#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 *  Wahapedia-Abgleich für Auspex 40k
 *
 *  Vergleicht game-data-11e.js mit dem öffentlichen Wahapedia-Datenexport
 *  (wh40k11ed/*.csv): Punkte, Staffelpreise (2./3./4. Exemplar), Profile,
 *  Rettungswürfe, Waffenprofile, Ausrüstungspreise, Anführer-Zuordnungen,
 *  Enhancement-Punkte und Detachment-Punkte; seit v18.13 auch Waffenfähigkeiten,
 *  Kernfähigkeiten (Deep Strike, Scouts, FNP …), Detachment-Ausrichtungen und
 *  fehlende Detachments/Enhancements/Waffen.
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
  abil: readCsv('Abilities.csv'),
  sheetAbil: readCsv('Datasheets_abilities.csv'),
  comp: readCsv('Datasheets_unit_composition.csv'),
  opts: readCsv('Datasheets_options.csv'),
  source: readCsv('Source.csv'),
  last: readCsv('Last_update.csv'),
};
if (!W.sheets.length || !W.cost.length) { console.error('Wahapedia-CSV fehlen oder leer'); process.exit(2); }
const by = (rows, k) => rows.reduce((m, r) => ((m[r[k]] ||= []).push(r), m), {});
const modelsBy = by(W.models, 'datasheet_id'), costBy = by(W.cost, 'datasheet_id'), gearBy = by(W.wargear, 'datasheet_id'), kwBy = by(W.keywords, 'datasheet_id');
const leadBy = by(W.leader, 'leader_id');
const compBy = by(W.comp, 'datasheet_id'), optsBy = by(W.opts, 'datasheet_id');
const abilName = Object.fromEntries(W.abil.map(a => [a.id, a.name]));
const coreBy = by(W.sheetAbil.filter(r => r.type === 'Core'), 'datasheet_id');
/* Kernfähigkeiten, die Aufstellung, Exemplar-Plätze oder Schadensrechnung betreffen */
const CORE_KEYS = ['deepstrike', 'infiltrators', 'scouts', 'loneoperative', 'stealth', 'feelnopain', 'fightsfirst', 'deadlydemise', 'firingdeck', 'hover', 'leader', 'support'];
const coreKey = s => { const t = strip(s).replace(/\*/g, '').trim(); const k = CORE_KEYS.find(c => norm(t).startsWith(c)); if (!k) return null; const par = norm(t).slice(k.length); return k + (par ? ':' + par : ''); };
/* Waffenname ohne Pfeil und Klammerzusatz: „➤ Choppa - Hunter (Hunter: MONSTER/VEHICLE)“ → choppahunter */
/* Waffennamen tolerant vergleichen: Pfeil, „The“, &/and, Gedankenstriche, Plural, supercharged/supercharge */
const wbase = n => String(n || '').replace(/^➤\s*/, '').replace(/[–—]/g, '-').replace(/&/g, ' and ').replace(/^the\s+/i, '')
  .replace(/\b(super|over)charged\b/ig, '$1charge').replace(/\s*-?\s*hunter\s*:\s*monster\/vehicle/ig, ' - hunter');
const wnorm = t => norm(t).replace(/s$/, '');
const wname = n => wnorm(wbase(n).replace(/\s*\([^)]*\)\s*$/, ''));
const wfull = n => wnorm(wbase(n));
/* Waffenfähigkeiten als Menge: „Rapid Fire 2, LETHAL HITS“ → {rapidfire2, lethalhits} */
const wkw = s => new Set(strip(s).split(/,(?![^\[]*\])/).map(x => norm(x.replace(/[\[\]]/g, '')).replace(/vehicles$/, 'vehicle')).filter(x => x && x !== 'na' && x !== '-'));
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
/* Gleiche Datenblätter mit anderem Namen (eine Wahapedia-Seite ↔ mehrere Auspex-Varianten) */
const UNIT_ALIAS = { khornesoulgrinder: 'Soul Grinder', nurglesoulgrinder: 'Soul Grinder', slaaneshsoulgrinder: 'Soul Grinder', tzeentchsoulgrinder: 'Soul Grinder', sicaranbattletank: 'Sicaran' };
function candidates(fid, u) {
  const wid = wahaFor[fid]; if (!wid) return [];
  const n0 = norm(en(u.name));
  const exact = (sheetsByFac[wid] || []).filter(s => norm(s.name) === n0 && s.virtual !== 'true');
  if (exact.length) return exact;
  const n = norm(UNIT_ALIAS[n0] || n0);
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
const ACCEPT = (() => { try { return JSON.parse(fs.readFileSync(new URL('./wahapedia-accepted.json', import.meta.url), 'utf8')); } catch { return []; } })();
const accepted = (fid, cat, item) => ACCEPT.some(a => a.cat === cat && (!a.faction || a.faction === fid) && (!a.unit || a.unit === (item.unit || item.name)) && (!a.profile || a.profile === item.profile) && (!a.weapon || a.weapon === item.weapon));
const add = (fid, cat, item) => { if (accepted(fid, cat, item)) { report.summary.akzeptiert = (report.summary.akzeptiert || 0) + 1; return; } ((report.factions[fid] ||= {})[cat] ||= []).push(item); report.summary[cat] = (report.summary[cat] || 0) + 1; };
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
    if (!s) { add(f.id, u.noMfm ? 'legendsOhneMfm' : 'fehltBeiWahapedia', { unit: name, legends: !!u.legends }); continue; }
    matched.add(s.id);
    if (process.env.PRINT_LINKS && s.link) console.log('LINK\t' + u.id + '\t' + s.link);
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
    /* Ausrüstungspreise: Preis je Stück (Option „2 Multi-meltas“ = 2 × Stückpreis), auch feste Ausrüstung von Modellvarianten */
    const oursGear = [];
    const mult = n => { const m = String(n).match(/^(\d+)\s*[x×]?\s/); return m ? +m[1] : 1; };
    (u.models || []).concat(u.unitLoadout ? [{ lo: u.unitLoadout }] : []).forEach(m => { const lo = m.lo || {};
      (lo.slots || []).forEach(sl => (sl.opts || []).forEach(o => oursGear.push({ n: norm(o.n), w: (o.w || []).map(norm), each: (o.p || 0) / mult(o.n) })));
      (lo.toggles || []).forEach(o => oursGear.push({ n: norm(o.n), w: (o.w || []).map(norm), each: (o.p || 0) / mult(o.n) }));
      (lo.fixed || []).forEach(o => oursGear.push({ n: norm(o.n), w: (o.w || []).map(norm), each: o.p || 0 })); });
    const sing = t => t.replace(/s$/, '');
    for (const [k, g] of Object.entries(gear)) {
      const have = oursGear.filter(o => sing(o.n) === sing(k) || o.n.endsWith(sing(k)) || o.n.includes(sing(k)) || o.w.some(w => w.startsWith(sing(k))));
      if (!have.length) add(f.id, 'ausruestungFehlt', { unit: name, item: g.name, cost: g.cost });
      else if (!have.some(o => o.each === g.cost)) add(f.id, 'ausruestungPreis', { unit: name, item: g.name, auspex: [...new Set(have.map(o => o.each))], wahapedia: g.cost });
    }
    /* Regelrelevante Schlüsselwörter (Rolle, Exemplar-Grenzen, Transport, Anführer) */
    const wk = new Set((kwBy[s.id] || []).filter(k => k.is_faction_keyword !== 'true').map(k => norm(k.keyword)));
    if (wk.size) {
      const KEYS = ['battleline', 'dedicatedtransport', 'epichero', 'character', 'infantry', 'vehicle', 'monster', 'fly', 'mounted', 'titanic', 'aircraft', 'walker', 'psyker', 'transport'];
      const ours = new Set([...(u.kx || []), ...(u.kw || [])].map(norm));
      if (u.role === 'battleline') ours.add('battleline');
      if (u.role === 'transport') ours.add('dedicatedtransport');
      if (u.epicHero) ours.add('epichero');
      if (u.role === 'character' || u.character) ours.add('character');
      if (u.transport) ours.add('transport');
      const miss = KEYS.filter(k => wk.has(k) && !ours.has(k)), extra = KEYS.filter(k => !wk.has(k) && ours.has(k) && !['transport', 'character'].includes(k));
      if (miss.length || extra.length) add(f.id, 'schluesselwoerter', { unit: name, fehlt: miss, zuviel: extra });
    }
    /* Leader- oder Support-Charakter (11. Edition: getrennte Plätze am Trupp) */
    if ((leadBy[s.id] || []).length) {
      const want = s.is_support === 'true' ? 'support' : 'leader';
      const have = u.charType || 'leader';
      if (want !== have) add(f.id, 'charakterTyp', { unit: name, auspex: u.charType || '—', wahapedia: want });
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
    const have = new Set(fam.flatMap(id => ourFac[id].units.flatMap(u => [norm(en(u.name)), norm(UNIT_ALIAS[norm(en(u.name))] || '')])));
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
    const ourW = new Set([...names].flatMap(n => [wname(n), wfull(n)]));
    for (const n of names) {
      const o = (u.wpn && u.wpn[n]) || wpn[n]; if (!o || !o.t) continue;
      const melee = String(o.t).toUpperCase().startsWith('M');
      const base = wname(n), full = wfull(n);
      let cand = wg.filter(g => (g.type === 'Melee') === melee && wfull(g.name) === full);
      if (!cand.length) cand = wg.filter(g => (g.type === 'Melee') === melee && wname(g.name) === base);
      if (!cand.length) cand = wg.filter(g => wname(g.name) === base);
      if (!cand.length) { if (wg.length) add(f.id, 'waffeOhneGegenstueck', { unit: en(u.name), weapon: n, profil: sigOf(o.a, o.sk, o.s, o.ap, o.d, melee ? '' : String(o.r || '').replace(/"/g, '')) }); continue; }
      const mine = sigOf(o.a, o.sk, o.s, o.ap, o.d, melee ? '' : String(o.r || '').replace(/"/g, ''));
      const theirs = cand.map(g => sigOf(g.A, g.BS_WS, g.S, g.AP, g.D, melee ? '' : String(g.range).replace(/"/g, '')));
      if (!theirs.includes(mine)) { add(f.id, 'waffen', { unit: en(u.name), weapon: n, auspex: mine, wahapedia: [...new Set(theirs)] }); continue; }
      /* Waffenfähigkeiten (Lethal Hits, Anti-X, Melta …) */
      const g = cand[theirs.indexOf(mine)];
      const a = wkw(o.kw), b = wkw(g.description);
      const miss = [...b].filter(x => !a.has(x)), extra = [...a].filter(x => !b.has(x));
      if (miss.length || extra.length) add(f.id, 'waffenFaehigkeiten', { unit: en(u.name), weapon: n, auspex: o.kw || '—', wahapedia: strip(g.description) || '—' });
    }
    /* Waffen des Datenblatts, die der Einheit fehlen */
    for (const g of wg) {
      if (!g.name) continue;   // namenlose Zeilen (Gebäude, Sammelprofile)
      if (!ourW.has(wname(g.name)) && !ourW.has(wfull(g.name)) && !(u.refWeapons || []).some(r => wfull(r) === wfull(g.name) || wname(r) === wname(g.name)))
        add(f.id, 'waffeFehltInAuspex', { unit: en(u.name), weapon: g.name, typ: g.type, profil: sigOf(g.A, g.BS_WS, g.S, g.AP, g.D, g.type === 'Melee' ? '' : String(g.range).replace(/"/g, '')), kw: strip(g.description) });
    }
    /* Kernfähigkeiten */
    const wc = new Set((coreBy[s.id] || []).map(r => coreKey((abilName[r.ability_id] || '') + ' ' + (r.parameter || ''))).filter(Boolean));
    if (wc.size || (u.core || []).length) {
      const cond = new Set((u.core || []).filter(x => /\*/.test(en(x))).map(x => coreKey(en(x))).filter(Boolean));   // * = nur unter Bedingung
      const oc = new Set((u.core || []).filter(x => !/\*/.test(en(x))).map(x => coreKey(en(x))).filter(Boolean));
      cond.forEach(k => wc.delete(k));
      if (u.charType === 'support') oc.add('support'); else if ((u.leads || []).length) oc.add('leader');
      if (wc.has('leader') || wc.has('support')) { /* Typ prüft „charakterTyp“ */ wc.delete('leader'); wc.delete('support'); oc.delete('leader'); oc.delete('support'); }
      const miss = [...wc].filter(x => !oc.has(x)), extra = [...oc].filter(x => !wc.has(x) && !['leader', 'support'].includes(x));
      if (miss.length || extra.length) add(f.id, 'kernfaehigkeiten', { unit: en(u.name), fehlt: miss, zuviel: extra });
    }
  }
  /* Zusammensetzung (Modelltypen) und Ausrüstungsoptionen (Grenzen je Truppgröße) */
  const sing = t => norm(String(t).replace(/\s+with\s+.*$/i, '').replace(/\s+w\/.*$/i, '')).replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
  const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const typeOf = m => sing(String(m.n || '').replace(/\[legends\]/i, '').replace(/\s+w\/.*$/i, '').replace(/\s*\(.*\)\s*$/, '').replace(/\s+with\s+.*$/i, ''));
  for (const u of units) {
    const s = pickSheet(f.id, u); if (!s) continue;
    const comp = (compBy[s.id] || []).map(r => strip(r.description).match(/^(\d+)(?:\s*-\s*(\d+))?\s+(.+?)\s+models?\b/i)).filter(Boolean)
      .map(m => ({ min: +m[1], max: +(m[2] || m[1]), name: m[3], t: sing(m[3]) }))
      .reduce((acc, c) => { const h = acc.find(x => x.t === c.t); if (h) { h.min += c.min; h.max += c.max; } else acc.push({ ...c, name: c.name.replace(/\s+with\s+.*$/i, '') }); return acc; }, []);
    const ms = (u.models || []).map(m => ({ ...m, t: typeOf(m) }));
    const sizes = u.sizes.map(z => z.models);
    const Smin = Math.min(...sizes), Smax = Math.max(...sizes);
    const match = (a, b) => a && b && (a === b || a.endsWith(b) || b.endsWith(a));
    /* Zusammensetzung: jeder Modelltyp des Datenblatts muss es geben, mit gleicher Spanne */
    if (comp.length > 1) {
      for (const c of comp) {
        const mine = ms.filter(m => match(m.t, c.t));
        if (!mine.length) { add(f.id, 'modellTypFehlt', { unit: en(u.name), modell: c.name, anzahl: c.min === c.max ? c.min : `${c.min}-${c.max}` }); continue; }
        const others = ms.filter(m => !mine.includes(m));
        const lo = Math.max(mine.reduce((a, m) => a + (m.min || 0), 0), Smin - others.reduce((a, m) => a + (m.max || 0), 0));
        const hi = Math.min(mine.reduce((a, m) => a + (m.max || 0), 0), Smax - others.reduce((a, m) => a + (m.min || 0), 0));
        if (lo !== c.min || hi !== c.max) add(f.id, 'modellAnzahl', { unit: en(u.name), modell: c.name, auspex: `${lo}-${hi}`, wahapedia: `${c.min}-${c.max}` });
      }
    }
    /* Optionen */
    const gearNames = new Set((gearBy[s.id] || []).map(g => wname(g.name)));
    const countAt = (t, S) => {
      if (comp.length <= 1) return S;
      const c = comp.find(x => match(x.t, t)); if (!c) return S;
      if (c.min === c.max) return c.min;
      return Math.max(c.min, Math.min(c.max, S - comp.filter(x => x !== c).reduce((a, x) => a + x.min, 0)));
    };
    const rules = [];
    for (const r of (optsBy[s.id] || [])) {
      const t = strip(String(r.description).replace(/<li>/g, ', ').replace(/<[^>]+>/g, ' ')).replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()
        .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, w => NUMW[w.toLowerCase()]);
      let m, scope, who = null, k = 1, per = 0;
      if ((m = t.match(/^For every (\d+) models in (?:this|the) unit, (?:(up to )?(\d+) )?(.*?)models? (?:in this unit )?can/i))) { scope = 'per'; per = +m[1]; k = +(m[3] || 1); who = m[4]; }
      else if ((m = t.match(/^Any number of (.*?)models? (?:in this unit )?can/i))) { scope = 'all'; who = m[1]; }
      else if ((m = t.match(/^All (.*?)models? (?:in this unit )?can/i))) { scope = 'all'; who = m[1]; }
      else if ((m = t.match(/^Up to (\d+) (.*?)models? (?:in this unit )?can/i))) { scope = 'k'; k = +m[1]; who = m[2]; }
      else if ((m = t.match(/^(\d+) (.*?)models? (?:in this unit )?can/i))) { scope = 'k'; k = +m[1]; who = m[2]; }
      else if ((m = t.match(/^This model/i))) { scope = 'this'; }
      else if ((m = t.match(/^(?:The |This unit's |The unit's )?(.+?)(?: model)?(?:'s| can) /i))) { scope = 'who'; who = m[1]; }
      else continue;
      who = who ? sing(who.replace(/\b(the|this|unit's|model|models)\b/gi, ' ').replace(/\s+with\s+.*$/i, '').trim()) : null;
      const giv = (t.match(/(?:replaced with|equipped with)(?: up to \d+ of the following| one of the following| any of the following)?:?\s*(.*)$/i) || [])[1] || '';
      const items = giv.replace(/\(.*?\)/g, '').split(/,|\band\b|;/).map(x => x.replace(/^\s*\d+\s+/, '').replace(/\.$/, '').trim()).filter(Boolean);
      const weapons = items.filter(x => gearNames.has(wname(x)));
      if (weapons.length) rules.push({ scope, who, k, per, weapons, text: scope });
    }
    if (!rules.length) continue;
    const entriesOf = lo => [...(lo.fixed || []), ...(lo.slots || []).flatMap(sl => sl.opts || []), ...(lo.toggles || [])];
    const has = (m, w) => entriesOf(m.lo || {}).some(e => (e.w || []).some(x => wname(x) === wname(w) || wfull(x) === wfull(w)));
    const variantMax = (m, S) => m.per ? Math.min(m.max, m.per[0] * Math.floor(S / m.per[1])) : m.max;
    const theirsCap = (rs, S) => rs.reduce((a, r) => a + (r.scope === 'per' ? r.k * Math.floor(S / r.per) : r.scope === 'k' ? r.k : countAt(r.who || '', S)), 0);
    /* Standardbewaffnung (feste Waffe des Hauptmodells bzw. Vorgabe eines Slots) hat keine Obergrenze */
    const isDefault = w => ms.some(m => { const lo = m.lo || {};
      return (lo.fixed || []).some(e => (e.w || []).some(x => wname(x) === wname(w))) && !/ w\//.test(m.n) ||
        (lo.slots || []).some(sl => sl.def && (sl.opts || []).some(o => o.n === sl.def && (o.w || []).some(x => wname(x) === wname(w)))); });
    const byKey = {};
    for (const r of rules) for (const w of r.weapons) { const key = (r.who || '*') + '|' + wname(w); (byKey[key] ||= { who: r.who, w, rs: [] }).rs.push(r); }
    for (const { who, w, rs } of Object.values(byKey)) {
      const pool = ms.filter(m => !who || match(m.t, who) || (ms.length === 1));
      const holders = pool.filter(m => has(m, w));
      const unitHas = u.unitLoadout && entriesOf(u.unitLoadout).some(e => (e.w || []).some(x => wname(x) === wname(w)));
      if (!holders.length && !unitHas) { add(f.id, 'optionFehlt', { unit: en(u.name), modell: who || 'alle', waffe: w }); continue; }
      const finite = rs.every(r => r.scope === 'per' || r.scope === 'k');
      if (!finite || unitHas || isDefault(w)) continue;
      for (const S of [...new Set([Smin, Smax])]) {
        const theirs = Math.min(theirsCap(rs, S), countAt(who || '', S));
        const ours = Math.min(holders.reduce((a, m) => a + variantMax(m, S), 0), S);
        if (ours > theirs) add(f.id, 'optionGrenze', { unit: en(u.name), waffe: w, modelle: S, auspex: ours, wahapedia: theirs });
      }
    }
  }
  /* Enhancements & Detachments */
  const wid = wahaFor[f.id];
  if (!f.parent || f.id !== 'space_marines') {
    const wEnh = W.enh.filter(e => e.faction_id === wid);
    for (const e of f.enhancements || []) {
      const enn = x => norm(String(x).replace(/\s*\((aura|one per army|upgrade)\)/ig, '').replace(/\s*\[aura\]/ig, ''));
      const w = wEnh.filter(x => enn(x.name) === enn(en(e.name)) && (!e.detachment || norm(x.detachment) === norm(en(e.detachment))));
      if (!w.length) { add(f.id, 'enhancementFehltBeiWahapedia', { name: en(e.name), detachment: en(e.detachment) }); continue; }
      if (!w.some(x => +x.cost === e.points)) add(f.id, 'enhancementPunkte', { name: en(e.name), detachment: en(e.detachment), auspex: e.points, wahapedia: w.map(x => +x.cost) });
    }
    const wDet = W.dets.filter(d => d.faction_id === wid);
    for (const d of f.detachments || []) {
      const w = wDet.find(x => norm(x.name) === norm(en(d.name)));
      if (!w) { add(f.id, 'detachmentFehltBeiWahapedia', { name: en(d.name) }); continue; }
      if (w.dp && d.dp != null && +w.dp !== d.dp) add(f.id, 'detachmentPunkte', { name: en(d.name), auspex: d.dp, wahapedia: +w.dp });
      const wd = new Set(strip(w.force_disposition).split(/[,;\/]| or /i).map(norm).filter(Boolean));
      const od = new Set((d.dispositions || []).map(x => norm(en(x))));
      /* Wahapedia-Export nennt nur die erste Ausrichtung (Seite zeigt alle) → nur fehlende melden */
      if (wd.size && [...wd].some(x => !od.has(x))) add(f.id, 'detachmentAusrichtung', { name: en(d.name), auspex: (d.dispositions || []).map(en).join(', ') || '—', wahapedia: strip(w.force_disposition) });
    }
    /* Detachments und Enhancements, die Auspex fehlen (Space Marines: ganze Ordensfamilie) */
    if (!f.parent && !(f.id !== 'space_marines' && wid === wahaFor.space_marines)) {
      const fam = f.id === 'space_marines' ? SM_FAMILY.map(id => ourFac[id]) : [f];
      const haveD = new Set(fam.flatMap(x => (x.detachments || []).map(d => norm(en(d.name)))));
      const haveE = new Set(fam.flatMap(x => (x.enhancements || []).map(e => norm(en(e.name).replace(/\s*[\(\[](upgrade|aura|one per army)[\)\]]/ig, '')))));
      for (const w of wDet) if (!w.type && !haveD.has(norm(w.name))) add(f.id, 'detachmentFehltInAuspex', { name: w.name });
      const boarding = new Set(wDet.filter(w => w.type).map(w => w.id));
      for (const w of wEnh) if (!boarding.has(w.detachment_id) && !haveE.has(norm(w.name.replace(/\s*\((aura|one per army)\)/ig, ''))) && !haveE.has(norm(w.name))) {
        /* nur die Träger-Bedingung („… model only“) als Schlüsselwörter, kein Regeltext */
        const m = strip(w.description).match(/^(.{0,120}?)\b(models?|units?)\b[^.]{0,40}\bonly\b/i);
        add(f.id, 'enhancementFehltInAuspex', { name: w.name, detachment: w.detachment, cost: +w.cost || 0, upgrade: w.upgrade === 'true', traeger: m ? (m[1] + m[2]).replace(/[^\w’'\s-]/g, ' ').replace(/\s+/g, ' ').trim() : '' });
      }
    }
  }
}

/* Wirkungsklassen der Enhancements (nur Klassen-Kürzel, kein Text) – für die Generator-Bewertung */
if (process.env.PRINT_LINKS) {
  const facName = Object.fromEntries(W.factions.map(f => [f.id, f.name]));
  for (const e of W.enh) {
    const t = strip(e.description).toLowerCase(); const T = [];
    const chk = (tag, ...re) => { if (re.some(r => r.test(t))) T.push(tag); };
    chk('lethal', /lethal hits/); chk('sustained', /sustained hits/); chk('devastating', /devastating wounds/);
    chk('hit', /add 1 to the hit roll/, /\+1 to hit/, /re-roll (a |the )?hit roll/, /critical hit on (an unmodified )?(hit roll of )?5\+/);
    chk('wound', /add 1 to the wound roll/, /\+1 to wound/, /re-roll (a |the )?wound roll/, /critical wound on/, /\[anti-/);
    chk('attacks', /add 1 to the attacks/, /\+1 attacks?/, /add 1 to the strength/, /add 1 to the damage/, /improve the armour penetration/, /\+1 (strength|damage|ap)\b/, /\[lance\]/, /\[melta/, /mortal wounds?/);
    chk('precision', /\bprecision\b/); chk('fightsfirst', /fights first/); chk('fnp', /feel no pain/);
    chk('invuln', /invulnerable save/); chk('tough', /subtract 1 from the (wound|damage)/, /add 1 to (the )?toughness/, /add 1 to (its|the) wounds/, /worsen the armour penetration/, /add 1 to (the )?(armour )?sav(e|ing)/, /\+1 (to )?(armour )?save/);
    chk('stealth', /\bstealth\b/, /benefit of cover/, /lone operative/, /cannot be (selected as the )?target/); chk('aura', /\(aura\)/, /\baura\b/);
    chk('move', /deep strike/, /\bscouts\b/, /infiltrators/, /advance and (declare a )?charge/, /add \d+" to the move/, /fall back and/, /charge roll/, /advance roll/, /strategic reserves|\breserves\b/, /normal move of up to/, /pile.in|consolidat/);
    chk('cp', /command point/, /\bcp\b/, /stratagem/, /battle-shock/, /objective control|\boc\b/);
    if (/bearer'?s unit|while this model is leading a unit|the unit it is leading|this model'?s unit/.test(t)) T.push('unit');
    console.log('ETAG\t' + (facName[e.faction_id] || e.faction_id) + '\t' + e.detachment + '\t' + e.name + '\t' + T.join(','));
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
  const ORDER = ['punkte', 'staffelpreise', 'schluesselwoerter', 'charakterTyp', 'staffelGroessenabhaengig', 'profile', 'waffen', 'ausruestungPreis', 'ausruestungFehlt', 'anfuehrer', 'enhancementPunkte', 'detachmentPunkte', 'waffenFaehigkeiten', 'waffeFehltInAuspex', 'kernfaehigkeiten', 'detachmentAusrichtung', 'detachmentFehltInAuspex', 'enhancementFehltInAuspex', 'waffeOhneGegenstueck', 'modellTypFehlt', 'modellAnzahl', 'optionFehlt', 'optionGrenze', 'fehltInAuspex', 'fehltBeiWahapedia', 'legendsOhneMfm', 'ohnePunkteBeiWahapedia', 'profilOhneGegenstueck', 'enhancementFehltBeiWahapedia', 'detachmentFehltBeiWahapedia', 'fraktionOhneZuordnung'];
  for (const cat of ORDER) {
    const items = Object.entries(report.factions).flatMap(([fid, c]) => (c[cat] || []).map(x => ({ fid, ...x })));
    if (!items.length) continue;
    lines.push(`## ${cat} (${items.length})`);
    items.forEach(x => lines.push(`- ${x.fid} · ${x.unit || x.name || x.weapon || x.faction}: ` + JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => !['fid', 'unit', 'name', 'faction', 'raw', 'wahaId'].includes(k))))));
    lines.push('');
  }
  /* Fertige Korrekturvorschläge im Format von assets/data/manual-fixes.json (vor dem Übernehmen kurz prüfen) */
  const fx = {}; const put = (sec, key, val) => ((fx[sec] ||= {})[key] = val);
  const fkey = (fid, unit) => `${en(ourFac[fid]?.name) || fid}/${unit}`;
  const sizesOf = w => Object.entries(w).map(([m, p]) => ({ models: +m, points: p }));
  for (const [fid, c] of Object.entries(report.factions)) {
    (c.punkte || []).forEach(x => put('sizes', fkey(fid, x.unit), sizesOf(x.wahapedia)));
    (c.staffelpreise || []).forEach(x => { const w = Object.values(x.raw || {})[0] || []; put('escalation', fkey(fid, x.unit), w); });
    (c.charakterTyp || []).forEach(x => put('charType', fkey(fid, x.unit), x.wahapedia));
    (c.enhancementPunkte || []).forEach(x => put('enhancements', `${en(ourFac[fid]?.name)}/${x.name}`, x.wahapedia[0]));
    (c.kernfaehigkeiten || []).forEach(x => put('core_set', fkey(fid, x.unit), { add: x.fehlt, remove: x.zuviel }));
    (c.anfuehrer || []).forEach(x => put('leads_set', fkey(fid, x.unit), { add: x.fehlt, remove: x.zuviel }));
    (c.schluesselwoerter || []).forEach(x => put('kw_patch', fkey(fid, x.unit), { add: x.fehlt, remove: x.zuviel }));
    (c.waffenFaehigkeiten || []).forEach(x => { const k = fkey(fid, x.unit); ((fx.wpn_patch ||= {})[k] ||= {})[x.weapon] = { kw: x.wahapedia }; });
    (c.waffen || []).forEach(x => { const [a, sk, st, ap, d] = String(x.wahapedia[0]).split('/'); const k = fkey(fid, x.unit); ((fx.wpn_patch ||= {})[k] ||= {})[x.weapon] = { a, sk: sk ? sk + '+' : 'N/A', s: st, ap, d }; });
  }
  if (Object.keys(fx).length) {
    lines.push('## Korrekturvorschlag für assets/data/manual-fixes.json', '', 'Automatisch aus den Befunden oben erzeugt – Einträge prüfen und in die passenden Abschnitte übernehmen, danach Build ausführen.', '', '```json', JSON.stringify(fx, null, 1), '```', '');
  }
  const parts = []; let cur = head.join('\n') + '\n';
  for (const l of lines) { if (cur.length + l.length + 1 > 60000) { parts.push(cur); cur = `(Fortsetzung ${parts.length + 1})\n`; } cur += l + '\n'; }
  parts.push(cur);
  fs.writeFileSync(MD, parts[0]);
  parts.slice(1).forEach((t, i) => fs.writeFileSync(MD.replace(/\.md$/, `.part${i + 2}.md`), t));
}

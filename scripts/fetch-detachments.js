#!/usr/bin/env node
/* ============================================================================
 *  Auspex 40k – Detachment-Import (scripts/fetch-detachments.js)
 *
 *  Lädt BSData/wh40k-11e (wie fetch-data.js) und schreibt assets/data/all_detachments.json:
 *  alle Detachments aller Fraktionen mit Keyword-Profil, Enhancements und (falls vorhanden) Stratagems.
 *
 *  Aufruf:   npm run fetch-detachments
 *            npm run fetch-detachments -- --with-text     → Regel-/Enhancement-Texte mit exportieren (GW-Texte!)
 *            npm run fetch-detachments -- --ref <commit> | --git | --local <ordner> | --only "space marines"
 *
 *  Jedes Detachment:
 *    { id, faction, factionId, detachmentName, dp, forceDispositions,
 *      keywordsBonus:    ["VEHICLE"],              bevorzugte Einheiten-Keywords (absteigend gewichtet)
 *      keywordWeights:   { VEHICLE: 5 },           Gewicht (Detachment-Regel ×3, Enhancement ×1)
 *      excludedKeywords: ["WALKER"],               ausdrücklich ausgeschlossen („excluding WALKER units“)
 *      excludedWeights:  { WALKER: 3 },            ≥ 3 = in der Detachment-Regel selbst (Veto), < 3 = nur in einem Enhancement-Text
 *      weaponAbilities:  ["RAPID FIRE"],           belohnte Waffen-Fähigkeiten
 *      abilities:        ["DEEP STRIKE"],          belohnte Kern-Fähigkeiten (inkl. TRANSPORT / OBJECTIVE)
 *      style:            "ranged" | "melee" | null,
 *      rules:            ["Ironstorm Auto-Targeters"]   (mit --with-text: [{ name, description }])
 *      enhancements:     [{ id, name, cost, description }]   description nur mit --with-text, sonst ""
 *      stratagems:       [] }                      BSData/wh40k-11e enthält KEINE Stratagems
 *
 *  Das Keyword-Profil wird aus den Regeltexten abgeleitet: Gesucht werden die Keywords, die Einheiten
 *  dieser Fraktion tatsächlich tragen (gleiches Verfahren wie der App-Build, conv/detfocus.py).
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const FD = require('./fetch-data.js');
const { CFG, idx, chars, log, die } = FD;

const WEAPON_ABIL = ['rapid fire', 'assault', 'heavy', 'pistol', 'torrent', 'melta', 'blast', 'lance', 'twin-linked', 'sustained hits',
  'lethal hits', 'devastating wounds', 'ignores cover', 'indirect fire', 'precision', 'hazardous', 'anti-', 'psychic', 'extra attacks'];
const AMBIG = new Set(['assault', 'heavy', 'pistol', 'blast', 'lance', 'torrent', 'melta', 'psychic', 'precision', 'hazardous']);
const ABIL = { 'deep strike': 'deep strike', 'strategic reserves': 'deep strike', reserves: 'deep strike', infiltrators: 'infiltrators',
  scouts: 'scouts', 'lone operative': 'lone operative', stealth: 'stealth', 'fights first': 'fights first', 'feel no pain': 'feel no pain',
  embark: 'transport', disembark: 'transport', 'objective marker': 'objective', objective: 'objective' };
const NEG = /(excluding|except|other than|that (?:is|are) not|non-|cannot)\W*(?:\w+\W+){0,3}$/i;
const GENERIC = new Set(['imperium', 'chaos', 'character', 'epic hero', 'faction', 'unit', 'units', 'model', 'models', 'grenades', 'smoke']);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regeltext eines BSData-Eintrags (Regeln, verlinkte Regeln, Profile) */
function textOf(o) {
  if (!o) return '';
  const out = (o.rules || []).map(r => r.description || '');
  (o.infoLinks || []).forEach(il => {
    const t = idx.get(il.targetId) || {};
    if (il.type === 'rule') out.push(t.description || '');
    else if (il.type === 'profile') out.push(...(t.characteristics || []).map(c => c.$text || ''));
  });
  (o.profiles || []).forEach(p => out.push(...Object.values(chars(p))));
  return out.join(' ');
}

/** Keyword-Profil aus Detachment-Regel (×3) und Enhancement-Texten (×1) */
function profileOf(detText, enhTexts, vocab) {
  const kw = {}, neg = {}, wpn = {}, abil = {}, style = { melee: 0, ranged: 0 };
  const add = (m, k, n) => { m[k] = (m[k] || 0) + n; };
  [[detText, 3], ...enhTexts.map(t => [t, 1])].forEach(([text, w]) => {
    if (!text) return;
    const low = text.toLowerCase(), taken = [];
    for (const k of vocab) {
      const re = new RegExp(`(?<![\\w-])${esc(k)}s?(?![\\w-])`, 'g');
      let m;
      while ((m = re.exec(low))) {
        if (taken.some(([a, b]) => m.index >= a && m.index < b)) continue;
        taken.push([m.index, m.index + m[0].length]);
        add(NEG.test(low.slice(Math.max(0, m.index - 40), m.index)) ? neg : kw, k, w);
      }
    }
    for (const a of WEAPON_ABIL) {
      const re = AMBIG.has(a) ? new RegExp(`\\[${esc(a)}|(?<![\\w-])${esc(a)} weapons?`, 'g') : new RegExp(`(?<![\\w-])${esc(a)}`, 'g');
      const n = (low.match(re) || []).length;
      if (n) add(wpn, a, n * w);
    }
    const seen = new Set();
    Object.entries(ABIL).sort((x, y) => y[0].length - x[0].length).forEach(([a, tag]) => {
      const n = (low.match(new RegExp(`(?<![\\w-])${esc(a)}`, 'g')) || []).length, key = tag + '|' + a.split(' ')[0];
      if (n && !seen.has(key)) { add(abil, tag, n * w); seen.add(key); }
    });
    style.melee += w * (low.match(/\bmelee\b|\bfight phase\b|\bcharge/g) || []).length;
    style.ranged += w * (low.match(/\branged\b|\bshooting phase\b|\bshoot\b/g) || []).length;
  });
  Object.keys(neg).forEach(k => { if (kw[k] && kw[k] <= neg[k]) delete kw[k]; });
  const top = (m, n) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    kw: Object.fromEntries(top(kw, 8)), not: Object.fromEntries(top(neg, 4)), wpn: Object.fromEntries(top(wpn, 5)), abil: Object.fromEntries(top(abil, 4)),
    style: style.melee >= 2 * Math.max(1, style.ranged) ? 'melee' : style.ranged >= 2 * Math.max(1, style.melee) ? 'ranged' : null
  };
}

(async function main() {
  const t0 = Date.now();
  const { meta, factions, allDet, allEnh } = await FD.collect();
  const byId = new Map(factions.map(f => [f.id, f]));
  const out = [];
  for (const f of factions) {
    // Vokabular: Keywords, die Einheiten dieser Fraktion (inkl. Elternkatalog bei Orden) tragen – ohne Fraktions-Keyword
    const pool = [...f.units, ...(f.parent && byId.get(f.parent) ? byId.get(f.parent).units : [])];
    if (!pool.length) continue;
    const cnt = new Map();
    pool.forEach(u => new Set(u.keywords.map(k => k.toLowerCase())).forEach(k => cnt.set(k, (cnt.get(k) || 0) + 1)));
    const vocab = [...cnt.entries()].filter(([k, n]) => n < .6 * pool.length && !GENERIC.has(k) && k.length >= 3).map(([k]) => k).sort((a, b) => b.length - a.length);
    for (const d of allDet.filter(x => x.factionId === f.id)) {
      const enh = allEnh.filter(e => e.factionId === f.id && e.detachment === d.name);
      const p = profileOf(textOf(idx.get(d.id)), enh.map(e => textOf(idx.get(e.id))), vocab);
      const up = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toUpperCase(), v]));
      out.push({
        id: d.id, faction: f.name, factionId: f.id, detachmentName: d.name, dp: d.dp, forceDispositions: d.forceDispositions,
        keywordsBonus: Object.keys(p.kw).map(k => k.toUpperCase()),
        keywordWeights: up(p.kw),
        excludedKeywords: Object.keys(p.not).map(k => k.toUpperCase()),
        excludedWeights: up(p.not),                 // ≥ 3 = in der Detachment-Regel selbst ausgeschlossen (hartes Veto)
        weaponAbilities: Object.keys(p.wpn).map(k => k.toUpperCase()),
        abilities: Object.keys(p.abil).map(k => k.toUpperCase()),
        style: p.style,
        rules: d.rules,
        enhancements: enh.map(e => ({ id: e.id, name: e.name, cost: e.points, ...(e.upgrade ? { upgrade: true } : {}), description: CFG.withText ? (e.text || textOf(idx.get(e.id))) : '' })),
        stratagems: []
      });
    }
  }
  fs.mkdirSync(CFG.out, { recursive: true });
  const file = path.join(CFG.out, 'all_detachments.json');
  fs.writeFileSync(file, JSON.stringify({
    source: `https://github.com/${meta.repo}`, commit: meta.commit, commitDate: meta.date, generated: new Date().toISOString(), rulesText: CFG.withText,
    note: 'keywordsBonus/keywordWeights sind aus den BSData-Regeltexten abgeleitet. BSData enthält keine Stratagems – stratagems bleibt leer.',
    count: out.length, detachments: out
  }) + '\n');
  const withKw = out.filter(d => d.keywordsBonus.length).length, withAny = out.filter(d => d.keywordsBonus.length || d.weaponAbilities.length || d.abilities.length || d.style).length;
  log(`✓ ${out.length} Detachments · ${withKw} mit Keyword-Profil · ${withAny} mit irgendeinem Profil → ${path.relative(process.cwd(), file)}`);
  log(`  Quelle ${meta.repo}@${meta.commit} · ${((Date.now() - t0) / 1000).toFixed(1)} s${CFG.withText ? ' · mit Regeltexten' : ''} · Stratagems: 0 (nicht in BSData)`);
})().catch(e => die(e.stack || e.message));

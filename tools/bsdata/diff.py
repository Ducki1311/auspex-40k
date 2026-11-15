#!/usr/bin/env python3
"""Auspex 40k – BSData-Änderungsbericht (v18.37)

Vergleicht zwei Konvertierungen der BSData-Kataloge (tools/bsdata/convert.py): den Stand, auf dem die App
gebaut ist (version.json → source.commit), und den neuesten Stand. So werden nur echte Änderungen bei BSData
gemeldet – unabhängig von den Handkorrekturen der App. Ausgegeben werden nur Namen und Zahlen, kein Regeltext.

Aufruf: python3 tools/bsdata/diff.py ALT.json NEU.json --out bericht.json --md bericht.md
"""
import json, sys, argparse

ap = argparse.ArgumentParser()
ap.add_argument('old'); ap.add_argument('new')
ap.add_argument('--out'); ap.add_argument('--md')
a = ap.parse_args()
A = {f['name']: f for f in json.load(open(a.old))['factions']}
B = {f['name']: f for f in json.load(open(a.new))['factions']}

# Kategorien: relevant = ändert Punkte, Regeln oder Listenbau; info = nur Darstellung
RELEVANT = ['punkte', 'staffelpreise', 'neueEinheit', 'entfernteEinheit', 'profile', 'waffen', 'ausruestung', 'anfuehrer',
            'schluesselwoerter', 'detachmentNeu', 'detachmentEntfernt', 'detachmentPunkte', 'enhancementNeu', 'enhancementEntfernt',
            'enhancementPunkte', 'fraktionNeu', 'fraktionEntfernt']
rep = {'summary': {}, 'factions': {}}
def add(f, cat, item):
    rep['factions'].setdefault(f, {}).setdefault(cat, []).append(item)
    rep['summary'][cat] = rep['summary'].get(cat, 0) + 1

sizes = lambda u: [(s.get('models'), s.get('points')) for s in u.get('sizes') or []]
def lo_sig(u):
    out = []
    for m in u.get('models') or []:
        l = m.get('lo') or {}
        out.append((m.get('n'), m.get('min'), m.get('max'), tuple(sorted(x.get('n') for x in l.get('fixed', []))),
                    tuple((s.get('n'), s.get('min'), s.get('max'), tuple(sorted((o.get('n'), o.get('p')) for o in s.get('opts', [])))) for s in l.get('slots', [])),
                    tuple(sorted((t.get('n'), t.get('p')) for t in l.get('toggles', [])))))
    return sorted(out, key=lambda x: str(x))
W = lambda w: (str(w.get('t')), str(w.get('r')), str(w.get('a')), str(w.get('sk')), str(w.get('s')), str(w.get('ap')), str(w.get('d')), str(w.get('kw', '')))

for fn in sorted(set(A) | set(B)):
    if fn not in A: add(fn, 'fraktionNeu', {'name': fn}); continue
    if fn not in B: add(fn, 'fraktionEntfernt', {'name': fn}); continue
    fa, fb = A[fn], B[fn]
    ua = {u['id']: u for u in fa['units']}; ub = {u['id']: u for u in fb['units']}
    na = {u['name']: u for u in fa['units']}
    for i, u in ub.items():
        if i not in ua and u['name'] not in na: add(fn, 'neueEinheit', {'unit': u['name'], 'legends': bool(u.get('legends')), 'punkte': sizes(u)})
    nb = {u['name'] for u in fb['units']}
    for i, u in ua.items():
        if i not in ub and u['name'] not in nb: add(fn, 'entfernteEinheit', {'unit': u['name'], 'legends': bool(u.get('legends'))})
    for i, u in ub.items():
        o = ua.get(i) or na.get(u['name'])
        if not o: continue
        nm = u['name']
        if sizes(o) != sizes(u): add(fn, 'punkte', {'unit': nm, 'alt': sizes(o), 'neu': sizes(u)})
        if (o.get('escalation') or []) != (u.get('escalation') or []): add(fn, 'staffelpreise', {'unit': nm, 'alt': o.get('escalation') or [], 'neu': u.get('escalation') or []})
        if (o.get('stats') or []) != (u.get('stats') or []): add(fn, 'profile', {'unit': nm})
        if sorted(o.get('kw') or []) != sorted(u.get('kw') or []):
            add(fn, 'schluesselwoerter', {'unit': nm, 'neu': sorted(set(u.get('kw') or []) - set(o.get('kw') or [])), 'weg': sorted(set(o.get('kw') or []) - set(u.get('kw') or []))})
        if lo_sig(o) != lo_sig(u): add(fn, 'ausruestung', {'unit': nm})
        la = {ua[x]['name'] if x in ua else x for x in (o.get('leads') or [])}; lb = {ub[x]['name'] if x in ub else x for x in (u.get('leads') or [])}
        if la != lb: add(fn, 'anfuehrer', {'unit': nm, 'neu': sorted(lb - la), 'weg': sorted(la - lb)})
        wa, wb = o.get('wpn') or {}, u.get('wpn') or {}
        for k in sorted(set(wa) & set(wb)):
            if W(wa[k]) != W(wb[k]): add(fn, 'waffen', {'unit': nm, 'weapon': k, 'alt': '/'.join(W(wa[k])[2:7]), 'neu': '/'.join(W(wb[k])[2:7])})
    wa, wb = fa.get('weapons') or {}, fb.get('weapons') or {}
    for k in sorted(set(wa) & set(wb)):
        if W(wa[k]) != W(wb[k]): add(fn, 'waffen', {'weapon': k, 'alt': '/'.join(W(wa[k])[2:7]), 'neu': '/'.join(W(wb[k])[2:7])})
    da = {d['name']: d for d in fa.get('detachments') or []}; db = {d['name']: d for d in fb.get('detachments') or []}
    for k in sorted(set(db) - set(da)): add(fn, 'detachmentNeu', {'name': k, 'dp': db[k].get('dp')})
    for k in sorted(set(da) - set(db)): add(fn, 'detachmentEntfernt', {'name': k})
    for k in sorted(set(da) & set(db)):
        if da[k].get('dp') != db[k].get('dp'): add(fn, 'detachmentPunkte', {'name': k, 'alt': da[k].get('dp'), 'neu': db[k].get('dp')})
    ea = {(e.get('detachment'), e['name']): e for e in fa.get('enhancements') or []}; eb = {(e.get('detachment'), e['name']): e for e in fb.get('enhancements') or []}
    for k in sorted(set(eb) - set(ea), key=str): add(fn, 'enhancementNeu', {'detachment': k[0], 'name': k[1], 'punkte': eb[k].get('points')})
    for k in sorted(set(ea) - set(eb), key=str): add(fn, 'enhancementEntfernt', {'detachment': k[0], 'name': k[1]})
    for k in sorted(set(ea) & set(eb), key=str):
        if ea[k].get('points') != eb[k].get('points'): add(fn, 'enhancementPunkte', {'detachment': k[0], 'name': k[1], 'alt': ea[k].get('points'), 'neu': eb[k].get('points')})

rep['relevant'] = sum(v for k, v in rep['summary'].items() if k in RELEVANT)
if a.out: json.dump(rep, open(a.out, 'w'), ensure_ascii=False, indent=1)
for f, cats in rep['factions'].items():
    for c, items in cats.items():
        for it in items: print('FIND\t' + f + '\t' + c + '\t' + json.dumps(it, ensure_ascii=False))
print('Änderungen gesamt:', sum(rep['summary'].values()), '· relevant:', rep['relevant'])
for k, v in sorted(rep['summary'].items(), key=lambda x: -x[1]): print(f'{v:5d} {k}')
if a.md:
    def fmt(c, it):
        if c == 'punkte': return f"**{it['unit']}**: {' / '.join(f'{m} Modelle {p}' for m, p in it['alt'])} → {' / '.join(f'{m} Modelle {p}' for m, p in it['neu'])}"
        if c in ('detachmentPunkte', 'enhancementPunkte'): return f"**{it['name']}**: {it['alt']} → {it['neu']}"
        if c == 'waffen': return f"**{it.get('unit', '')}** {it['weapon']}: {it['alt']} → {it['neu']}"
        if c == 'anfuehrer': return f"**{it['unit']}**: neu {', '.join(it['neu']) or '—'} · weg {', '.join(it['weg']) or '—'}"
        return '**' + (it.get('unit') or it.get('name') or '') + '**' + (' (Legends)' if it.get('legends') else '')
    L = ['## BSData-Änderungen', '', '| Kategorie | Anzahl |', '|---|---:|'] + [f'| {k} | {v} |' for k, v in sorted(rep['summary'].items(), key=lambda x: -x[1])] + ['']
    for f, cats in rep['factions'].items():
        L.append(f'### {f}')
        for c, items in cats.items():
            L.append(f'- {c}: ' + '; '.join(fmt(c, it) for it in items[:25]) + (f' (+{len(items) - 25})' if len(items) > 25 else ''))
        L.append('')
    open(a.md, 'w').write('\n'.join(L))

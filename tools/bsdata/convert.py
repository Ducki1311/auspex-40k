"""Konvertiert BSData wh40k-11e (BattleScribe-JSON) in das GAME_DATA-Format der App.

Nur Daten werden gelesen; nichts aus dem Repository wird ausgeführt.
Aufruf: python3 -I convert.py <bsdata-ordner> <ausgabe.json>
"""
import json, glob, os, re, sys, collections

D, OUT = sys.argv[1], sys.argv[2]
PT = '51b2-306e-1021-d207'

# ---------------------------------------------------------------- Laden
idx = {}            # id -> Objekt (erste Fundstelle)
owner = {}          # id -> Katalogname
cats = {}           # Dateiname -> Katalogobjekt
catById = {}

def walk(o, cat):
    if isinstance(o, dict):
        if 'id' in o and o['id'] not in idx:
            idx[o['id']] = o; owner[o['id']] = cat
        for v in o.values(): walk(v, cat)
    elif isinstance(o, list):
        for v in o: walk(v, cat)

for f in sorted(glob.glob(D + '/*.json')):
    c = list(json.load(open(f)).values())[0]
    cats[os.path.basename(f)] = c
    catById[c['id']] = c
for name, c in cats.items():
    walk(c, c['name'])

# Kategorie-IDs -> Namen
catName = {}
for c in cats.values():
    for ce in c.get('categoryEntries', []): catName[ce['id']] = ce['name']

# Ausnahmen: echte Datenblätter mit „Crusade“/„Relic“/„Purgation“ im Namen (Crusader Squad, Crusade Ancient, Land Raider
# Crusader, Knight Crusader, Purgation Squad, Relic Razorback …) dürfen nicht als Kreuzzugs-Eintrag herausfallen
CRUSADE = re.compile(r'crusade(?!rs?\b| ancient)|battle tall|battle honour|battle scar|weapon modif|crusade relic|^relics?$|rank\b|order of battle|agenda|experience|'
                     r'blackstone|battle trait|requisition|show/hide|planet power|commendation|logistics|purgation(?! squad)|diplomatic|military power|'
                     r'honour point|combat elixir|^warlord$|enhancements?$|detachment', re.I)

def pts_of(o):
    for c in o.get('costs', []) or []:
        if c.get('typeId') == PT: return c.get('value', 0) or 0
    return 0

def always_hidden(o):
    if o.get('hidden'): return True
    return False

def cons(o, field='selections'):
    mn = mx = None
    for c in o.get('constraints', []) or []:
        if c.get('field') != field or c.get('scope') not in ('parent', 'self'): continue
        if c['type'] == 'min': mn = c['value']
        if c['type'] == 'max': mx = c['value']
    return mn, mx

def resolve(link):
    """entryLink -> (Zielobjekt mit Link-Constraints/Kosten überlagert)"""
    t = idx.get(link.get('targetId'))
    if not t: return None
    merged = dict(t)
    if link.get('constraints'): merged['constraints'] = (t.get('constraints') or []) + link['constraints']
    if link.get('costs') and pts_of(link): merged['costs'] = link['costs']
    if link.get('modifiers'): merged['modifiers'] = (t.get('modifiers') or []) + link['modifiers']
    if link.get('hidden'): merged['hidden'] = True
    merged['_linkName'] = link.get('name')
    return merged

def children(o):
    """alle direkten Kinder (Einträge, Gruppen, aufgelöste Links)"""
    out = []
    for se in o.get('selectionEntries', []) or []: out.append(('entry', se))
    for g in o.get('selectionEntryGroups', []) or []: out.append(('group', g))
    for el in o.get('entryLinks', []) or []:
        t = resolve(el)
        if t is None: continue
        out.append(('group' if el.get('type') == 'selectionEntryGroup' else 'entry', t))
    return out

# ---------------------------------------------------------------- Profile
def char(p):
    return {c['name']: c.get('$text', '') for c in p.get('characteristics', []) or []}

def collect_profiles(o, seen=None, depth=0):
    """alle Profile im Teilbaum (inkl. infoLinks), ohne Crusade-Zweige"""
    if seen is None: seen = set()
    res = []
    if depth > 8: return res
    for p in o.get('profiles', []) or []: res.append(p)
    for il in o.get('infoLinks', []) or []:
        t = idx.get(il.get('targetId'))
        if t and il.get('type') == 'profile': res.append(t)
        elif t and il.get('type') == 'infoGroup': res += collect_profiles(t, seen, depth + 1)
    for kind, ch in children(o):
        if CRUSADE.search(ch.get('name', '') or '') or always_hidden(ch): continue
        key = ch.get('id')
        if key in seen: continue
        seen.add(key)
        res += collect_profiles(ch, seen, depth + 1)
    return res

def weapon_entry(p):
    ch = char(p)
    kind = 'R' if p.get('typeName', '').startswith('Ranged') else 'M'
    return {'t': kind, 'r': ch.get('Range', ''), 'a': ch.get('A', ''), 'sk': ch.get('BS', ch.get('WS', '')),
            's': ch.get('S', ''), 'ap': ch.get('AP', ''), 'd': ch.get('D', ''),
            'kw': '' if ch.get('Keywords', '-') in ('-', '') else ch.get('Keywords', '')}

def weapon_names_in(o):
    names = []
    for p in collect_profiles(o):
        if p.get('typeName') in ('Ranged Weapons', 'Melee Weapons'): names.append(p['name'])
    return names

# ---------------------------------------------------------------- Ausrüstung
def is_model(o): return o.get('type') == 'model'

def option_label(o):
    return (o.get('_linkName') or o.get('name') or '').strip()

def has_model_desc(o, depth=0):
    if depth > 3: return False
    for kind, ch in children(o):
        if is_model(ch): return True
        if (kind == 'group' or ch.get('type') == 'upgrade') and has_model_desc(ch, depth + 1): return True
    return False

def parse_loadout(o, weapons):
    """Waffen-/Ausrüstungsslots eines Modells oder einer Einheit (ohne Modelle)."""
    fixed, slots, toggles = [], [], []
    for kind, ch in children(o):
        name = option_label(ch)
        if not name or CRUSADE.search(name) or always_hidden(ch) or is_model(ch): continue
        if has_model_desc(ch): continue
        # v18.35: auch eine Gruppe MIT Standard-Auswahl ist ein reiner Container, wenn sie selbst keine Grenzen hat und
        # jedes Kind entweder eine eigene Untergruppe oder ein Pflicht-Eintrag (min ≥ 1) ist – z. B. „Wargear“ mit den
        # Untergruppen „Boltgun“ (1 aus 2) und „Power weapon“ (1 aus 2). Früher wurden diese zu EINEM Slot „0–4 aus 4“ verschmolzen.
        def _structured(g):
            kids = [(k2, c2) for k2, c2 in children(g) if option_label(c2) and not CRUSADE.search(option_label(c2)) and not always_hidden(c2) and not is_model(c2)]
            return bool(kids) and all(k2 == 'group' or (cons(c2)[0] or 0) >= 1 for k2, c2 in kids)
        if kind == 'group' and cons(ch) == (None, None) and (not ch.get('defaultSelectionEntryId') or _structured(ch)):
            # reiner Container (z. B. "Wargear"): Inhalt mit eigener Bedeutung übernehmen
            sub = parse_loadout(ch, weapons)
            fixed += sub.get('fixed', []); slots += sub.get('slots', []); toggles += sub.get('toggles', [])
            continue
        if kind == 'group':
            mn, mx = cons(ch)
            choices = []
            for k2, c2 in children(ch):
                n2 = option_label(c2)
                if not n2 or CRUSADE.search(n2) or always_hidden(c2) or is_model(c2): continue
                if k2 == 'group':   # verschachtelte Gruppe -> Einträge übernehmen
                    for k3, c3 in children(c2):
                        n3 = option_label(c3)
                        if n3 and not always_hidden(c3) and not CRUSADE.search(n3):
                            choices.append({'id': c3['id'], 'n': n3, 'p': pts_of(c3), 'w': weapon_names_in(c3)})
                    continue
                if (cons(c2)[0] or 0) >= 1 and k2 != 'group' and not mn:
                    # v18.35: Pflicht-Eintrag innerhalb einer Auswahlgruppe (min 1 je Eintrag, z. B. „Wargear“ des
                    # Ancient in Terminator Armour) – das ist feste Ausrüstung, keine Wahl
                    fixed.append({'n': n2, 'w': weapon_names_in(c2)})
                    continue
                choices.append({'id': c2['id'], 'n': n2, 'p': pts_of(c2), 'w': weapon_names_in(c2),
                                'mx': cons(c2)[1]})
            if not choices: continue
            dflt = ch.get('defaultSelectionEntryId')
            dname = None
            for c in choices:
                if c['id'] == dflt or (idx.get(dflt, {}).get('targetId') == c['id']): dname = c['n']
            if dname is None:
                for el in ch.get('entryLinks', []) or []:
                    if el.get('id') == dflt: dname = el.get('name')
            slots.append({'n': name, 'min': mn or 0, 'max': mx if mx is not None else len(choices),
                          'def': dname, 'opts': [{k: v for k, v in c.items() if k in ('n', 'p', 'w', 'mx') and v not in (None, [], '')} for c in choices]})
        else:
            mn, mx = cons(ch)
            w = weapon_names_in(ch)
            p = pts_of(ch)
            if mn and mn >= 1 and (mx in (None, mn)):
                fixed.append({'n': name, 'w': w, 'q': mn} if mn > 1 else {'n': name, 'w': w})
            else:
                toggles.append({'n': name, 'p': p, 'w': w, 'max': mx if mx is not None else 1})
    return {k: v for k, v in (('fixed', fixed), ('slots', slots), ('toggles', toggles)) if v}

PER_RE = re.compile(r'(\d+)\s*(?:\{this\}|[^0-9]*?)\s*(?:per|for every)\s*(\d+)\s*models', re.I)

def per_models(o):
    for m in o.get('modifiers', []) or []:
        if m.get('type') == 'add' and m.get('field') == 'error':
            mm = PER_RE.search(str(m.get('value', '')))
            if mm: return int(mm.group(1)), int(mm.group(2))
    return None

def parse_models(unit, weapons):
    """Liste der Modelltypen mit min/max und Ausrüstung."""
    models = []
    def visit(o, grp=None):
        for kind, ch in children(o):
            nm = option_label(ch)
            if always_hidden(ch) or CRUSADE.search(nm or ''): continue
            if is_model(ch):
                mn, mx = cons(ch)
                pm = per_models(ch)
                mdl = {'n': nm, 'min': mn or 0, 'max': mx if mx is not None else (mn or 1)}
                if grp: mdl['g'] = grp
                if pm: mdl['per'] = list(pm)
                lo = parse_loadout(ch, weapons)
                if lo: mdl['lo'] = lo
                models.append(mdl)
            elif kind == 'group' and has_model_desc(ch):
                mn, mx = cons(ch)
                gname = nm
                groups.append({'n': gname, 'min': mn or 0, 'max': mx})
                visit(ch, gname)
    groups = []
    if is_model(unit):
        lo = parse_loadout(unit, weapons)
        models.append({'n': unit['name'], 'min': 1, 'max': 1, **({'lo': lo} if lo else {})})
    else:
        visit(unit)
    return models, groups

def model_range(models, groups):
    gmin = {g['n']: g for g in groups}
    mn = mx = 0
    seen = set()
    for m in models:
        g = m.get('g')
        if g and g in gmin:
            if g in seen: continue
            seen.add(g)
            gg = gmin[g]
            mn += gg['min']
            mx += gg['max'] if gg['max'] is not None else sum(x['max'] for x in models if x.get('g') == g)
        else:
            mn += m['min']; mx += m['max']
    return max(mn, 1), max(mx, mn, 1)

# ---------------------------------------------------------------- Punkte
def cond_ok(c, n, unit_ids):
    t, v = c.get('type'), c.get('value')
    if c.get('field') != 'selections': return None
    cid = c.get('childId')
    if cid not in ('model',) and cid not in unit_ids: return None
    x = n
    return {'greaterThan': x > v, 'atLeast': x >= v, 'lessThan': x < v, 'atMost': x <= v,
            'equalTo': x == v, 'notEqualTo': x != v}.get(t)

def size_points(unit, nmin, nmax, model_ids):
    base = pts_of(unit)
    res = {}
    for n in range(nmin, nmax + 1):
        p = base
        for m in unit.get('modifiers', []) or []:
            if m.get('field') != PT: continue
            if m.get('conditionGroups'):
                if any(g.get('localConditionGroups') for g in m['conditionGroups']): continue  # Staffelkosten
                ok = True
                for g in m['conditionGroups']:
                    vals = [cond_ok(c, n, model_ids) for c in g.get('conditions', [])]
                    if any(v is None for v in vals): ok = False; break
                    ok = ok and (all(vals) if g['type'] == 'and' else any(vals))
                if not ok: continue
            elif m.get('conditions'):
                vals = [cond_ok(c, n, model_ids) for c in m['conditions']]
                if any(v is None for v in vals) or not all(vals): continue
            else:
                continue
            if m['type'] == 'set': p = m['value']
            elif m['type'] == 'increment': p += m['value']
            elif m['type'] == 'decrement': p -= m['value']
        res[n] = p
    # Brackets: jeweils größte Modellzahl je Preisstufe
    sizes, prev = [], None
    for n in range(nmin, nmax + 1):
        if prev is not None and res[n] != res[prev]:
            sizes.append({'models': prev, 'points': res[prev]}) if not sizes or sizes[-1]['models'] != prev else None
        prev = n
    sizes.append({'models': nmax, 'points': res[nmax]})
    # Mindestgröße immer anbieten, wenn sie billiger ist
    if res[nmin] != sizes[0]['points'] or sizes[0]['models'] != nmin:
        if not any(s['models'] == nmin for s in sizes):
            sizes.insert(0, {'models': nmin, 'points': res[nmin]})
    # Doppelte Preise mit unterschiedlicher Modellzahl entfernen (nur Stufen behalten)
    clean = []
    for s in sizes:
        if clean and clean[-1]['points'] == s['points']:
            clean[-1] = s
        else:
            clean.append(s)
    return clean

# --- Modell-Evaluator: ersetzt parse_models/model_range/size_points -------------
# Baut einen Baum aus Modellen und Modellgruppen, füllt ihn für jede mögliche
# Modellzahl regelkonform auf und berechnet daraus die Punkte.

def mnode(o, kind):
    mn, mx = cons(o)
    if kind == 'model':
        mn = mn or 0
        nomax = mx is None
        mx = mx if mx is not None else max(mn, 1)
    else:
        mn = mn or 0
    n = {'id': o['id'], 'tid': o.get('targetId'), 'name': option_label(o), 'kind': kind, 'min': mn, 'max': mx,
         'pts': pts_of(o) if kind == 'model' else 0, 'obj': o, 'ch': []}
    if kind == 'model' and nomax: n['nomax'] = True
    if kind == 'group':
        for k, c in children(o):
            nm = option_label(c)
            if always_hidden(c) or CRUSADE.search(nm or ''): continue
            if is_model(c): n['ch'].append(mnode(c, 'model'))
            elif (k == 'group' or c.get('type') == 'upgrade') and has_model_desc(c): n['ch'].append(mnode(c, 'group'))
        if n['max'] is None:
            n['max'] = sum(x['max'] for x in n['ch'] if x['max'] is not None) or None
        elif n['max'] > 1:
            # Modelle ohne eigene Obergrenze dürfen die Gruppe bis zu ihrem Maximum füllen
            # (z. B. Relic Terminators: 5–10 Modelle, Einzelmodelle ohne max-Constraint)
            for x in n['ch']:
                if x.get('nomax'): x['max'] = n['max']
    return n

def unit_tree(u):
    if is_model(u):
        root = {'id': u['id'] + '#root', 'name': u['name'], 'kind': 'group', 'min': 0, 'max': None, 'pts': 0, 'obj': u, 'ch': []}
        m = mnode(u, 'model'); m['min'] = 1; m['max'] = 1; m['pts'] = 0  # Grundkosten liegen auf der Einheit
        root['ch'].append(m)
        return root
    root = {'id': u['id'] + '#root', 'name': u['name'], 'kind': 'group', 'min': 0, 'max': None, 'pts': 0, 'obj': u, 'ch': []}
    for k, c in children(u):
        nm = option_label(c)
        if always_hidden(c) or CRUSADE.search(nm or ''): continue
        if is_model(c): root['ch'].append(mnode(c, 'model'))
        elif (k == 'group' or c.get('type') == 'upgrade') and has_model_desc(c): root['ch'].append(mnode(c, 'group'))
    return root

def is_choice(g):
    """Gruppe, aus der genau eine Zusammensetzung gewählt wird (z. B. 'Unit Composition')"""
    return g['kind'] == 'group' and g['max'] == 1 and g['ch'] and all(c['kind'] == 'group' for c in g['ch'])

def scenarios(node):
    """Alle Varianten des Baums, bei denen Auswahlgruppen auf eine Option festgelegt sind."""
    if node['kind'] == 'model': return [node]
    if is_choice(node):
        out = []
        for c in node['ch']:
            for v in scenarios(c):
                out.append({**node, 'min': 0, 'max': None, 'ch': [v], 'choice': True})
        return out
    combos = [[]]
    for c in node['ch']:
        vs = scenarios(c)
        combos = [cb + [v] for cb in combos for v in vs][:64]
    return [{**node, 'ch': cb} for cb in combos]

def models_of(node):
    if node['kind'] == 'model': return [node]
    return [m for c in node['ch'] for m in models_of(c)]

def fill(root, n):
    """Verteilt n Modelle; liefert {id: Anzahl} (Gruppen inkl.) oder None."""
    counts = {}
    parents = {}
    def index(nd, par):
        parents[nd['id']] = par
        for c in nd.get('ch', []): index(c, nd)
    index(root, None)
    ms = models_of(root)
    for m in ms: counts[m['id']] = m['min']
    def gsum(g):
        return sum(counts.get(m['id'], 0) for m in models_of(g))
    # Gruppen-Minima auffüllen
    def ensure_min(g):
        for c in g.get('ch', []):
            if c['kind'] == 'group': ensure_min(c)
        if g['kind'] == 'group' and g['min'] and gsum(g) < g['min']:
            need = g['min'] - gsum(g)
            for m in sorted(models_of(g), key=lambda x: (' w/' in x['name'], -(x['max'] or 0))):
                room = m['max'] - counts[m['id']]
                add = min(room, need); counts[m['id']] += add; need -= add
                if not need: break
    ensure_min(root)
    total = sum(counts.values())
    if total > n: return None
    extra = n - total
    def room(m):
        r = m['max'] - counts[m['id']]
        p = parents[m['id']]
        guard = 0
        while p is not None and guard < 20:
            guard += 1
            if p['kind'] == 'group' and p['max'] is not None:
                r = min(r, p['max'] - gsum(p))
            p = parents.get(p['id'])
        return max(r, 0)
    for m in sorted(ms, key=lambda x: (' w/' in x['name'] or ' with ' in x['name'], x['pts'] > 0, -(x['max'] or 0))):
        if not extra: break
        add = min(room(m), extra); counts[m['id']] += add; extra -= add
    if extra: return None
    def gcount(g):
        if g['kind'] == 'model': return counts[g['id']]
        s = sum(gcount(c) for c in g['ch']); counts[g['id']] = s
        if g.get('tid'): counts[g['tid']] = s
        return s
    gcount(root)
    for m in ms:
        if m.get('tid'): counts[m['tid']] = counts[m['id']]
    return counts

def cond_eval(c, counts, n, unit_id):
    if c.get('field') != 'selections': return None
    if c.get('scope') in ('roster', 'force', 'primary-catalogue'): return None
    cid = c.get('childId')
    if cid == 'model': x = n
    elif cid == unit_id: x = 1
    elif cid in counts: x = counts[cid]
    else: return None
    v = c.get('value')
    return {'greaterThan': x > v, 'atLeast': x >= v, 'lessThan': x < v, 'atMost': x <= v,
            'equalTo': x == v, 'notEqualTo': x != v, 'instanceOf': True}.get(c.get('type'))

def group_eval(g, counts, n, uid):
    vals = [cond_eval(c, counts, n, uid) for c in g.get('conditions', [])]
    vals += [group_eval(sg, counts, n, uid) for sg in g.get('conditionGroups', [])]
    if any(v is None for v in vals) or not vals: return None
    return all(vals) if g.get('type', 'and') == 'and' else any(vals)

def price(u, counts, n):
    p = pts_of(u)  # Einheitskosten; Modifikatoren ('set') gelten nur dafür
    extra = sum(m['pts'] * counts.get(m['id'], 0) for m in models_cache[u['id']])
    for m in u.get('modifiers', []) or []:
        if m.get('field') != PT: continue
        cg = m.get('conditionGroups') or []
        if any(g.get('localConditionGroups') for g in cg): continue          # Staffelkosten separat
        if m.get('conditions'):
            ok = group_eval({'type': 'and', 'conditions': m['conditions']}, counts, n, u['id'])
        elif cg:
            ok = group_eval({'type': 'and', 'conditionGroups': cg}, counts, n, u['id'])
        else:
            continue
        if not ok: continue
        if m['type'] == 'set': p = m['value']
        elif m['type'] == 'increment': p += m['value']
        elif m['type'] == 'decrement': p -= m['value']
    return p + extra

models_cache = {}

def unit_sizes(u):
    root = unit_tree(u)
    pairs = {}
    scs = scenarios(root)
    # Zusätzlich: Varianten ohne optionale, extra bepunktete Modelle (z. B. Attack Bike im
    # Bike Squad) – sonst füllt fill() sie immer zuerst auf und günstigere Größen fehlen.
    def strip_opt(nd):
        if nd['kind'] == 'model':
            return {**nd, 'max': 0} if (nd['min'] == 0 and nd['pts'] > 0) else nd
        return {**nd, 'ch': [strip_opt(c) for c in nd['ch']]}
    scs = scs + [strip_opt(sc) for sc in scs]
    for sc in scs:
        models_cache[u['id']] = models_of(sc)
        ms = models_of(sc)
        lo = fill(sc, 0) and None
        nmin = None
        for n in range(1, 61):
            c = fill(sc, n)
            if c is None:
                if nmin is not None: break
                continue
            if nmin is None: nmin = n
            p = price(u, c, n)
            if n not in pairs or p < pairs[n]: pairs[n] = p
    if not pairs: return [{'models': 1, 'points': pts_of(u)}], root
    ns = sorted(pairs)
    sizes = []
    for i, n in enumerate(ns):
        nxt = ns[i + 1] if i + 1 < len(ns) else None
        if nxt is None or pairs[nxt] != pairs[n] or nxt != n + 1:
            sizes.append({'models': n, 'points': pairs[n]})
    # Mindestgröße ergänzen, falls sie im gleichen Preis wie die nächste Stufe steckt
    if sizes and sizes[0]['models'] != ns[0] and pairs[ns[0]] != sizes[0]['points']:
        sizes.insert(0, {'models': ns[0], 'points': pairs[ns[0]]})
    return sizes, root

def ui_models(root, weapons):
    """Modelltypen für die Oberfläche (Vereinigung über alle Varianten)."""
    out = {}
    def walk(nd, grp):
        for c in nd['ch']:
            if c['kind'] == 'model':
                key = c['name']
                lo = parse_loadout(c['obj'], weapons) if c['obj'] is not root['obj'] else parse_loadout(c['obj'], weapons)
                pm = per_models(c['obj'])
                e = out.get(key) or {'n': key, 'min': c['min'], 'max': c['max']}
                e['min'] = min(e['min'], c['min']); e['max'] = max(e['max'], c['max'])
                if grp and 'g' not in e: e['g'] = grp
                if pm: e['per'] = list(pm)
                if lo and 'lo' not in e: e['lo'] = lo
                if c['pts']: e['p'] = c['pts']
                out[key] = e
            else:
                walk(c, c['name'] if not is_choice(c) else grp)
    walk(root, None)
    return list(out.values())

def escalation(unit):
    out = []
    for m in unit.get('modifiers', []) or []:
        if m.get('field') != PT or m.get('type') != 'increment': continue
        for g in m.get('conditionGroups', []) or []:
            for lg in g.get('localConditionGroups', []) or []:
                if any(c.get('type') == 'instanceOf' for c in lg.get('conditions', [])):
                    # Wert = Anzahl gleicher Einheiten VOR dieser; ab Kopie Nr. (after+1) wird es teurer
                    out.append({'after': lg.get('value', 1), 'add': m['value']})
    return out

# ---------------------------------------------------------------- Einheit
def categories(unit, link):
    names = []
    for cl in (unit.get('categoryLinks') or []) + (link.get('categoryLinks') or []):
        names.append(cl.get('name') or catName.get(cl.get('targetId'), ''))
    return names

def num(x):
    m = re.match(r'\d+', str(x or ''))
    return int(m.group()) if m else 0

PHASE_RX = [
    ('command',  r"command phase|battle-shock|battleshock|command point"),
    ('movement', r"movement phase|normal move|advance[sd]? |advancing|fall(s|ing)? back|deep strike|strategic reserves|reserves|redeploy|set up"),
    ('shooting', r"shooting phase|ranged attack|ranged weapon|shoot|eligible to shoot"),
    ('charge',   r"charge phase|charge roll|declares? a charge|made a charge move|charge move"),
    ('fight',    r"fight phase|melee attack|melee weapon|fights first|pile[sd]? in|consolidat"),
]
def classify_phases(text):
    t = (text or '').lower()
    out = []
    for ph, rx in PHASE_RX:
        for m in re.finditer(rx, t):
            ctx = t[max(0, m.start() - 22):m.start()]
            key = ('enemy:' + ph) if ("opponent's" in ctx or 'opponent’s' in ctx) else ph
            if key not in out: out.append(key)
    if not out and 'makes an attack' in t: out = ['shooting', 'fight']
    return out
CORE_PHASES = {
    'Deep Strike': ['movement'], 'Scouts': ['deploy'], 'Infiltrators': ['deploy'], 'Stealth': ['enemy:shooting'],
    'Lone Operative': ['enemy:shooting'], 'Fights First': ['fight'], 'Firing Deck': ['shooting'], 'Hover': ['movement'],
    'Feel No Pain': ['passive'], 'Deadly Demise': ['passive'], 'Leader': ['deploy']
}
def core_rules(u):
    names, fnp = [], 0
    def visit(o, depth=0):
        nonlocal fnp
        if depth > 3: return
        for il in o.get('infoLinks', []) or []:
            if il.get('type') != 'rule': continue
            nm = il.get('name', '')
            for m in il.get('modifiers', []) or []:
                if m.get('field') == 'name' and m.get('type') == 'append': nm = f"{nm} {m.get('value')}"
            if nm.startswith('Feel No Pain'):
                mm = re.search(r'(\d)\+', nm)
                if mm: fnp = int(mm.group(1)) if not fnp else min(fnp, int(mm.group(1)))
            if nm and nm not in names: names.append(nm)
        for k, ch in children(o):
            if is_model(ch) and not always_hidden(ch): visit(ch, depth + 1)
    visit(u)
    return names[:12], fnp

def parse_unit(link):
    u = resolve(link)
    if u and u.get('type') == 'upgrade' and any(p.get('typeName') == 'Unit' for p in u.get('profiles') or []) and '[Legends]' in (u.get('name') or ''):
        u = {**u, 'type': 'model'}   # z. B. X-101 [Legends]: als Ausrüstung angelegtes Datenblatt
    if not u or always_hidden(u) or u.get('type') not in ('unit', 'model'): return None
    name = u['name']
    legends = '[Legends]' in name
    if '[Crucible]' in name or CRUSADE.search(name.replace('[Legends]', '')): return None
    if re.search(r'crusade', (u.get('comment') or '') + (link.get('comment') or '') if isinstance(link, dict) else (u.get('comment') or ''), re.I): return None
    name = name.replace(' [Legends]', '').replace('[Legends]', '').strip()
    cs = categories(u, link)
    if not cs: return None
    weapons = {}
    sizes, root = unit_sizes(u)
    models = ui_models(root, weapons)
    groups = []
    profs = collect_profiles(u)
    stats, wset, abil, phases = [], {}, [], {}
    for p in profs:
        tn = p.get('typeName')
        if tn == 'Unit':
            c = char(p)
            row = {'n': p['name'], 'm': c.get('M', ''), 't': c.get('T', ''), 'sv': c.get('SV', c.get('Sv', '')),
                   'w': c.get('W', ''), 'ld': c.get('LD', c.get('Ld', '')), 'oc': c.get('OC', '')}
            inv = c.get('InSv', c.get('Inv', ''))
            if inv and re.match(r'\d\+', inv): row['inv'] = inv
            if row not in stats: stats.append(row)
        elif tn in ('Ranged Weapons', 'Melee Weapons'):
            wset[p['name']] = weapon_entry(p)
        elif tn in ('Abilities',):
            if p['name'] not in abil: abil.append(p['name'])
            ph = classify_phases(char(p).get('Description', ''))
            if ph: phases[p['name']] = ph
    unit_loadout = parse_loadout(u, weapons) if not is_model(u) else None

    if 'Character' in cs: role = 'character'
    elif 'Battleline' in cs: role = 'battleline'
    elif 'Dedicated Transport' in cs: role = 'transport'
    elif 'Monster' in cs: role = 'monster'
    elif 'Vehicle' in cs or 'Fortification' in cs: role = 'vehicle'
    else: role = 'infantry'

    # Leader-Ziele: BSData verschachtelt sie (or → and → or) und knüpft manche an Detachments
    # (z. B. CSM: Chaos Lord führt in „Pactbound Zealots“ zusätzliche Einheiten). Rekursiv lesen:
    #  - Zweige ohne „Detachment muss gewählt sein“ → leads (immer gültig)
    #  - Zweige mit atLeast-Bedingung auf ein Detachment → leadsDet[detId]
    leads, leads_det = [], {}
    def lead_branch(g, need):
        need = list(need)
        for c in g.get('conditions', []) or []:
            if c.get('type') in ('atLeast', 'greaterThan') and c.get('scope') in ('force', 'roster') and c.get('childId') and (c.get('value') or 0) >= (1 if c['type'] == 'atLeast' else 0):
                need.append(c['childId'])
        tg = [c['childId'] for c in g.get('conditions', []) or [] if c.get('type') == 'instanceOf' and c.get('childId') and c.get('scope', 'self') in ('self', 'parent')]
        if tg:
            if need:
                for d in need: leads_det.setdefault(d, []).extend(tg)
            else: leads.extend(tg)
        for sub in g.get('conditionGroups', []) or []: lead_branch(sub, need)
    for a in u.get('associations', []) or []:
        if a.get('name', '').lower().startswith('lead') or a.get('name', '').lower().startswith('support'):
            lead_branch({'conditions': a.get('conditions', []), 'conditionGroups': a.get('conditionGroups', [])}, [])

    s0 = stats[0] if stats else {}
    oc = num(s0.get('oc'))
    T, W = num(s0.get('t')), num(s0.get('w'))
    M = num(s0.get('m'))
    tags = []
    if leads or 'Leader' in cs: tags.append('leader')
    if role == 'battleline' or oc >= 2: tags.append('objective')
    def wnum(x): return num(x)
    at = ai = False
    for wn, w in wset.items():
        kw = w['kw'].lower()
        if wnum(w['s']) >= 9 or 'anti-vehicle' in kw or 'anti-monster' in kw or 'lance' in kw or 'melta' in kw or ('d6' in w['d'].lower() and wnum(w['s']) >= 7):
            at = True
        if 'torrent' in kw or 'blast' in kw or 'anti-infantry' in kw or 'sustained' in kw or ('d6' in w['a'].lower() and w['t'] == 'R') or wnum(w['a']) >= 4:
            ai = True
    if at: tags.append('antitank')
    if ai: tags.append('antiinfantry')
    if T >= 9 or W >= 10 or (s0.get('sv', '').startswith('2') and W >= 3): tags.append('durable')
    if M >= 10 or 'Fly' in cs: tags.append('fast')
    if any('deep strike' in a.lower() for a in abil): tags.append('deepstrike')
    if 'Psyker' in cs: tags.append('psyker')
    if 'Support' in cs: tags.append('support')
    rating = 5 + ('durable' in tags) + ('antitank' in tags) + (1 if role == 'character' and leads else 0) + (2 if 'Epic Hero' in cs else 0) + (1 if 'antiinfantry' in tags else 0)

    out = {
        'id': u['id'], 'name': name, 'role': role,
        'sizes': sizes, 'oc': oc, 'tags': tags, 'rating': min(rating, 9),
        'stats': stats, 'abilities': abil[:14],
        'models': models,
    }
    if groups: out['groups'] = groups
    if unit_loadout: out['unitLoadout'] = unit_loadout
    if 'Epic Hero' in cs: out['epicHero'] = True
    if legends: out['legends'] = True
    if 'Character' in cs and role != 'character': out['character'] = True
    if 'Leader' in cs: out['charType'] = 'leader'
    if 'Support' in cs: out['charType'] = 'support'
    if leads: out['_leads'] = leads
    if leads_det: out['_leadsDet'] = leads_det
    esc = escalation(u)
    if esc: out['escalation'] = esc
    allied = [c for c in cs if c.startswith('Faction:')]
    out['_factions'] = allied
    out['_allcats'] = list(cs)   # alle Keywords (z. B. „Crisis“, „Ironkin Steeljacks“) – nur für die Leader-Auflösung
    out['_cats'] = [c for c in cs if c in ('Infantry', 'Vehicle', 'Monster', 'Mounted', 'Beast', 'Swarm', 'Fly', 'Titanic', 'Aircraft', 'Walker', 'Psyker', 'Transport', 'Fortification', 'Character', 'Epic Hero', 'Battleline', 'Dedicated Transport', 'Daemon', 'Primarch')]
    out['kw'] = [c for c in out['_cats'] if c in ('Infantry', 'Vehicle', 'Monster', 'Mounted', 'Beast', 'Swarm', 'Fly', 'Titanic', 'Aircraft', 'Walker', 'Fortification', 'Daemon', 'Primarch')]
    out['_weapons'] = wset
    core, fnp = core_rules(u)
    if core: out['core'] = core
    if fnp: out['fnp'] = fnp
    for r in core:
        cp = CORE_PHASES.get(re.sub(r'\s*\d.*$', '', r))
        if cp: phases[r] = cp
    if phases: out['phases'] = phases
    return out

# ---------------------------------------------------------------- Fraktionen
SKIP = re.compile(r'library|titanicus|unaligned|warhammer 40,000', re.I)

def own_links(c):
    return [el for el in c.get('entryLinks', []) or [] if el.get('type') == 'selectionEntry']

# Bibliotheken, die zur jeweiligen Fraktion selbst gehören (alles andere = Verbündete)
OWN_LIBS = {
    'Aeldari - Aeldari Library': ['Xenos - Aeldari'],
    'Chaos - Daemons Library': ['Chaos - Chaos Daemons'],
    'Chaos - Chaos Knights Library': ['Chaos - Chaos Knights'],
    'Imperium - Imperial Knights - Library': ['Imperium - Imperial Knights'],
    'Library - Tyranids': ['Xenos - Tyranids'],
    'Imperium - Astra Militarum - Library': ['Imperium - Astra Militarum'],
}
SM_NAME = 'Imperium - Adeptus Astartes - Space Marines'

def faction_links(c, seen):
    """eigene Root-Links + Root-Einträge der eigenen Bibliothek; Elternfraktion für Orden"""
    links = list(own_links(c))
    parent = None
    for cl in c.get('catalogueLinks', []) or []:
        tc = catById.get(cl.get('targetId'))
        if not tc: continue
        if tc['name'] == SM_NAME and c['name'] != SM_NAME:
            parent = SM_NAME; continue
        if cl.get('importRootEntries') and c['name'] in OWN_LIBS.get(tc['name'], []):
            links += own_links(tc)
    return links, parent

def linked_libraries(c):
    out = []
    for cl in c.get('catalogueLinks', []) or []:
        tc = catById.get(cl.get('targetId'))
        if tc and tc.get('library') and not re.search(r'unaligned|titans|heresy', tc['name'], re.I):
            out.append(tc)
    return out

def detachments(c):
    res, enh = [], []
    det_ids = {}
    roots = [el for el in own_links(c) if el.get('name') == 'Detachment']
    for lib in linked_libraries(c):
        if c['name'] in OWN_LIBS.get(lib['name'], []):
            roots += [el for el in own_links(lib) if el.get('name') == 'Detachment']
    for se in c.get('sharedSelectionEntries', []) or []:
        if se.get('name') == 'Detachment': roots.append({'targetId': se['id']})
    for r in roots:
        t = idx.get(r['targetId'])
        if not t: continue
        def find(o, depth=0):
            for kind, ch in children(o):
                dp = [x['value'] for x in ch.get('costs', []) or [] if x.get('name') == 'Detachment Points']
                if dp and ch.get('type') == 'upgrade':
                    if ch['id'] not in det_ids:
                        det_ids[ch['id']] = ch['name']
                        rnames = [r.get('name') for r in ch.get('rules', []) or []]
                        rnames += [il.get('name') for il in ch.get('infoLinks', []) or [] if il.get('type') == 'rule']
                        DISP = ('Take and Hold', 'Purge the Foe', 'Disruption', 'Reconnaissance', 'Priority Assets')
                        disp = [cl.get('name') or catName.get(cl.get('targetId'), '') for cl in ch.get('categoryLinks', []) or []]
                        res.append({'id': ch['id'], 'name': ch['name'], 'dp': dp[0], 'rules': [r for r in rnames if r],
                                    'dispositions': [x for x in disp if x in DISP]})
                elif depth < 3:
                    find(ch, depth + 1)
        find(t)
    def det_of(o):
        blob = json.dumps(o.get('modifiers', []))
        for did, dn in det_ids.items():
            if did in blob: return dn
        for dn in det_ids.values():
            nm = o.get('name', '') or ''
            if nm.startswith(dn + ' ') or nm == dn or o.get('comment') == dn: return dn
        return None
    def enh_tags(o):
        # Wirkungs-Klassen aus dem Regeltext ableiten – gespeichert werden NUR die Klassen, nicht der Text
        txt = ' '.join(cc.get('$text', '') or '' for pr in o.get('profiles', []) or [] for cc in pr.get('characteristics', []) or [])
        txt += ' ' + ' '.join((il.get('name') or '') for il in o.get('infoLinks', []) or [])
        t = txt.lower()
        T = []
        chk = lambda tag, *pats: T.append(tag) if any(re.search(pt, t) for pt in pats) else None
        chk('lethal', r'lethal hits'); chk('sustained', r'sustained hits'); chk('devastating', r'devastating wounds')
        chk('hit', r'add 1 to the hit roll', r'\+1 to hit', r're-roll (a |the )?hit roll')
        chk('wound', r'add 1 to the wound roll', r'\+1 to wound', r're-roll (a |the )?wound roll')
        chk('attacks', r'add 1 to the attacks', r'\+1 attacks?', r'add 1 to the strength', r'add 1 to the damage', r'improve the armour penetration')
        chk('precision', r'\bprecision\b'); chk('fightsfirst', r'fights first'); chk('fnp', r'feel no pain')
        chk('invuln', r'invulnerable save'); chk('tough', r'subtract 1 from the (wound|damage)', r'add 1 to (the )?toughness', r'\b2\+ sv\b', r'add 1 to (its|the) wounds')
        chk('stealth', r'\bstealth\b', r'benefit of cover'); chk('aura', r'\(aura\)', r'\baura\b')
        chk('move', r'deep strike', r'\bscouts\b', r'infiltrators', r'advance and (declare a )?charge', r'add \d+" to the move', r'fall back and')
        chk('cp', r'command point', r'\bcp\b', r'stratagem')
        if re.search(r"(models in )?the bearer'?s unit|while this model is leading a unit|the unit it is leading|this model'?s unit", t): T.append('unit')
        return T
    def enh_scan(o, inherited=None):
        for kind, ch in children(o):
            if ch.get('type') == 'upgrade' and any(x.get('name') == 'Enhancements' and x.get('value') for x in ch.get('costs', []) or []) and not always_hidden(ch):
                det = det_of(ch) or inherited
                if not det: continue
                e = {'id': ch['id'], 'name': ch['name'], 'points': pts_of(ch), 'detachment': det}
                if upgrade_grp[0]: e['upgrade'] = True
                tg = enh_tags(ch)
                if tg: e['tags'] = tg
                if all(x['id'] != e['id'] for x in enh): enh.append(e)
            elif kind == 'group':
                enh_scan(ch, det_of(ch) or inherited)
    upgrade_grp = [False]
    for src in [c] + linked_libraries(c):
        for g in src.get('sharedSelectionEntryGroups', []) or []:
            if 'nhancement' in g.get('name', ''):
                upgrade_grp[0] = 'pgrade' in g['name']
                enh_scan(g)
    return res, enh

result = []
for fname, c in sorted(cats.items()):
    if SKIP.search(c['name']) or c.get('library'): continue
    if os.environ.get('ONLY') and os.environ['ONLY'] not in c['name']: continue
    links, parent = faction_links(c, {c['id']})
    units, weapons = [], {}
    seen_ids = set()
    for el in links:
        if el.get('hidden'): continue
        try:
            _t0 = __import__('time').time()
            u = parse_unit(el)
            _dt = __import__('time').time() - _t0
            if os.environ.get('TIMING') and _dt > 0.5: print(f"  langsam: {el.get('name')} {_dt:.1f}s", file=sys.stderr, flush=True)
        except RecursionError:
            u = None
        if not u or u['id'] in seen_ids or not u['sizes'] or u['sizes'][0]['points'] <= 0: continue
        seen_ids.add(u['id'])
        u['_wset'] = u.pop('_weapons')
        units.append(u)
    # Waffenprofile: Fraktionsprofil = häufigstes Profil je Name; Einheiten mit abweichendem Profil
    # (z. B. Demolisher Cannon der Space Marines vs. Chaos) bekommen eine eigene Kopie in u['wpn'].
    prof_count = collections.defaultdict(collections.Counter)
    for u in units:
        for wn, w in u['_wset'].items(): prof_count[wn][json.dumps(w, sort_keys=True)] += 1
    for wn, cnt in prof_count.items(): weapons[wn] = json.loads(cnt.most_common(1)[0][0])
    for u in units:
        own = {wn: w for wn, w in u.pop('_wset').items() if json.dumps(w, sort_keys=True) != json.dumps(weapons[wn], sort_keys=True)}
        if own: u['wpn'] = own
    fc = collections.Counter(x for u in units for x in u['_factions'] if x not in ('Faction: Imperium', 'Faction: Chaos'))
    primary = fc.most_common(1)[0][0] if fc else None
    own_kw = 'Faction: ' + re.sub(r'^(Imperium|Chaos|Xenos|Aeldari) - ', '', c['name']).replace('Adeptus Astartes - ', '')
    if own_kw in fc: primary = own_kw
    if c['name'].endswith('Space Marines') or 'Adeptus Astartes' in c['name']: primary = 'Faction: Adeptus Astartes' if 'Faction: Adeptus Astartes' in fc else primary
    for u in units:
        if primary and primary not in u['_factions'] and u['_factions']:
            u['ally'] = ', '.join(x.replace('Faction: ', '') for x in u['_factions'] if x != 'Faction: Chaos' and x != 'Faction: Imperium')
    dets, enh = detachments(c)
    nm = re.sub(r'^(Imperium|Chaos|Xenos|Aeldari) - ', '', c['name'])
    nm = nm.replace('Adeptus Astartes - ', '').replace(' - Library', '')
    result.append({'catalogue': c['name'], 'name': nm, 'parentCatalogue': parent, 'revision': c.get('revision'),
                   'units': units, 'weapons': weapons, 'detachments': dets, 'enhancements': enh})

# Leader-IDs auf Einheiten-IDs (oder Kategorien) abbilden
for f in result:
    pool = f['units'][:]
    if f['parentCatalogue']:
        p = next((x for x in result if x['catalogue'] == f['parentCatalogue']), None)
        if p: pool += p['units']
    by_id = {u['id']: u for u in pool}
    for u in f['units']:
        ids = []
        for cid in u.pop('_leads', []):
            if cid in by_id: ids.append(cid)
            elif cid in catName:
                cn = catName[cid]
                ids += [x['id'] for x in pool if cn in x.get('_allcats', x.get('_cats', [])) or cn == x['name']]
        if ids: u['leads'] = sorted(set(ids), key=ids.index)
        ld = {}
        for det, cids in u.pop('_leadsDet', {}).items():
            xs = [c for c in cids if c in by_id] + [x['id'] for c in cids if c not in by_id and c in catName for x in pool if catName[c] in x.get('_allcats', x.get('_cats', [])) or catName[c] == x['name']]
            xs = [x for x in dict.fromkeys(xs) if x not in ids]
            if xs: ld[det] = xs
        if ld: u['leadsDet'] = ld

for f in result:
    for u in f['units']: u.pop('_allcats', None)
json.dump({'source': 'BSData/wh40k-11e', 'factions': result}, open(OUT, 'w'))
for f in result:
    print(f"{f['name']:<28} units={len(f['units']):>3} weapons={len(f['weapons']):>4} det={len(f['detachments']):>2} enh={len(f['enhancements']):>3} parent={f['parentCatalogue']}")

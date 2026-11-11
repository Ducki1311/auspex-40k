// Auspex 40k – gelerntes Zusammenspiel-Modell (v18.33)
// Lernt aus den einzelnen Siegerlisten einer Fraktion, welche Datenblätter gemeinsam gespielt werden und wie oft ein
// Datenblatt mehrfach vorkommt. Gespeichert werden nur Zahlen je Datenblatt-Paar – keine Listen, keine Namen.
//
//   lists  [[unitId, unitId, …], …]   eine Zeile je Siegerliste (Mehrfachnennung = mehrere Exemplare)
//   →      { n, ids:[…], pairs:[[i, j, w], …], cp:{ id:[p2, p3] } }
//          w   geglättetes Log-Chancenverhältnis (>0: treten gemeinsam auf, <0: schließen sich aus), auf ±3 begrenzt
//          cp  Anteil der Listen mit ≥2 Exemplaren unter denen mit ≥1, und mit ≥3 unter denen mit ≥2
function trainPairModel(lists, opt = {}) {
  const n = lists.length, minN = opt.minLists || 12;
  if (n < minN) return null;
  const alpha = opt.alpha || 1.5, maxPairs = opt.maxPairs || 160, minW = opt.minW || 0.6;
  const sets = lists.map(l => new Set(l));
  const cnt = new Map(); sets.forEach(s => s.forEach(u => cnt.set(u, (cnt.get(u) || 0) + 1)));
  const minC = Math.max(3, Math.ceil(n * 0.05));
  const ids = [...cnt].filter(([, c]) => c >= minC).sort((a, b) => b[1] - a[1]).slice(0, 48).map(([u]) => u);
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j]; let n11 = 0;
    sets.forEach(s => { if (s.has(a) && s.has(b)) n11++; });
    const na = cnt.get(a), nb = cnt.get(b), n10 = na - n11, n01 = nb - n11, n00 = n - na - nb + n11;
    const exp = na * nb / n;                                   // erwartete gemeinsame Listen bei Unabhängigkeit
    if (n11 < 3 && exp < 3) continue;                          // zu wenig Daten für eine Aussage
    if (na / n > .9 || nb / n > .9) continue;                  // steht ohnehin in fast jeder Liste → sagt über den Partner nichts aus
    const w = Math.log(((n11 + alpha) * (n00 + alpha)) / ((n10 + alpha) * (n01 + alpha)));
    if (Math.abs(w) < minW) continue;
    pairs.push([i, j, Math.max(-3, Math.min(3, +w.toFixed(1))), Math.abs(w) * Math.sqrt(Math.max(n11, exp))]);
  }
  pairs.sort((x, y) => y[3] - x[3]);
  const kept = pairs.slice(0, maxPairs).map(p => p.slice(0, 3));
  const cp = {};
  ids.forEach(u => { let c1 = 0, c2 = 0, c3 = 0; lists.forEach(l => { const k = l.filter(x => x === u).length; if (k >= 1) c1++; if (k >= 2) c2++; if (k >= 3) c3++; });
    if (c1 >= 5) cp[u] = [+((c2 + .5) / (c1 + 1)).toFixed(2), +((c3 + .5) / (c2 + 1.5)).toFixed(2)]; });
  return { n, ids, pairs: kept, cp };
}
module.exports = { trainPairModel };

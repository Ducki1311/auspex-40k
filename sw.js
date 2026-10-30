/* Service Worker für Auspex 40k – macht die App vollständig offline-fähig.
 *
 *  Installation:  Alle App-Dateien werden frisch geladen und GEPRÜFT (Status 200, gleiche Herkunft,
 *                 index.html vollständig). Fehlt etwas, schlägt die Installation fehl und der alte,
 *                 funktionierende Stand bleibt aktiv – nie ein halber Cache.
 *                 Sofort aktiv: skipWaiting() + clients.claim() – kein Neustart der App nötig.
 *  Seite:         Ist eine geprüfte Kopie im Cache, kommt sie SOFORT (kein Warten aufs Netz);
 *                 im Hintergrund wird die aktuelle Version geholt, geprüft und für den nächsten
 *                 Start gespeichert. Ohne Kopie (allererster Start) geht die Antwort des Netzes
 *                 ungebremst an die Seite durch – sie kann sofort anfangen zu rendern.
 *                 Navigation Preload: das Netz wird schon angefragt, während der Worker startet.
 *  Schriften:     Cache First in einem eigenen, versionsunabhängigen Cache.
 *  Selbstprüfung: Die App fragt per Nachricht {type:'CHECK'} nach; fehlende Dateien werden nachgeladen.
 *
 *  Bei neuen Versionen VERSION erhöhen – dann lädt die App beim nächsten Start einmal neu.
 */
const VERSION = 'v29';
const PREFIX = 'auspex40k-';
const CACHE = PREFIX + VERSION;
const FONT_CACHE = PREFIX + 'fonts';
const PAGE = './index.html';
// './' wird NICHT extra geladen: es ist dieselbe Seite (spart beim ersten Start einen zweiten 4-MB-Download)
const ASSETS = [PAGE, './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon.ico', './favicon-32.png', './logo.png'];

/** Antwort nur annehmen, wenn sie vollständig und von hier ist */
async function validResponse(url, res) {
  if (!res || !res.ok || res.status !== 200 || (res.type !== 'basic' && res.type !== 'default')) return false;
  if (url.endsWith('/') || url.endsWith('.html')) {
    const text = await res.clone().text();
    return text.includes('Auspex 40k') && text.trimEnd().endsWith('</html>');
  }
  if (url.endsWith('.webmanifest')) { try { JSON.parse(await res.clone().text()); return true; } catch (e) { return false; } }
  return true;
}
async function fetchAndStore(cache, url) {
  const res = await fetch(new Request(url, { cache: 'reload' }));
  if (!(await validResponse(url, res))) throw new Error('Ungültige Antwort für ' + url + ' (' + res.status + ')');
  await cache.put(url, res);
}

self.addEventListener('install', event => {
  self.skipWaiting();                       // sofort aktivieren, nicht auf das Schließen aller Tabs warten
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Alle oder keine: schlägt eine Datei fehl, wird der neue Cache verworfen
    try { await Promise.all(ASSETS.map(u => fetchAndStore(cache, u))); }
    catch (err) { await caches.delete(CACHE); throw err; }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (e) { /* nicht unterstützt */ } }
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();             // offene Seiten sofort übernehmen
  })());
});

const offlinePage = () => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Auspex 40k</title><body style="font-family:sans-serif;background:#121417;color:#e4e7ec;padding:2rem"><h1>Auspex 40k</h1><p>Offline und noch nicht gespeichert. Bitte einmal mit Internet öffnen.</p><p>Offline and not cached yet. Please open once while online.</p><p><a href="./" style="color:#E5A93B">Neu laden / Reload</a></p>',
  { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

/** Seite aus dem Netz holen und – nur wenn vollständig und gültig – für den nächsten Start speichern */
async function refreshPage(event, preload) {
  const res = (await preload) || await fetch(event.request, { cache: 'no-store' });
  if (await validResponse(PAGE, res)) { const cache = await caches.open(CACHE); await cache.put(PAGE, res.clone()); }
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;   // KI-Anfragen u. Ä. gehen direkt ins Netz

  // 1) Seite: Cache zuerst (sofortiger Start), Aktualisierung im Hintergrund
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    const preload = event.preloadResponse ? event.preloadResponse.catch(() => null) : Promise.resolve(null);
    event.respondWith((async () => {
      const cached = await caches.match(PAGE, { cacheName: CACHE }) || await caches.match(PAGE);
      if (cached) {
        event.waitUntil(refreshPage(event, preload).catch(() => {}));   // nächster Start bekommt die neue Version
        return cached;
      }
      // Allererster Start: Netz-Antwort direkt durchreichen (Seite rendert, während sie lädt), Kopie im Hintergrund prüfen
      try {
        const res = (await preload) || await fetch(req);
        if (res && res.ok) {
          const copy = res.clone();
          event.waitUntil((async () => { if (await validResponse(PAGE, copy)) await (await caches.open(CACHE)).put(PAGE, copy); })().catch(() => {}));
        }
        return res;
      } catch (e) { return offlinePage(); }
    })());
    return;
  }

  // 2) Schriften: Cache First (eigener Cache, bleibt über Versionen erhalten)
  if (isFont) {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) event.waitUntil(cache.put(req, res.clone()));
        return res;
      } catch (e) { return new Response('', { status: 504 }); }
    })());
    return;
  }

  // 3) Übrige eigene Dateien: Cache First, im Hintergrund nur mit gültiger Antwort aktualisieren
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const refresh = fetch(req).then(async res => {
      if (await validResponse(url.pathname, res)) await cache.put(req, res.clone());
      return res;
    });
    if (hit) { event.waitUntil(refresh.catch(() => {})); return hit; }
    try { return await refresh; } catch (e) { return new Response('', { status: 504 }); }
  })());
});

/* Selbstprüfung: fehlt eine Datei im Cache, wird sie (wenn online) nachgeladen */
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'CHECK') return;
  const reply = msg => { if (event.ports && event.ports[0]) event.ports[0].postMessage(msg); else if (event.source) event.source.postMessage(msg); };
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const missing = [];
    for (const u of ASSETS) if (!(await cache.match(u))) missing.push(u);
    const repaired = [];
    for (const u of missing) { try { await fetchAndStore(cache, u); repaired.push(u); } catch (e) { /* offline – später erneut */ } }
    reply({ type: 'CHECK_RESULT', version: VERSION, total: ASSETS.length, missing: missing.filter(u => !repaired.includes(u)), repaired });
  })());
});

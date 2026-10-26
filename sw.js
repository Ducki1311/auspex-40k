/* Service Worker für Auspex 40k: speichert die App beim ersten Besuch,
   danach funktioniert sie komplett offline. Bei neuen Versionen CACHE erhöhen.
   Die Seite selbst wird immer zuerst frisch aus dem Netz geladen (Network First),
   nur ohne Internet kommt sie aus dem Speicher. */
const CACHE = 'auspex40k-v11';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  // cache: 'reload' umgeht den Browser-Cache, damit wirklich die neue Version gespeichert wird
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isPage) {
    // Network First: online immer die aktuelle Version, offline die gespeicherte
    event.respondWith(fetch(req, { cache: 'no-store' }).then(res => {
      if (res && res.ok) caches.open(CACHE).then(c => c.put('./index.html', res.clone()));
      return res;
    }).catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // Übrige Dateien: zuerst aus dem Cache, im Hintergrund aktualisieren
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: url.origin === location.origin });
    const network = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || network;
  }));
});

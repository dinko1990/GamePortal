/* arcade-sw.js - lets arcade games work offline (e.g. on a flight).
   Put this file in the main GamePortal folder (next to index.html). Games register it automatically.
   Same-site files are served from the cache first and refreshed in the background.
   A few trusted image/data hosts are cached too, but only when a game saves them on purpose. */
const CACHE = 'arcade-v1';
const EXTRA = ['flagcdn.com', 'cdn.jsdelivr.net', 'commons.wikimedia.org', 'upload.wikimedia.org'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url), same = u.origin === location.origin, extra = EXTRA.includes(u.hostname);
  if (!same && !extra) return; // login and database calls always go to the network
  e.respondWith((async () => {
    const c = await caches.open(CACHE), hit = await c.match(r);
    if (extra && hit) return hit;
    const net = fetch(r).then(res => { if (res.ok && (same || res.type === 'cors')) c.put(r, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (r.mode === 'navigate' ? (await c.match(new URL('index.html', self.registration.scope))) || Response.error() : Response.error());
  })());
});

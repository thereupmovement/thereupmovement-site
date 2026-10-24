/* ReUp Hub offline helper. The page opens from the network when it can, and from the last saved copy when
   there is no signal. Images and fonts are kept so they show at once. Server requests are never stored. */
const V = 'reup-hub-v1';
const SCOPE = new URL('./', self.location).pathname;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
const keep = (req, res) => { if (res && res.ok) { const c = res.clone(); caches.open(V).then(ca => ca.put(req, c)); } return res; };
const swr = req => caches.match(req).then(hit => {
  const net = fetch(req).then(res => keep(req, res)).catch(() => hit);
  return hit || net;
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) {
    if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) e.respondWith(swr(r));
    return;
  }
  if (!u.pathname.startsWith(SCOPE) || u.pathname.endsWith('version.json') || u.pathname.endsWith('sw.js')) return;
  if (r.mode === 'navigate' || u.pathname === SCOPE || u.pathname.endsWith('/index.html')) {
    const page = new Request(SCOPE);
    e.respondWith(fetch(r).then(res => keep(page, res)).catch(() => caches.match(page).then(m => m || Response.error())));
    return;
  }
  if (/\.(webp|png|jpg|jpeg|svg|woff2?)$/i.test(u.pathname)) e.respondWith(swr(r));
});

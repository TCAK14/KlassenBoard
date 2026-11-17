// ClassPuls – Service Worker
// Ziel: als App installierbar und bei kurzem WLAN-Ausfall weiter benutzbar.
// Die Seite selbst kommt IMMER zuerst aus dem Netz (neueste Version), der Speicher ist nur Ersatz.
// Server-Funktionen, Anmeldung, Cloud und fremde Seiten werden nie angefasst.
const CACHE = 'classpuls-v1';
const CORE = [
  '/',
  '/manifest.webmanifest',
  '/fonts/atkinson-hyperlegible-next-latin.woff2',
  '/fonts/atkinson-hyperlegible-next-latin-ext.woff2',
  '/icons/icon-192.png',
  '/favicon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(CORE.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('classpuls-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('timeout')), ms);
  promise.then(r => { clearTimeout(t); resolve(r); }, e => { clearTimeout(t); reject(e); });
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // Supabase, Bilder, PDF.js … unverändert
  if (url.pathname.startsWith('/.netlify/')) return;           // Server-Funktionen nie aus dem Speicher

  // Seitenaufrufe: Netz zuerst (mit Geduld bei langsamem WLAN), sonst die zuletzt gespeicherte Version
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await withTimeout(fetch(req), 8000);
        if (res.ok && (url.pathname === '/' || url.pathname === '/index.html')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/', copy)).catch(() => {});
        }
        return res;
      } catch (e) {
        const cached = await caches.match(url.pathname === '/' || url.pathname === '/index.html' ? '/' : req, { ignoreSearch: true });
        return cached || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Schrift und Symbole ändern sich nie: aus dem Speicher, sonst laden und merken
  if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    })));
  }
  // alles andere: normal übers Netz
});

// ClassPuls – Service Worker
// Ziel: ClassPuls startet vom Gerät (auch bei schlechtem oder fehlendem WLAN) und aktualisiert sich im Hintergrund.
// - Die Tafel-Seite: höchstens 1,2 s auf das Netz warten, sonst die gespeicherte Version zeigen; die neue Version
//   wird trotzdem fertig geladen und gespeichert. Die Seite fragt per Nachricht „kb-check" nach und lädt sich
//   in einem ruhigen Moment selbst neu (siehe index.html, „Aktualisierung im Hintergrund").
// - Schrift, Symbole, Bibliotheken (/vendor/): aus dem Speicher.
// - Server-Funktionen, Anmeldung, Cloud und fremde Seiten werden nie angefasst.
const CACHE = 'classpuls-v5';
const PAGE = '/';
// Unter scolavis.de/.com ist die Startadresse die Verkaufsseite – die Tafel liegt dort unter /index.html.
// Unter klassenboard.netlify.app (Android-App, bestehende Nutzer) bleibt die Tafel die Startadresse.
// (…workers.dev ist die Test-Adresse bei Cloudflare und verhält sich wie scolavis.de.)
const LANDING_HOST = /(^|\.)scolavis\.(de|com)$|\.workers\.dev$/.test(self.location.hostname);
const APP_URL = '/index.html';
const isAppPath = p => p === '/index.html' || (p === '/' && !LANDING_HOST);
const CORE = [
  '/manifest.webmanifest',
  '/fonts/atkinson-hyperlegible-next-latin.woff2',
  '/fonts/atkinson-hyperlegible-next-latin-ext.woff2',
  '/icons/icon-192.png',
  '/favicon.png',
  '/vendor/qrcode-1.0.0.min.js',
  '/vendor/supabase-2.119.0.js',
];

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('timeout')), ms);
  promise.then(r => { clearTimeout(t); resolve(r); }, e => { clearTimeout(t); reject(e); });
});

// Kennung einer Seiten-Version: Prüfsumme über den Inhalt
async function versionOf(buf) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', buf));
  let s = '';
  for (let i = 0; i < 6; i++) s += (hash[i] < 16 ? '0' : '') + hash[i].toString(16);
  return s;
}

// Nur die echte Tafel-Seite speichern – nie eine Fehler- oder Anmeldeseite des WLANs
const looksLikeApp = text => text.indexOf('WIDGET_RENDERERS') !== -1 && text.lastIndexOf('</html>') > text.length - 200;

async function cachedPage() {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(PAGE);
    if (!hit) return null;
    const buf = await hit.arrayBuffer();
    return { text: new TextDecoder().decode(buf), ver: hit.headers.get('X-KB-Ver') || await versionOf(buf) };
  } catch (e) { return null; }
}

// Neueste Version holen und speichern. Immer vollständig laden, bevor etwas weitergegeben wird –
// so kommt bei wackligem WLAN nie eine halbe Seite an. Läuft höchstens einmal gleichzeitig.
let pending = null;
function refreshPage() {
  if (!pending) {
    pending = (async () => {
      const res = await fetch(APP_URL, { cache: 'no-cache', credentials: 'same-origin' });
      if (!res.ok) throw new Error('status ' + res.status);
      const buf = await res.arrayBuffer();
      const text = new TextDecoder().decode(buf);
      if (!looksLikeApp(text)) throw new Error('unexpected page');
      const ver = await versionOf(buf);
      const cache = await caches.open(CACHE);
      const old = await cache.match(PAGE);
      if (!old || old.headers.get('X-KB-Ver') !== ver) {
        await cache.put(PAGE, new Response(buf, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-KB-Ver': ver } }));
      }
      return { text, ver };
    })();
    const done = () => { pending = null; };
    pending.then(done, done);
  }
  return pending;
}

// Die Seite bekommt ihre Versions-Kennung mit (<html data-kb-ver="…">), damit sie später vergleichen kann
function pageResponse(p) {
  const html = p.text.replace(/<html(?=[\s>])/i, '<html data-kb-ver="' + p.ver + '"');
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(CORE.map(url => cache.add(url).catch(() => {}))))
      .then(() => refreshPage().catch(() => {}))
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

// Die Seite fragt: „Gibt es eine neuere Version?" → nachsehen, speichern, Kennung zurückmelden
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'kb-check' || !event.source) return;
  const client = event.source;
  event.waitUntil(
    refreshPage().then(p => client.postMessage({ type: 'kb-ver', ver: p.ver })).catch(() => {})
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // Supabase, Bilder, PDF.js … unverändert
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;   // Server-Funktionen nie aus dem Speicher

  if (req.mode === 'navigate') {
    // Die Tafel: vom Gerät starten, im Hintergrund aktualisieren
    if (isAppPath(url.pathname)) {
      const net = refreshPage();
      event.waitUntil(net.catch(() => {}));                    // auch nach der Antwort fertig laden und speichern
      event.respondWith((async () => {
        const cached = await cachedPage();
        if (!cached) {
          try { return pageResponse(await net); } catch (e) { return fetch(req); }
        }
        try { return pageResponse(await withTimeout(net, 1200)); }
        catch (e) { return pageResponse(cached); }
      })());
      return;
    }
    // Andere Seiten (Landing, Impressum …): Netz zuerst; ohne Netz zeigen Adressen ohne .html die Tafel
    event.respondWith((async () => {
      try { return await withTimeout(fetch(req), 8000); }
      catch (e) {
        const cached = /\.html$/.test(url.pathname) ? null : await cachedPage();
        return cached ? pageResponse(cached) : Response.error();
      }
    })());
    return;
  }

  // Schrift, Symbole und Bibliotheken ändern sich nie (Version steckt im Dateinamen): aus dem Speicher, sonst laden und merken
  if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/vendor/')) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      // fehlende Dateien beantwortet der Server mit der Tafel-Seite (HTML) – so etwas nie merken
      if (res.ok && !/text\/html/i.test(res.headers.get('Content-Type') || '')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    })));
  }
  // alles andere: normal übers Netz
});

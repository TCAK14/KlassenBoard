// Holt einen iCal-Stundenplan (z.B. WebUntis) serverseitig ab.
// Der Browser darf das wegen CORS nicht direkt — und der Kalender-Link enthält einen
// persönlichen Schlüssel, der nicht über fremde öffentliche Proxys laufen soll.

const ALLOWED_ORIGIN = 'https://klassenboard.netlify.app';
const MAX_BYTES = 3 * 1024 * 1024;

const headers = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (statusCode, obj) => ({
  statusCode,
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
});

// Keine Abrufe ins interne Netz (SSRF) — nur öffentliche http(s)-Adressen
function isPublicHttpUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return false;
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  // Nur die eigene Seite darf den Endpunkt nutzen (kein offener Proxy für andere)
  const origin = event.headers.origin || event.headers.Origin || '';
  if (origin && origin !== ALLOWED_ORIGIN) return json(403, { error: 'Nicht erlaubt' });

  let url;
  try { url = String(JSON.parse(event.body || '{}').url || '').trim(); }
  catch (e) { return json(400, { error: 'Ungültige Anfrage' }); }
  if (!url || url.length > 2000 || !isPublicHttpUrl(url)) {
    return json(400, { error: 'Ungültiger Kalender-Link' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'ClassPuls-Stundenplan/1.0', 'Accept': 'text/calendar, text/plain, */*' },
    });
    if (!res.ok) return json(502, { error: 'Kalender-Server antwortet mit Fehler ' + res.status });

    const length = Number(res.headers.get('content-length') || 0);
    if (length > MAX_BYTES) return json(413, { error: 'Kalender ist zu groß' });

    const text = await res.text();
    if (text.length > MAX_BYTES) return json(413, { error: 'Kalender ist zu groß' });
    // Nur echte Kalenderdaten durchreichen — der Endpunkt ist kein allgemeiner Web-Proxy
    if (!/BEGIN:VCALENDAR/i.test(text)) return json(422, { error: 'Unter diesem Link liegt kein Kalender' });

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' },
      body: text,
    };
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    return json(504, { error: timedOut ? 'Kalender-Server antwortet nicht' : 'Kalender konnte nicht abgerufen werden' });
  } finally {
    clearTimeout(timer);
  }
};

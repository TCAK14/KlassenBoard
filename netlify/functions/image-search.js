// Bildersuche für den KI-Assistenten: Pixabay (mit Jugendschutz-Filter), ersatzweise Wikimedia Commons.
// Schlüssel liegen NUR in Netlify-Umgebungsvariablen.
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;
const ALLOWED_ORIGIN = 'https://klassenboard.netlify.app';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const reply = (statusCode, obj) => ({ statusCode, headers, body: JSON.stringify(obj) });

// Grundschutz gegen Missbrauch (pro Server-Instanz)
const PER_MINUTE = 20, PER_DAY = 400;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const list = (hits.get(ip) || []).filter(t => now - t < 86400000);
  if (list.filter(t => now - t < 60000).length >= PER_MINUTE || list.length >= PER_DAY) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}

// Übersetzt den Suchbegriff ins Englische (Pixabay findet so deutlich besser) und prüft dabei,
// ob das Motiv für eine Schulklasse geeignet ist. Antwort "BLOCK" = kein Bild zeigen.
async function smartTranslate(query) {
  if (!GEMINI_KEY) return query;
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text:
            'Convert this to the BEST English Pixabay search query to find a clean photo of exactly this subject.\n\n'
            + 'Rules:\n'
            + '- The image will be shown to school children. If the subject is sexual, pornographic, gory, glorifies violence or drugs, or is otherwise unsuitable for a school class, reply with exactly: BLOCK\n'
            + '- Fix any spelling mistakes first\n'
            + '- Use simple English words that Pixabay understands\n'
            + '- For objects: add "isolated" to get clean product-style photos\n'
            + '- For animals: add the animal type (e.g. "primate", "bird")\n'
            + '- Keep brand names and model numbers exact\n'
            + '- Max 4 words\n'
            + '- Reply with ONLY the search query, nothing else\n\n'
            + 'Examples:\n'
            + 'schmipansen -> chimpanzee primate\n'
            + 'banane -> banana isolated\n'
            + 'stift -> pen isolated\n'
            + 'deutschland trikot -> germany soccer jersey\n'
            + 'schwarze hose -> black pants isolated\n'
            + 'audi a5 -> audi a5\n'
            + 'schmetterling -> butterfly isolated\n'
            + 'vulkan -> volcano eruption\n'
            + 'roter apfel -> red apple isolated\n\n'
            + 'Convert: ' + query
          }] }],
          generationConfig: { maxOutputTokens: 24, temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!res.ok) return query;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    return text ? text.replace(/["'\n]/g, ' ').trim().slice(0, 80) : query;
  } catch (e) { return query; }
}

async function searchPixabay(query, type, index) {
  if (!PIXABAY_KEY) return null;
  try {
    const url = 'https://pixabay.com/api/?key=' + PIXABAY_KEY
      + '&q=' + encodeURIComponent(query)
      + '&image_type=' + (type === 'illustration' ? 'illustration' : 'photo')
      + '&per_page=8&safesearch=true&order=popular';
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.hits || data.hits.length === 0) return null;
    const hit = data.hits[index % data.hits.length];
    return { url: hit.webformatURL, credit: 'Pixabay', more: data.hits.length > 1 };
  } catch (e) { return null; }
}

async function searchWikimedia(query, index) {
  try {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query'
      + '&generator=search&gsrnamespace=6&gsrsearch=' + encodeURIComponent(query + ' photo')
      + '&gsrlimit=8&prop=imageinfo&iiprop=url|size'
      + '&iiurlwidth=640&format=json';
    const res = await fetch(url, { headers: { 'User-Agent': 'ClassPuls/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.query?.pages) return null;
    const images = Object.values(data.query.pages)
      .filter(p => {
        const info = p.imageinfo?.[0];
        if (!info?.thumburl) return false;
        if (/\.(svg|tiff?|pdf|djvu)(\.|$)/i.test(info.thumburl)) return false;
        if ((info.width || 0) < 300) return false;
        return true;
      })
      .map(p => p.imageinfo[0].thumburl);
    if (!images.length) return null;
    return { url: images[index % images.length], credit: 'Wikimedia Commons', more: images.length > 1 };
  } catch (e) { return null; }
}

// Bild auf dem Server laden und als data:-Adresse zurückgeben. Vorteile: Der Browser im
// Klassenzimmer ruft keinen fremden Bilderdienst auf, und das Bild bleibt auf der Tafel
// erhalten (die Adressen von Pixabay verfallen nach einem Tag).
async function toDataUrl(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ClassPuls/1.0' } });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 900 * 1024) return null;   // zu groß für Tafel-Speicher und Antwortgröße
    return 'data:' + type + ';base64,' + buf.toString('base64');
  } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'method' });
  // Nur die eigene Seite darf suchen (Browser senden bei POST immer einen Origin-Header)
  const origin = event.headers.origin || event.headers.Origin || '';
  if (origin !== ALLOWED_ORIGIN) return reply(403, { error: 'forbidden' });

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
  if (rateLimited(ip)) return reply(429, { error: 'rate' });

  try {
    const body = JSON.parse(event.body || '{}');
    const query = typeof body.query === 'string' ? body.query.trim().slice(0, 100) : '';
    if (!query) return reply(400, { url: null, error: 'invalid' });
    const type = body.type === 'illustration' ? 'illustration' : 'photo';
    const index = Math.max(0, Math.min(50, parseInt(body.index, 10) || 0));

    const englishQuery = await smartTranslate(query);
    if (/^\W*BLOCK\W*$/i.test(englishQuery)) return reply(200, { url: null, blocked: true });

    // Pixabay zuerst (bessere Qualität, Jugendschutz-Filter), sonst Wikimedia
    const found = (await searchPixabay(englishQuery, type, index))
      || (type === 'illustration' ? await searchPixabay(englishQuery, 'photo', index) : null)
      || (await searchWikimedia(englishQuery, index));
    if (!found) return reply(200, { url: null });

    const out = { url: found.url, credit: found.credit, more: !!found.more };
    if (body.inline) {
      const dataUrl = await toDataUrl(found.url);
      if (dataUrl) out.dataUrl = dataUrl;
    }
    return reply(200, out);

  } catch (err) {
    console.error('image-search', err);
    return reply(200, { url: null, error: 'unavailable' });
  }
};

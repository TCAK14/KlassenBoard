const GEMINI_KEY = process.env.GEMINI_API_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://klassenboard.netlify.app',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function smartTranslate(query) {
  if (!GEMINI_KEY) return query;
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text:
            'Convert this to the BEST English Pixabay search query to find a clean, isolated photo of exactly this subject.\n\n'
            + 'Rules:\n'
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
            + 'iphone 3g -> iphone 3g\n'
            + 'schmetterling -> butterfly isolated\n'
            + 'roter apfel -> red apple isolated\n\n'
            + 'Convert: ' + query
          }] }],
          generationConfig: { maxOutputTokens: 15, temperature: 0 }
        })
      }
    );
    if (!res.ok) return query;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || query;
  } catch (e) { return query; }
}

async function searchPixabay(query) {
  if (!PIXABAY_KEY) return null;
  try {
    const url = 'https://pixabay.com/api/?key=' + PIXABAY_KEY
      + '&q=' + encodeURIComponent(query)
      + '&image_type=photo&per_page=3&safesearch=true&order=popular';
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.hits || data.hits.length === 0) return null;
    return data.hits[0].webformatURL;
  } catch (e) { return null; }
}

async function searchWikimedia(query) {
  try {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query'
      + '&generator=search&gsrnamespace=6&gsrsearch=' + encodeURIComponent(query + ' photo')
      + '&gsrlimit=5&prop=imageinfo&iiprop=url|size'
      + '&iiurlwidth=640&format=json';
    const res = await fetch(url, { headers: { 'User-Agent': 'ClassPuls/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.query?.pages) return null;
    const images = Object.values(data.query.pages)
      .filter(p => {
        const info = p.imageinfo?.[0];
        if (!info?.thumburl) return false;
        if (info.thumburl.includes('.svg')) return false;
        if (info.thumburl.includes('.tiff')) return false;
        if ((info.width || 0) < 300) return false;
        return true;
      })
      .map(p => p.imageinfo[0].thumburl);
    return images[0] || null;
  } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const { query } = JSON.parse(event.body);
    if (!query || typeof query !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ url: null }) };
    }

    const englishQuery = await smartTranslate(query);

    // Pixabay first (better quality, better ranking)
    const pixUrl = await searchPixabay(englishQuery);
    if (pixUrl) {
      return { statusCode: 200, headers, body: JSON.stringify({ url: pixUrl }) };
    }

    // Fallback: Wikimedia
    const wikiUrl = await searchWikimedia(englishQuery);
    return { statusCode: 200, headers, body: JSON.stringify({ url: wikiUrl }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ url: null, error: err.message }) };
  }
};

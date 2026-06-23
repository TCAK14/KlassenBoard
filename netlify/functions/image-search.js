const GEMINI_KEY = process.env.GEMINI_API_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://klassenboard.netlify.app',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function askGemini(prompt, maxTokens) {
  if (!GEMINI_KEY) return null;
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens || 20, temperature: 0 }
      })
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

async function searchWikimedia(query) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query'
    + '&generator=search&gsrnamespace=6&gsrsearch=' + encodeURIComponent(query)
    + '&gsrlimit=10&prop=imageinfo&iiprop=url|size|extmetadata'
    + '&iiurlwidth=640&format=json';
  const res = await fetch(url, { headers: { 'User-Agent': 'KlassenBoard/1.0' } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.query?.pages) return [];
  return Object.values(data.query.pages)
    .filter(p => p.imageinfo?.[0]?.thumburl)
    .map(p => ({
      title: p.title.replace('File:', '').replace(/\.[^.]+$/, ''),
      url: p.imageinfo[0].thumburl,
      w: p.imageinfo[0].width || 0,
      h: p.imageinfo[0].height || 0,
      desc: (p.imageinfo[0].extmetadata?.ImageDescription?.value || '').replace(/<[^>]*>/g, '').slice(0, 80),
      source: 'wikimedia'
    }))
    .filter(img => img.w >= 200 && img.h >= 150 && !img.url.includes('.svg') && !img.url.includes('.tiff'));
}

async function searchPixabay(query) {
  if (!PIXABAY_KEY) return [];
  const url = 'https://pixabay.com/api/?key=' + PIXABAY_KEY
    + '&q=' + encodeURIComponent(query)
    + '&image_type=photo&per_page=10&safesearch=true';
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.hits) return [];
  return data.hits.map(h => ({
    title: h.tags || '',
    url: h.webformatURL,
    w: h.webformatWidth || 0,
    h: h.webformatHeight || 0,
    desc: h.tags || '',
    source: 'pixabay'
  }));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { query } = JSON.parse(event.body);
    if (!query || typeof query !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ url: null }) };
    }

    // Step 1: Gemini corrects typos + translates to precise English
    const englishQuery = await askGemini(
      'You are a search query optimizer. The user wants to see a PHOTO of something.\n\n'
      + 'Your job:\n'
      + '1. Fix any spelling mistakes\n'
      + '2. Translate to English\n'
      + '3. Add "isolated" or "close up" for simple objects\n'
      + '4. Keep brand/model names exact\n\n'
      + 'Reply with ONLY the optimized English search query. Max 6 words.\n\n'
      + 'Examples:\n'
      + 'schmipansen -> chimpanzee close up\n'
      + 'banane -> banana fruit isolated\n'
      + 'stift -> pen isolated white background\n'
      + 'audi a5 -> Audi A5 car\n'
      + 'deutschland trikot -> Germany football jersey\n'
      + 'iphone 3g -> iPhone 3G\n'
      + 'schwarze hose -> black pants isolated\n\n'
      + 'Now optimize: ' + query,
      20
    ) || query;

    // Step 2: Search both Wikimedia AND Pixabay in parallel
    const [wikiResults, pixResults] = await Promise.all([
      searchWikimedia(englishQuery),
      searchPixabay(englishQuery)
    ]);

    const allImages = [...pixResults, ...wikiResults].slice(0, 15);

    if (allImages.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ url: null }) };
    }

    if (allImages.length === 1) {
      return { statusCode: 200, headers, body: JSON.stringify({ url: allImages[0].url }) };
    }

    // Step 3: Gemini picks the BEST clean photo
    const listing = allImages.map((img, i) =>
      (i + 1) + '. [' + img.source + '] "' + img.title + '"' + (img.desc ? ' - ' + img.desc : '')
    ).join('\n');

    const bestIdx = await askGemini(
      'The user wants a CLEAN photo of: "' + query + '"\n\n'
      + 'Rules for the BEST photo:\n'
      + '- Shows ONLY this exact subject, nothing else\n'
      + '- NO people holding/wearing the item (unless the search IS a person)\n'
      + '- NO busy backgrounds, NO collages, NO diagrams\n'
      + '- NO black-and-white historical photos\n'
      + '- Prefer: isolated object, clean background, modern color photo\n'
      + '- For animals: close-up portrait of the animal\n'
      + '- For products: product photo, no hands\n'
      + '- For clothing: flat lay or on hanger, no model\n\n'
      + 'Images:\n' + listing + '\n\n'
      + 'Reply with ONLY the number of the best image. Nothing else.',
      5
    );

    let picked = allImages[0];
    if (bestIdx) {
      const num = parseInt(bestIdx) - 1;
      if (num >= 0 && num < allImages.length) picked = allImages[num];
    }

    return { statusCode: 200, headers, body: JSON.stringify({ url: picked.url }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ url: null, error: err.message }) };
  }
};

const PIXABAY_KEY = process.env.PIXABAY_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://klassenboard.netlify.app',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function translateToEnglish(query) {
  if (!GEMINI_KEY) return query;
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Translate this to English search keywords for a photo search. Reply with ONLY the English keywords, nothing else: ' + query }] }],
          generationConfig: { maxOutputTokens: 30, temperature: 0 }
        })
      }
    );
    if (!res.ok) return query;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || query;
  } catch (e) {
    return query;
  }
}

async function searchPixabay(query) {
  const url = 'https://pixabay.com/api/?key=' + PIXABAY_KEY
    + '&q=' + encodeURIComponent(query)
    + '&image_type=photo&per_page=5&safesearch=true';
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.hits || data.hits.length === 0) return null;
  const pick = data.hits[Math.floor(Math.random() * Math.min(data.hits.length, 5))];
  return pick.webformatURL;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }
  if (!PIXABAY_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ url: null, error: 'PIXABAY_API_KEY nicht konfiguriert' }) };
  }

  try {
    const { query } = JSON.parse(event.body);
    if (!query || typeof query !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ url: null }) };
    }

    const englishQuery = await translateToEnglish(query);
    const url = await searchPixabay(englishQuery);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url })
    };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ url: null, error: err.message }) };
  }
};

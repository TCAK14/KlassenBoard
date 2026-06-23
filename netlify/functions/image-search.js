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
          contents: [{ role: 'user', parts: [{ text: 'Convert this to precise English Pixabay search keywords that will find EXACTLY this single object/subject. The photo should show ONLY this item, isolated or clearly as the main subject. Add "isolated" or "close up" if it is a simple object. For cars/phones/products, include the exact model name. Reply with ONLY the keywords, max 5 words, nothing else.\n\nExamples:\nbanane -> single banana fruit isolated\nstift -> pen writing instrument closeup\naudi a5 -> Audi A5 car\niphone 3g -> iPhone 3G phone\nkatze -> cat portrait closeup\nweltkarte -> world map\n\nNow convert: ' + query }] }],
          generationConfig: { maxOutputTokens: 20, temperature: 0 }
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
